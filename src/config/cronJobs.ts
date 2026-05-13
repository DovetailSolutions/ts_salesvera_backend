import cron from "node-cron";
import { Op } from "sequelize";
import { Attendance } from "./dbConnection";

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

            // ── Overtime (standard 8h working day) ──
            const officeHours = 8;
            const overtime =
              workingHours > officeHours
                ? Number((workingHours - officeHours).toFixed(2))
                : 0;

            // ── Update the record ──
            await record.update({
              punch_out: autoPunchOut,
              working_hours: workingHours,
              overtime,
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
