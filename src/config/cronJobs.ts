import cron from "node-cron";
import { Op } from "sequelize";
import { Attendance, User, Shift, Company } from "./dbConnection";
import { getDayTypeFromWorkingHours } from "../modules/attendance/attendance.service";

/**
 * ─────────────────────────────────────────────
 *  AUTO PUNCH-OUT CRON JOB
 *  Schedule : Every day at 11:59 PM (IST)
 *  Purpose  : Find all attendance records that
 *             are still "present" (punch-in done,
 *             punch-out NOT done) and auto close
 *             them with punch_out = 23:59:00 IST
 *             of their respective date.
 * ─────────────────────────────────────────────
 */
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
        // Today's date string (yyyy-mm-dd)
        const todayStr = new Date().toISOString().slice(0, 10);

        // ── Step 1: Find all un-punched-out records up to today ──
        const missed = await Attendance.findAll({
          where: {
            status: "present",   // punched in, not yet punched out
            punch_out: null,     // safety double-check
            date: {
              [Op.lte]: todayStr, // today or any earlier forgotten date
            },
          },
        });

        if (missed.length === 0) {
          return;
        }

        // ── Step 1b: Batch-resolve each employee's shift + company, same
        // "Shift > Company > hardcoded" precedence used by every interactive
        // attendance endpoint (mark-present, punch-out, bulk upload) — this
        // job previously always applied overtime with a hardcoded 8h
        // baseline regardless of whether the company had even enabled
        // overtime tracking at registration (Company.overtimeAllowed), and
        // never set dayType at all. Batched (not per-record) to keep this a
        // fixed number of queries regardless of how many records are missed.
        const employeeIds = [...new Set(missed.map((r) => r.employee_id))];
        const employees = await User.findAll({
          where: { id: { [Op.in]: employeeIds } },
          attributes: ["id", "shiftId"],
        });
        const shiftIdByEmployee = new Map(employees.map((e: any) => [e.id, e.shiftId ?? null]));

        const shiftIds = [...new Set(employees.map((e: any) => e.shiftId).filter((id: any): id is number => !!id))];
        const shifts = shiftIds.length ? await Shift.findAll({ where: { id: { [Op.in]: shiftIds } } }) : [];
        const shiftById = new Map(shifts.map((s: any) => [s.id, s]));

        const companyIds = [...new Set(shifts.map((s: any) => s.companyId).filter((id: any): id is number => !!id))];
        const companies = companyIds.length ? await Company.findAll({ where: { id: { [Op.in]: companyIds } } }) : [];
        const companyById = new Map(companies.map((c: any) => [c.id, c]));

        // ── Step 2: Auto punch-out each record ──
        let successCount = 0;
        let skipCount = 0;

        for (const record of missed) {
          try {
            // Get the attendance date string (e.g. "2026-04-14")
            const dateStr =
              record.date instanceof Date
                ? record.date.toISOString().slice(0, 10)
                : String(record.date).slice(0, 10);

            // Set auto punch-out at 23:59:00 IST of the attendance date
            // "+05:30" = IST offset so DB stores the correct UTC equivalent
            const autoPunchOut = new Date(`${dateStr}T23:59:00+05:30`);
            const punchIn = new Date(record.punch_in as Date);

            // Skip if punch_in is somehow after auto punch-out (data anomaly)
            if (autoPunchOut <= punchIn) {
              console.warn(
                `[CRON] ⚠️  Skipping employee ${record.employee_id} (date: ${dateStr}) — punch_in is after 23:59`
              );
              skipCount++;
              continue;
            }

            // ── Calculate working hours ──
            const diffMs = autoPunchOut.getTime() - punchIn.getTime();
            const workingHours = Number(
              (diffMs / (1000 * 60 * 60)).toFixed(2)
            );

            const shiftId = shiftIdByEmployee.get(record.employee_id);
            const shift: any = shiftId ? shiftById.get(shiftId) : null;
            const company: any = shift?.companyId ? companyById.get(shift.companyId) : null;

            // ── Overtime — only counted if this employee's company actually
            // opted into overtime tracking at registration; baseline from
            // their shift's own working hours, falling back to 8h.
            const officeHours = shift?.workingHours && shift.workingHours > 0 ? shift.workingHours : 8;
            const overtimeAllowed = company?.overtimeAllowed ?? false;
            const overtime =
              overtimeAllowed && workingHours > officeHours
                ? Number((workingHours - officeHours).toFixed(2))
                : 0;
            const dayType = getDayTypeFromWorkingHours(workingHours, shift, company);

            // ── Update the record ──
            await record.update({
              punch_out: autoPunchOut,
              working_hours: workingHours,
              overtime,
              dayType,
              status: "out",
            });


            successCount++;

          } catch (recordError) {
            console.error(
              `[CRON] ❌ Failed to auto punch-out employee ${record.employee_id}:`,
              recordError
            );
          }
        }

        console.log(
          `[CRON] 🏁 Job done — Success: ${successCount}, Skipped: ${skipCount}, Total: ${missed.length}`
        );

      } catch (error) {
        console.error("[CRON] ❌ Auto punch-out job failed with error:", error);
      }
    },
    {
      // scheduled: true,
      timezone: "Asia/Kolkata", // 11:59 PM IST
    }
  );
};
