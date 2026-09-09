import { Sequelize } from "sequelize";

/**
 * Attendance Regularization — Sale Person-initiated correction requests for
 * missed/incorrect attendance, reviewed by Admin/Manager. See
 * app/model/attendanceRegularization.ts and modules/attendanceRegularization.
 *
 * Reuses existing infrastructure rather than duplicating it:
 * - Business ID sequence (businessId.service.ts) — new 'attendance_regularization'
 *   entity type, prefix REG.
 * - The existing attendance_audit_logs table — new nullable
 *   regularizationRequestId column, same append-only event trail the
 *   Attendance Security module already writes to.
 * - The existing attendance table — new attendanceSource/original(PunchIn|PunchOut)/
 *   regularizedFromRequestId columns, so an approved correction is visible
 *   and auditable directly on the row it corrected, not only in the
 *   separate regularization/audit tables.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
    VALUES ('attendance_regularization', 'REG', 1)
    ON CONFLICT ("entityType") DO NOTHING;

    CREATE TABLE IF NOT EXISTS "attendance_regularizations" (
      "id" SERIAL PRIMARY KEY,
      "businessCode" VARCHAR(20),
      "userId" INTEGER NOT NULL,
      "companyId" INTEGER,
      "attendanceId" INTEGER,
      "requestType" VARCHAR(20) NOT NULL,
      "attendanceDate" DATE NOT NULL,
      "requestedPunchIn" TIMESTAMP WITH TIME ZONE,
      "requestedPunchOut" TIMESTAMP WITH TIME ZONE,
      "reason" VARCHAR(255),
      "description" TEXT,
      "attachmentUrl" TEXT,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "submittedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reviewedAt" TIMESTAMP WITH TIME ZONE,
      "reviewedBy" INTEGER,
      "reviewComment" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "areg_business_code_idx" ON "attendance_regularizations" ("businessCode");
    CREATE INDEX IF NOT EXISTS "idx_areg_user_status" ON "attendance_regularizations" ("userId", "status");
    CREATE INDEX IF NOT EXISTS "idx_areg_company_status" ON "attendance_regularizations" ("companyId", "status");
    CREATE INDEX IF NOT EXISTS "idx_areg_date" ON "attendance_regularizations" ("attendanceDate");

    -- Duplicate-request prevention (mirrors migration 0017's device-change
    -- dedup index): at most one PENDING request per (user, date, type) —
    -- approved/rejected/cancelled history for the same date+type may
    -- accumulate freely, only one may be pending at a time.
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_areg_one_pending_per_date_type"
      ON "attendance_regularizations" ("userId", "attendanceDate", "requestType")
      WHERE "status" = 'pending';

    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "attendanceSource" VARCHAR(20) DEFAULT 'NORMAL';
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "originalPunchIn" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "originalPunchOut" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "regularizedFromRequestId" INTEGER;

    -- Existing rows predate this column and are real punches, not corrections.
    UPDATE "attendance" SET "attendanceSource" = 'NORMAL' WHERE "attendanceSource" IS NULL;

    ALTER TABLE "attendance_audit_logs" ADD COLUMN IF NOT EXISTS "regularizationRequestId" INTEGER;
  `);
}
