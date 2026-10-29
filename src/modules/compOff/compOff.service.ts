import { QueryTypes } from "sequelize";
import { sequelize, CompanyLeave, Company, User } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getISTDateString } from "../shared/dateUtils";
import { getCompanyScopedChildUserIds, getCompanyAdminIds, getDirectCreator } from "../shared/userHierarchy";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { resolveLeaveTypeBalance } from "../leave/leave.service";
import { loadOffDayChecker } from "../leave/leaveCharge";
import { resolvePolicy, type ResolvedPolicy } from "../attendancePolicy/attendancePolicy.service";

// ============================================================
// Comp-off: working a full day (P) on a weekly off or holiday earns 1 day of
// the company's "Comp Off" leave type, a half day (HD) 0.5 — when the
// attendance policy's compOff rule is on. Company settings decide the rest:
//   compOffMinHours         — days that can be earned per year (the field is
//                             labelled "Comp Off Days Allowed Per Year";
//                             it's also the Comp Off type's leavesPerYear)
//   compOffExpiryDays       — an earned day expires this many days after the
//                             day worked, if still unused (0 = never)
//   compOffApprovalRequired — earned days wait for a manager's approval
// Each worked day is one comp_off_credits row. The employee's Comp Off
// balance (allocated) is always recomputed from those rows — approved and
// expired days minus the part that expired unused — so it never drifts.
// ============================================================

const COMP_OFF_NAME = "comp off";
const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (ymd: string, n: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const round2 = (n: number) => Math.round(n * 100) / 100;

const query = <T = any>(sql: string, replacements: Record<string, unknown> = {}): Promise<T[]> =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT }) as Promise<T[]>;

// The company's Comp Off leave type — the row the company settings create
// (utils/leaveTypeSync.js on the frontend names it exactly "Comp Off").
export const findCompOffLeaveType = async (companyId: number): Promise<any | null> => {
  const types: any[] = await CompanyLeave.findAll({ where: { companyId }, order: [["id", "ASC"]] });
  return types.find((t) => String(t.leaveName || "").trim().toLowerCase() === COMP_OFF_NAME) ?? null;
};

// Comp Off balance = earned days that were approved, minus what expired
// unused. Pending / rejected / cancelled credits don't count.
export const syncCompOffBalance = async (employeeId: number, leaveType: any, year: number, actorId: number) => {
  const [row] = await query<{ earned: number }>(
    `SELECT COALESCE(SUM("days" - "expiredDays"), 0)::float AS earned
       FROM comp_off_credits
      WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
        AND "status" IN ('approved', 'expired')`,
    { employeeId, leaveTypeId: leaveType.id, year }
  );
  const balance: any = await resolveLeaveTypeBalance(employeeId, leaveType, year, actorId);
  balance.allocated = round2(Number(row?.earned) || 0);
  await balance.save();
  return balance;
};

// Who may list and review comp-off — managers can't.
const REVIEW_ROLES = ["admin", "user", "super_admin"];

// ── Notifications — the existing sendNotification pipeline (bell + Socket.IO
// + push). A pending comp-off goes to the people who can review it: the
// company's admins, plus the user who created the employee when that is an
// admin / the owner (never a manager — managers don't review comp-off).
// Fire-and-forget: a notification failure never blocks the comp-off itself.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (ymd: string) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;
const fmtDays = (d: number) => `${Number(d)} day${Number(d) === 1 ? "" : "s"}`;

const notifyCompOffPending = (credit: any): void => {
  (async () => {
    const employeeId = Number(credit.employeeId);
    const workDate = String(credit.workDate).slice(0, 10);
    const [employee, adminIds, creator]: [any, number[], { id: number; role: string } | null] = await Promise.all([
      User.findByPk(employeeId, { attributes: ["id", "firstName", "lastName", "email"] }),
      getCompanyAdminIds(Number(credit.companyId)),
      getDirectCreator(employeeId),
    ]);
    const receiverIds = new Set<number>(adminIds.map(Number));
    if (creator && REVIEW_ROLES.includes(creator.role)) receiverIds.add(Number(creator.id));
    receiverIds.delete(employeeId);
    if (receiverIds.size === 0) return;

    const name = employee ? `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.email : `Employee #${employeeId}`;
    const body = credit.source === "request"
      ? `${name} requested ${fmtDays(credit.days)} comp-off for working on ${fmtDate(workDate)}: "${credit.reason}"`
      : `${name} earned ${fmtDays(credit.days)} comp-off for working on ${fmtDate(workDate)} (weekly off / holiday) — waiting for your approval.`;
    await Promise.all(
      [...receiverIds].map((receiverId) =>
        sendNotification({
          receiverId,
          senderId: employeeId,
          type: NotificationType.SYSTEM,
          title: "Comp-off Request",
          body,
          data: { kind: "comp_off_request", creditId: credit.id, employeeId },
        })
      )
    );
  })().catch((err) => console.error("compOff: approver notification failed:", err));
};

