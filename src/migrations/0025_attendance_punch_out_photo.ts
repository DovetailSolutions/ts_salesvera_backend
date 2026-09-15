import { Sequelize } from "sequelize";

/**
 * Punch-out photo support — mirrors punch-in's attendancePhoto, but as an
 * array since punch-out accepts multiple images (see
 * modules/attendance/attendancePhotoUpload.ts's handleAttendancePunchOutPhoto).
 * Punch-in's own attendancePhoto column/behavior is untouched.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "attendancePhotoOut" TEXT[];
  `);
}
