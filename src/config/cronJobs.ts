import cron from "node-cron";
import { Op } from "sequelize";
import { Attendance, User, Shift, Company } from "./dbConnection";
import { applyDayClassification } from "../modules/attendance/attendance.service";
import { resolvePolicy, shiftWindowOn } from "../modules/attendancePolicy/attendancePolicy.service";
import { getISTDateString } from "../modules/shared/dateUtils";

/**
 * ─────────────────────────────────────────────
 *  AUTO PUNCH-OUT
 *  Schedule : Every day at 11:59 PM (IST), plus a
 *             catch-up run shortly after server start.
 *  Purpose  : Close attendance sessions that were
 *             punched in but never punched out.
 *
 *  - Uses each session's OWN date (never the next
 *    day's shift window) and IST throughout.
 *  - A saved company attendance policy decides
 *    between a system punch-out (end of day, or
 *    shift end) and marking the day absent.
 *    Without a policy: punch-out at 23:59 of the
 *    session's date, exactly as before.
 *  - Every close is a conditional update (still
 *    "present", punch_out still NULL), so a second
 *    run, another server instance or an employee
 *    punching out at the same moment can never
 *    double-process or overwrite a session.
 *  - System punch-outs are flagged autoPunchedOut.
 *  - The day's final status comes from
 *    applyDayClassification — the same path as a
 *    normal punch-out (never forced to Present).
 * ─────────────────────────────────────────────
 */
let autoPunchOutRunning = false;

export const runAutoPunchOut = async (opts: { onlyBeforeToday?: boolean; source?: string } = {}) => {
  if (autoPunchOutRunning) return { skippedRun: true };
  autoPunchOutRunning = true;
  const source = opts.source ?? "cron";
  try {
    const todayStr = getISTDateString();
    const missed = await Attendance.findAll({
      where: {
        status: "present", // punched in, not yet punched out
        punch_out: null,
        // FIX: only real open punch sessions. An approved regularization
        // (e.g. Work From Home, which has no punch times at all) was picked
        // up here too — closed at 23:59 with hours counted from 1970, or
        // marked absent under a "mark absent" policy. A regularized day is
        // an admin decision and is never changed automatically.
        punch_in: { [Op.ne]: null },
        [Op.or]: [{ attendanceSource: null }, { attendanceSource: { [Op.ne]: "REGULARIZATION" } }],
        // The catch-up run only touches earlier days — today's sessions may
        // still be in progress.
        date: opts.onlyBeforeToday ? { [Op.lt]: todayStr } : { [Op.lte]: todayStr },
      },
      order: [["id", "ASC"]],
    });
    if (missed.length === 0) return { closed: 0, markedAbsent: 0, skipped: 0 };

    // Batch-resolve each employee's shift + company (Shift > Company).
    const employeeIds = [...new Set(missed.map((r) => r.employee_id))];
    const employees = await User.findAll({ where: { id: { [Op.in]: employeeIds } }, attributes: ["id", "shiftId"] });
    const shiftIdByEmployee = new Map(employees.map((e: any) => [e.id, e.shiftId ?? null]));
    const shiftIds = [...new Set(employees.map((e: any) => e.shiftId).filter((id: any): id is number => !!id))];
    const shifts = shiftIds.length ? await Shift.findAll({ where: { id: { [Op.in]: shiftIds } } }) : [];
    const shiftById = new Map(shifts.map((s: any) => [s.id, s]));
    const companyIds = [...new Set(shifts.map((s: any) => s.companyId).filter((id: any): id is number => !!id))];
    const companies = companyIds.length ? await Company.findAll({ where: { id: { [Op.in]: companyIds } } }) : [];
    const companyById = new Map(companies.map((c: any) => [c.id, c]));

    let closed = 0;
    let markedAbsent = 0;
    let skipped = 0;

    for (const record of missed) {
      try {
        const dateStr = record.date instanceof Date ? record.date.toISOString().slice(0, 10) : String(record.date).slice(0, 10);
        const punchIn = new Date(record.punch_in as Date);
        const shiftId = shiftIdByEmployee.get(record.employee_id);
        const shift: any = shiftId ? shiftById.get(shiftId) : null;
        const company: any = shift?.companyId ? companyById.get(shift.companyId) : null;
        const window = shiftWindowOn(shift, dateStr);
        const overnight = !!window && String(shift?.endTime) <= String(shift?.startTime);

        // A night shift that hasn't ended yet is still in progress — never
        // close it or mark it absent mid-shift; a later run picks it up.
        if (overnight && window!.end!.getTime() > Date.now()) {
          skipped++;
          continue;
        }

        const policy = await resolvePolicy(company?.id ?? null, shift?.id ?? null, dateStr);

        if (policy?.config.missedPunchOut.action === "mark_absent") {
          const [n] = await Attendance.update(
            {
              status: "absent",
              dayType: null,
              working_hours: null,
              overtime: 0,
              autoPunchedOut: false,
              statusReason: "Missed punch-out — marked absent by attendance policy",
              attendancePolicyId: policy.id,
            } as any,
            { where: { id: record.id, status: "present", punch_out: null } }
          );
          if (n === 0) {
            skipped++; // closed meanwhile — leave it alone
            continue;
          }
          await applyDayClassification({ employeeId: record.employee_id, date: dateStr, shift, company, missedPunchOut: true });
          markedAbsent++;
          continue;
        }

        // System punch-out time: 23:59 of the session's own date (previous
        // behaviour), or the shift end when the policy asks for it — and,
        // under a policy, always the shift end for a night shift.
        let autoPunchOut = new Date(`${dateStr}T23:59:00+05:30`);
        if (
          policy &&
          window?.end &&
          punchIn < window.end &&
          (policy.config.missedPunchOut.autoPunchOutAt === "shift_end" || overnight)
        ) {
          autoPunchOut = window.end;
        }
        if (autoPunchOut <= punchIn) {
          console.warn(`[CRON] ⚠️  Skipping attendance ${record.id} (date: ${dateStr}) — punch_in is after the auto punch-out time`);
          skipped++;
          continue;
        }

        const workingHours = Number(((autoPunchOut.getTime() - punchIn.getTime()) / 3600000).toFixed(2));
        const [n] = await Attendance.update(
          { punch_out: autoPunchOut, working_hours: workingHours, overtime: 0, status: "out", autoPunchedOut: true } as any,
          { where: { id: record.id, status: "present", punch_out: null } }
        );
        if (n === 0) {
          skipped++; // closed meanwhile — leave it alone
          continue;
        }
        await applyDayClassification({ employeeId: record.employee_id, date: dateStr, shift, company });
        closed++;
      } catch (recordError) {
        console.error(`[CRON] ❌ Failed to auto punch-out attendance ${record.id}:`, recordError);
      }
    }

    console.log(
      `[CRON] 🏁 Auto punch-out (${source}) — closed: ${closed}, marked absent: ${markedAbsent}, skipped: ${skipped}, total: ${missed.length}`
    );
    return { closed, markedAbsent, skipped };
  } finally {
    autoPunchOutRunning = false;
  }
};