// To the employee: approved / rejected by a manager, or added automatically.
const notifyCompOffDecision = (
  credit: any,
  outcome: "approved" | "rejected" | "auto_approved",
  reviewerId: number | null,
  reviewerNote?: string | null
): void => {
  const workDate = String(credit.workDate).slice(0, 10);
  const days = fmtDays(credit.days);
  const title = outcome === "rejected" ? "Comp-off Rejected" : outcome === "approved" ? "Comp-off Approved" : "Comp-off Added";
  const body = outcome === "rejected"
    ? `Your comp-off for ${fmtDate(workDate)} was rejected.${reviewerNote ? ` Note: ${reviewerNote}` : ""}`
    : `${days} of comp-off for working on ${fmtDate(workDate)} ${outcome === "approved" ? "was approved and" : "was"} added to your Comp Off balance.${credit.expiresOn ? ` Use it by ${fmtDate(String(credit.expiresOn).slice(0, 10))}.` : ""}`;
  sendNotification({
    receiverId: Number(credit.employeeId),
    senderId: reviewerId,
    type: NotificationType.SYSTEM,
    title,
    body,
    data: { kind: "comp_off_reviewed", creditId: credit.id, status: outcome === "rejected" ? "rejected" : "approved" },
  }).catch((err) => console.error("compOff: employee notification failed:", err));
};

const findCredit = async (employeeId: number, workDate: string) =>
  (await query(`SELECT * FROM comp_off_credits WHERE "employeeId" = :employeeId AND "workDate" = :workDate`, { employeeId, workDate }))[0] ?? null;

