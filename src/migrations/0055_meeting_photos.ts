import { Sequelize } from "sequelize";

/**
 * Meeting-in / meeting-out photos.
 *
 *   users.isMeetingInPhotoRequired / isMeetingOutPhotoRequired
 *     Per-employee switches (Attendance Security settings, controlled by an
 *     admin or manager). Default FALSE: the photo stays optional, so no
 *     existing employee's meeting flow changes until someone turns it on.
 *
 *   meetings.meetingInPhoto / meetingOutPhoto
 *     URL of the photo taken at meeting in (start) and meeting out (end).
 *
 * Additive only: nullable / defaulted columns, existing rows unchanged.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isMeetingInPhotoRequired" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isMeetingOutPhotoRequired" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "meetingInPhoto" TEXT NULL;
    ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "meetingOutPhoto" TEXT NULL;
  `);
}