export const startCronJobs = () => {

  // ──────────────────────────────────────────────
  // Cron: "59 23 * * *"  → runs at 23:59 every day
  // timezone: "Asia/Kolkata" ensures it fires at
  // 11:59 PM IST regardless of server timezone
  // ──────────────────────────────────────────────
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        await runAutoPunchOut({ source: "cron" });
      } catch (error) {
        console.error("[CRON] ❌ Auto punch-out job failed with error:", error);
      }
    },
    {
      // scheduled: true,
      timezone: "Asia/Kolkata", // 11:59 PM IST
    }
  );

  // Catch-up: if the server was down at 23:59, earlier days' sessions would
  // stay open until the next night. Close them shortly after start —
  // earlier days only, never today's possibly-active sessions.
  setTimeout(() => {
    runAutoPunchOut({ onlyBeforeToday: true, source: "startup catch-up" }).catch((error) =>
      console.error("[CRON] ❌ Auto punch-out catch-up failed:", error)
    );
  }, 60 * 1000);

  // ─────────────────────────────────────────────
  //  REFRESH-SESSION CLEANUP
  //  Schedule : Every day at 03:30 AM (IST)
  //  Purpose  : Delete refresh_sessions rows that have ALREADY expired.
  //             Never touches an active (non-expired) session, revoked or
  //             not — a revoked-but-not-yet-expired row is still useful
  //             replay-detection history (see refreshSession.service.ts's
  //             rotateSession).
  // ─────────────────────────────────────────────
  cron.schedule(
    "30 3 * * *",
    async () => {
      try {
        const { cleanupExpiredSessions } = await import("../modules/auth/refreshSession.service");
        const deleted = await cleanupExpiredSessions();
        if (deleted > 0) console.log(`[CRON] 🧹 Refresh-session cleanup — removed ${deleted} expired session(s).`);
      } catch (error) {
        console.error("[CRON] ❌ Refresh-session cleanup failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  // ─────────────────────────────────────────────
  //  ACCESS-EXPIRY SWEEP
  //  Schedule : Every day at 6:00 AM (IST)
  //  Purpose  : Flip subscriptions that have passed their endDate to
  //             EXPIRED, and send 30/7/3/1-day expiry warnings to tenants
  //             approaching it.
  //
  //  subscriptionLimit.service.ts's getActiveSubscriptionForUser already
  //  heals an expired status lazily whenever the tenant touches a gated
  //  endpoint, so this is the backstop for accounts that have gone quiet —
  //  and the only thing that can warn a tenant BEFORE expiry, since no
  //  request from them is involved.
  //
  //  6 AM rather than midnight so a warning lands at the top of a working
  //  day, and clear of the 23:59 auto-punch-out and 03:30 session-cleanup
  //  jobs above.
  //
  //  Idempotent (see accessNotification.service.ts) — a restart that runs it
  //  twice in one day sends no duplicate notifications.
  // ─────────────────────────────────────────────
  cron.schedule(
    "0 6 * * *",
    async () => {
      try {
        const { runAccessExpirySweep } = await import("../modules/accessExtension/accessExpirySweep.service");
        const r = await runAccessExpirySweep();
        if (r.expired || r.warned || r.errors) {
          console.log(
            `[CRON] 🔐 Access-expiry sweep — expired ${r.expired}, expiry notices ${r.expiredNotified}, warnings ${r.warned}, errors ${r.errors}.`
          );
        }
      } catch (error) {
        console.error("[CRON] ❌ Access-expiry sweep failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};