// Called after a day is classified (punch-out, auto punch-out, approved
// regularization). Creates, updates or cancels that day's credit. Never
// touches a credit a manager rejected or one that already expired.
export const recordCompOffForDay = async (params: {
  employeeId: number;
  companyId: number | null | undefined;
  date: string;
  policy: ResolvedPolicy;
  dayType: string | null;
}): Promise<any> => {
  const { employeeId, date, policy } = params;
  if (!policy.config.compOff?.enabled || !params.companyId) return null;
  const companyId = Number(params.companyId);

  const leaveType = await findCompOffLeaveType(companyId);
  if (!leaveType) return null; // no Comp Off type configured → nothing to credit

  const employee: any = await User.findByPk(employeeId, { attributes: ["id", "branchId"] });
  const isOffDay = await loadOffDayChecker(companyId, employee?.branchId, date, date);
  const worked = params.dayType === "full_day" ? 1 : params.dayType === "half_day" ? 0.5 : 0;
  let earned = isOffDay(date) ? worked : 0;

  const existing = await findCredit(employeeId, date);
  if (existing && (existing.status === "rejected" || existing.status === "expired")) return existing;
  // The employee asked for this day themselves — attendance never changes it.
  if (existing?.source === "request") return existing;
  if (!existing && earned === 0) return null;

  const company: any = await Company.findByPk(companyId, {
    attributes: ["id", "compOffMinHours", "compOffExpiryDays", "compOffApprovalRequired"],
  });
  const year = Number(date.slice(0, 4));

  // Yearly limit: what's already pending/approved on other days counts.
  let note = earned === 1 ? "Full day worked on a weekly off / holiday" : earned === 0.5 ? "Half day worked on a weekly off / holiday" : "No longer a full or half day on a weekly off / holiday";
  const yearlyLimit = Number(company?.compOffMinHours) || 0;
  if (earned > 0 && yearlyLimit > 0) {
    const [row] = await query<{ total: number }>(
      `SELECT COALESCE(SUM("days"), 0)::float AS total FROM comp_off_credits
        WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
          AND "status" IN ('pending', 'approved', 'expired') AND "workDate" <> :date`,
      { employeeId, leaveTypeId: leaveType.id, year, date }
    );
    const left = Math.max(0, yearlyLimit - (Number(row?.total) || 0));
    if (earned > left) {
      earned = left;
      note = `Limited by the yearly comp-off limit (${yearlyLimit} day${yearlyLimit === 1 ? "" : "s"})`;
    }
  }

  const expiryDays = Number(company?.compOffExpiryDays) || 0;
  const expiresOn = expiryDays > 0 ? addDays(date, expiryDays) : null;
  const initialStatus = company?.compOffApprovalRequired === false ? "approved" : "pending";

  if (!existing) {
    if (earned === 0) return null;
    const [inserted] = await query(
      `INSERT INTO comp_off_credits ("companyId","employeeId","companyLeaveId","workDate","year","days","status","expiresOn","note","createdAt","updatedAt")
       VALUES (:companyId,:employeeId,:leaveTypeId,:date,:year,:days,:status,:expiresOn,:note,NOW(),NOW())
       ON CONFLICT ("employeeId","workDate") DO NOTHING RETURNING *`,
      { companyId, employeeId, leaveTypeId: leaveType.id, date, year, days: earned, status: initialStatus, expiresOn, note }
    );
    if (inserted) {
      if (initialStatus === "approved") {
        await syncCompOffBalance(employeeId, leaveType, year, employeeId);
        notifyCompOffDecision(inserted, "auto_approved", null);
      } else {
        notifyCompOffPending(inserted);
      }
      return inserted;
    }
    // Another request created it in the meantime — fall through and update it.
    return recordCompOffForDay(params);
  }

  let days = earned;
  let status = existing.status;
  if (status === "approved" && days < Number(existing.days)) {
    // Never take back more than is still unused — the balance can't go negative.
    const balance: any = await resolveLeaveTypeBalance(employeeId, leaveType, year, employeeId);
    const remaining = (Number(balance.allocated) || 0) + (Number(balance.carriedForward) || 0) - (Number(balance.used) || 0);
    days = Math.max(days, round2(Number(existing.days) - Math.max(0, remaining)));
  }
  if (days === 0) status = "cancelled";
  else if (status === "cancelled") status = initialStatus;

  if (days === Number(existing.days) && status === existing.status) return existing;
  const [updated] = await query(
    `UPDATE comp_off_credits SET "days" = :days, "status" = :status, "note" = :note, "updatedAt" = NOW()
      WHERE id = :id AND "status" = :oldStatus RETURNING *`,
    { id: existing.id, days, status, note, oldStatus: existing.status }
  );
  if (existing.status === "approved" || status === "approved") {
    await syncCompOffBalance(employeeId, leaveType, year, employeeId);
  }
  return updated ?? existing;
};

// ── Manager / admin API ──────────────────────────────────────────────────

export interface CompOffActor {
  userId: number;
  role: string;
  companyId: number | null;
}

// Managers may only view their team's comp-off (never their own here — that
// is under My Leave — and never review it).
const VIEW_ROLES = [...REVIEW_ROLES, "manager"];

const teamOf = async (actor: CompOffActor, access: "view" | "review"): Promise<{ companyId: number; ids: number[] }> => {
  if (!(access === "review" ? REVIEW_ROLES : VIEW_ROLES).includes(actor.role)) {
    throw new ServiceError(
      access === "review"
        ? "Only an admin or the company owner can approve or reject comp-off"
        : "You cannot view comp-off requests",
      403
    );
  }
  if (!actor.companyId) throw new ServiceError("No active company is associated with your account", 403);
  const companyId = Number(actor.companyId);
  const team = (await getCompanyScopedChildUserIds(Number(actor.userId), companyId)).map(Number);
  const ids = actor.role === "manager" ? team.filter((id) => id !== Number(actor.userId)) : [...team, Number(actor.userId)];
  return { companyId, ids: [...new Set(ids)] };
};

const STATUSES = ["pending", "approved", "rejected", "expired", "cancelled"];

