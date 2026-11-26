import { Sequelize } from "sequelize";

/**
 * Replaces the per-user login channel (0057, users."loginAccess") with a
 * per-user ATTENDANCE channel — login works everywhere again, only where a
 * manager/employee may punch in/out is controlled:
 *
 *   users."attendanceAccess"  'both' (default, web + mobile app) | 'mobile' (app only)
 *
 * Set by an admin / owner on Employee Management ("Attendance From").
 * Enforced on /admin/attendance/punch-in and /punch-out via the access
 * token's "ch" claim — see modules/shared/attendanceAccess.ts.
 * Existing values: 'mobile' is kept, 'web'/'both' become 'both'.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'loginAccess') THEN
        ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_login_access_check";
        ALTER TABLE "users" RENAME COLUMN "loginAccess" TO "attendanceAccess";
      ELSE
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "attendanceAccess" VARCHAR(10) NOT NULL DEFAULT 'both';
      END IF;
    END $$;
    UPDATE "users" SET "attendanceAccess" = 'both' WHERE "attendanceAccess" IS DISTINCT FROM 'mobile';
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_attendance_access_check') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_attendance_access_check" CHECK ("attendanceAccess" IN ('both', 'mobile'));
      END IF;
    END $$;
  `);
}
