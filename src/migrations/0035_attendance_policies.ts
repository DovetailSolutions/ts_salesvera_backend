import { Sequelize } from "sequelize";

/**
 * Attendance policies (strict / flexible modes, punch rules, missed
 * punch-out handling, half-day & short-leave rules) — see
 * src/modules/attendancePolicy/.
 *
 * Purely additive and safe for existing data:
 *   - attendance_policies is a NEW table. A company with no row keeps the
 *     exact attendance behaviour it had before this migration (the legacy
 *     shift/company thresholds in attendance.service.ts), so nothing changes
 *     until an admin saves a policy.
 *   - Rows are append-only versions: saving a policy inserts a new row with
 *     an effectiveFrom date instead of editing the old one, so the history of
 *     which rule applied when is kept, and a saved policy never rewrites
 *     past attendance (classification only ever happens at punch-out / the
 *     auto punch-out job, never retroactively).
 *   - shiftId NULL = the company-wide default; a row with a shiftId
 *     overrides it for employees on that shift.
 *   - New attendance / leave_requests columns are all NULLable or default
 *     false, so existing rows are untouched.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "attendance_policies" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "shiftId" INTEGER NULL,
      "mode" VARCHAR(10) NOT NULL CHECK ("mode" IN ('strict', 'flexible')),
      "effectiveFrom" DATE NOT NULL,
      "config" JSONB NOT NULL,
      "createdBy" INTEGER NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "attendance_policies_lookup_idx"
      ON "attendance_policies" ("companyId", "shiftId", "effectiveFrom" DESC, "id" DESC);

    -- Why a session got its status, and how it was closed.
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "statusReason" VARCHAR(255) NULL;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "autoPunchedOut" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "earlyDeparture" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "attendancePolicyId" INTEGER NULL;

    -- Which part of the day a half-day / short leave covers, and how long a
    -- short leave is. NULL for every existing request (full-day semantics).
    ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "leaveSession" VARCHAR(20) NULL;
    ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NULL;
  `);
}