export const listCompOff = async (actor: CompOffActor, q: any) => {
  const { companyId, ids } = await teamOf(actor, "view");
  const canReview = REVIEW_ROLES.includes(actor.role);
  if (ids.length === 0) return { rows: [], canReview };
  const status = STATUSES.includes(q?.status) ? q.status : null;
  const limit = Math.min(Math.max(Number(q?.limit) || 100, 1), 500);
  const rows = await query(
    `SELECT c.id, c."employeeId", c."workDate"::text AS "workDate", c.days, c.status, c."expiresOn"::text AS "expiresOn",
            c."expiredDays", c.note, c.source, c.reason, c."reviewedAt", c."createdAt",
            TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS "employeeName",
            TRIM(CONCAT(r."firstName", ' ', r."lastName")) AS "reviewedByName"
       FROM comp_off_credits c
       JOIN users u ON u.id = c."employeeId"
       LEFT JOIN users r ON r.id = c."reviewedBy"
      WHERE c."companyId" = :companyId AND c."employeeId" IN (:ids) ${status ? `AND c.status = :status` : ""}
      ORDER BY (c.status = 'pending') DESC, c."workDate" DESC, c.id DESC
      LIMIT :limit`,
    { companyId, ids, status, limit }
  );
  return { rows, canReview };
};

export const reviewCompOff = async (actor: CompOffActor, id: unknown, body: any) => {
  const decision = body?.status;
  if (decision !== "approved" && decision !== "rejected") throw new ServiceError("Status must be approved or rejected");
  const creditId = Number(id);
  if (!Number.isInteger(creditId) || creditId <= 0) throw new ServiceError("Invalid comp-off request");

  const { companyId, ids } = await teamOf(actor, "review");
  const credit = (await query(`SELECT * FROM comp_off_credits WHERE id = :id AND "companyId" = :companyId`, { id: creditId, companyId }))[0];
  if (!credit || !ids.includes(Number(credit.employeeId))) throw new ServiceError("Comp-off request not found", 404);
  if (Number(credit.employeeId) === Number(actor.userId) && !["admin", "super_admin"].includes(actor.role)) {
    throw new ServiceError("You cannot approve your own comp-off", 403);
  }
  if (credit.status !== "pending") throw new ServiceError(`This comp-off is already ${credit.status}`);

  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 255) : credit.note;
  const [updated] = await query(
    `UPDATE comp_off_credits SET "status" = :status, "reviewedBy" = :by, "reviewedAt" = NOW(), "note" = :note, "updatedAt" = NOW()
      WHERE id = :id AND "status" = 'pending' RETURNING *`,
    { id: creditId, status: decision, by: Number(actor.userId), note }
  );
  if (!updated) throw new ServiceError("This comp-off was just reviewed by someone else. Refresh and try again.", 409);

  if (decision === "approved") {
    const leaveType: any = await CompanyLeave.findByPk(credit.companyLeaveId);
    if (leaveType) await syncCompOffBalance(Number(credit.employeeId), leaveType, Number(credit.year), Number(actor.userId));
  }
  const reviewerNote = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 255) : null;
  notifyCompOffDecision(updated, decision, Number(actor.userId), reviewerNote);
  return updated;
};

// ── Employee self-service ────────────────────────────────────────────────

const isDateOnly = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// Earning switched on for this employee on `date` (their shift's policy, else
// the company-wide one) and a Comp Off leave type to credit.
const compOffContext = async (employeeId: number, companyId: number, date: string) => {
  const employee: any = await User.findByPk(employeeId, { attributes: ["id", "shiftId", "branchId"] });
  const policy = await resolvePolicy(companyId, employee?.shiftId ?? null, date);
  const leaveType = await findCompOffLeaveType(companyId);
  const company: any = await Company.findByPk(companyId, {
    attributes: ["id", "compOffMinHours", "compOffExpiryDays", "compOffApprovalRequired"],
  });
  return { employee, leaveType, company, enabled: !!policy?.config.compOff?.enabled && !!leaveType };
};

const usedThisYear = async (employeeId: number, leaveTypeId: number, year: number) => {
  const [row] = await query<{ total: number }>(
    `SELECT COALESCE(SUM("days"), 0)::float AS total FROM comp_off_credits
      WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
        AND "status" IN ('pending', 'approved', 'expired')`,
    { employeeId, leaveTypeId, year }
  );
  return Number(row?.total) || 0;
};

