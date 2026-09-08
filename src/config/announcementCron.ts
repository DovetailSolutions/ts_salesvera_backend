import cron from "node-cron";
import { publishDueScheduled } from "../modules/announcement/announcement.service";

/**
 * Publishes scheduled announcements once their scheduledAt time has passed.
 * Ticks every minute — cheap (a single indexed WHERE status='scheduled' AND
 * scheduledAt<=now() query when nothing is due) and matches this module's
 * "minute-granularity" scheduling promise (schedule a time, not a slot).
 */
export const startAnnouncementCronJobs = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await publishDueScheduled();
      } catch (error) {
        console.error("[CRON] ❌ Announcement publish job failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};