// GET /api/comp-off/my — the employee's own comp-off days and the rules.
export const getMyCompOff = async (employeeId: number, companyId: number | null) => {
  if (!companyId) throw new ServiceError("No active company is associated with your account", 403);
  const today = getISTDateString();
  const year = Number(today.slice(0, 4));
  const ctx = await compOffContext(employeeId, Number(companyId), today);
  const rows = await query(
    `SELECT id, "workDate"::text AS "workDate", days, status, source, reason, note,
            "expiresOn"::text AS "expiresOn", "expiredDays", "reviewedAt", "createdAt"
       FROM comp_off_credits
      WHERE "employeeId" = :employeeId AND "companyId" = :companyId
      ORDER BY "workDate" DESC, id DESC
      LIMIT 100`,
    { employeeId, companyId: Number(companyId) }
  );
  const yearlyLimit = Number(ctx.company?.compOffMinHours) || 0;
  return {
    enabled: ctx.enabled,
    year,
    yearlyLimit: yearlyLimit || null,
    earnedThisYear: ctx.leaveType ? await usedThisYear(employeeId, ctx.leaveType.id, year) : 0,
    expiryDays: Number(ctx.company?.compOffExpiryDays) || null,
    approvalRequired: ctx.company?.compOffApprovalRequired !== false,
    rows,
  };
};

// POST /api/comp-off/request — the employee claims a weekly off / holiday
// they worked (e.g. without punching). Always waits for a manager, whatever
// the company's approval setting, since nothing in attendance backs it up.
export const requestCompOff = async (employeeId: number, companyId: number | null, body: any) => {
  if (!companyId) throw new ServiceError("No active company is associated with your account", 403);
  const workDate = body?.workDate;
  if (!isDateOnly(workDate)) throw new ServiceError("Worked date must be a valid date (YYYY-MM-DD)");
  const days = Number(body?.days);
  if (days !== 1 && days !== 0.5) throw new ServiceError("Days must be 1 (full day) or 0.5 (half day)");
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) throw new ServiceError("Reason is required");
  if (reason.length > 255) throw new ServiceError("Reason can be at most 255 characters");

  const today = getISTDateString();
  if (workDate > today) throw new ServiceError("You can only request comp-off for a day you have already worked");
  const year = Number(workDate.slice(0, 4));
  if (year !== Number(today.slice(0, 4))) throw new ServiceError("Comp-off can only be requested for days worked this year");

  const ctx = await compOffContext(employeeId, Number(companyId), workDate);
  if (!ctx.enabled) throw new ServiceError("Comp-off is not enabled for you — contact your admin");
  const expiryDays = Number(ctx.company?.compOffExpiryDays) || 0;
  const expiresOn = expiryDays > 0 ? addDays(workDate, expiryDays) : null;
  if (expiresOn && expiresOn < today) {
    throw new ServiceError(`Comp-off for ${workDate} would already have expired (${expiryDays}-day limit)`);
  }

  const isOffDay = await loadOffDayChecker(Number(companyId), ctx.employee?.branchId, workDate, workDate);
  if (!isOffDay(workDate)) throw new ServiceError(`${workDate} is a working day — comp-off is only for weekly offs and holidays`);

  const existing = await findCredit(employeeId, workDate);
  if (existing) throw new ServiceError(`You already have a comp-off for ${workDate} (${existing.status})`);

  const yearlyLimit = Number(ctx.company?.compOffMinHours) || 0;
  if (yearlyLimit > 0) {
    const left = Math.max(0, yearlyLimit - (await usedThisYear(employeeId, ctx.leaveType.id, year)));
    if (days > left) throw new ServiceError(`Only ${left} comp-off day(s) left of your yearly limit (${yearlyLimit})`);
  }

  const [inserted] = await query(
    `INSERT INTO comp_off_credits ("companyId","employeeId","companyLeaveId","workDate","year","days","status","expiresOn","note","source","reason","createdAt","updatedAt")
     VALUES (:companyId,:employeeId,:leaveTypeId,:workDate,:year,:days,'pending',:expiresOn,'Requested by the employee','request',:reason,NOW(),NOW())
     ON CONFLICT ("employeeId","workDate") DO NOTHING RETURNING *`,
    { companyId: Number(companyId), employeeId, leaveTypeId: ctx.leaveType.id, workDate, year, days, expiresOn, reason }
  );
  if (!inserted) throw new ServiceError(`You already have a comp-off for ${workDate}`, 409);
  notifyCompOffPending(inserted);
  return inserted;
};

// ── Daily expiry and reminders (config/cronJobs.ts) ──────────────────────

// Comp Off days are used oldest-first, so what is left of an approved credit
// is whatever remains in the balance beyond the newer approved credits.
const unusedDaysOf = async (credit: any): Promise<{ leaveType: any; unused: number } | null> => {
  const leaveType: any = await CompanyLeave.findByPk(credit.companyLeaveId);
  if (!leaveType) return null;
  const employeeId = Number(credit.employeeId);
  const year = Number(credit.year);
  const balance: any = await resolveLeaveTypeBalance(employeeId, leaveType, year, employeeId);
  const remaining = (Number(balance.allocated) || 0) + (Number(balance.carriedForward) || 0) - (Number(balance.used) || 0);
  const [newer] = await query<{ total: number }>(
    `SELECT COALESCE(SUM("days" - "expiredDays"), 0)::float AS total FROM comp_off_credits
      WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
        AND "status" = 'approved' AND ("workDate" > :workDate OR ("workDate" = :workDate AND id > :id))`,
    { employeeId, leaveTypeId: leaveType.id, year, workDate: String(credit.workDate).slice(0, 10), id: credit.id }
  );
  return { leaveType, unused: round2(Math.max(0, Math.min(Number(credit.days), remaining - (Number(newer?.total) || 0)))) };
};

// Reminder this many days before an approved comp-off expires, if any of it
// is still unused.
export const EXPIRY_REMINDER_DAYS = 3;

export const remindExpiringCompOff = async (today: string = getISTDateString()) => {
  const soon = await query(
    `SELECT * FROM comp_off_credits
      WHERE "status" = 'approved' AND "expiryReminderSentAt" IS NULL
        AND "expiresOn" >= :today AND "expiresOn" <= :until
      ORDER BY "employeeId", "workDate", id`,
    { today, until: addDays(today, EXPIRY_REMINDER_DAYS) }
  );
  let reminded = 0;
  for (const credit of soon) {
    try {
      const result = await unusedDaysOf(credit);
      // Claim the reminder first so it goes out once even if two servers run this.
      const [claimed] = await query(
        `UPDATE comp_off_credits SET "expiryReminderSentAt" = NOW() WHERE id = :id AND "expiryReminderSentAt" IS NULL RETURNING id`,
        { id: credit.id }
      );
      if (!claimed || !result || result.unused <= 0) continue; // already used up → nothing to remind
      const workDate = String(credit.workDate).slice(0, 10);
      const expiresOn = String(credit.expiresOn).slice(0, 10);
      sendNotification({
        receiverId: Number(credit.employeeId),
        type: NotificationType.SYSTEM,
        title: "Comp-off Expiring Soon",
        body: `${fmtDays(result.unused)} of comp-off (worked on ${fmtDate(workDate)}) expires on ${fmtDate(expiresOn)}. Apply for Comp Off leave before then to use it.`,
        data: { kind: "comp_off_expiring", creditId: credit.id, expiresOn, days: result.unused },
      }).catch((err) => console.error("compOff: expiry reminder failed:", err));
      reminded++;
    } catch (err) {
      console.error(`Comp-off expiry reminder failed for credit #${credit.id}:`, err);
    }
  }
  return { checked: soon.length, reminded };
};

// Expires approved credits whose expiry date has passed, oldest first, and
// tells the employee when unused days were lost.
export const expireCompOffCredits = async (today: string = getISTDateString()) => {
  const due = await query(
    `SELECT * FROM comp_off_credits WHERE "status" = 'approved' AND "expiresOn" < :today ORDER BY "employeeId", "workDate", id`,
    { today }
  );
  let expired = 0;
  for (const credit of due) {
    try {
      const result = await unusedDaysOf(credit);
      if (!result) continue;
      const { leaveType, unused } = result;
      const employeeId = Number(credit.employeeId);
      const year = Number(credit.year);
      const [updated] = await query(
        `UPDATE comp_off_credits SET "status" = 'expired', "expiredDays" = :unused, "updatedAt" = NOW()
          WHERE id = :id AND "status" = 'approved' RETURNING id`,
        { id: credit.id, unused }
      );
      if (!updated) continue; // another instance got there first
      await syncCompOffBalance(employeeId, leaveType, year, employeeId);
      expired++;
      if (unused > 0) {
        sendNotification({
          receiverId: employeeId,
          type: NotificationType.SYSTEM,
          title: "Comp-off Expired",
          body: `${fmtDays(unused)} of comp-off (worked on ${fmtDate(String(credit.workDate).slice(0, 10))}) expired unused on ${fmtDate(String(credit.expiresOn).slice(0, 10))} and was removed from your Comp Off balance.`,
          data: { kind: "comp_off_expired", creditId: credit.id, days: unused },
        }).catch((err) => console.error("compOff: expiry notification failed:", err));
      }
    } catch (err) {
      console.error(`Comp-off expiry failed for credit #${credit.id}:`, err);
    }
  }
  return { checked: due.length, expired };
};
