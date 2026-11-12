import { Sequelize } from "sequelize";

/**
 * Separation Management — see src/modules/separation/.
 *
 * Purely additive: three NEW tables, no existing table or row is altered.
 *
 *   separation_policies    — one row per company: the notice-period policy.
 *                            Missing row = built-in defaults (service).
 *   separation_requests    — one row per resignation. The policy that was
 *                            applied at approval is frozen in
 *                            "policySnapshot" / "noticeDays", so a later
 *                            policy change never alters an approved request.
 *                            "requestedLastWorkingDay" (what the applicant
 *                            asked for), "expectedLastWorkingDay" (what the
 *                            policy calculates) and "approvedLastWorkingDay"
 *                            (the official one) are kept separately.
 *   separation_audit_logs  — append-only history of every status change and
 *                            decision (actor, role, from → to, comment, meta).
 *
 * "employeeId" etc. deliberately have no ON DELETE CASCADE — separation
 * history must outlive anything else.
 *
 * The partial unique index allows at most ONE active (not rejected /
 * withdrawn / completed) request per employee, enforced by the database
 * itself, so two simultaneous submissions can't both succeed.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "separation_policies" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL UNIQUE REFERENCES "companies"("id") ON DELETE CASCADE,
      "defaultNoticeDays" INTEGER NOT NULL DEFAULT 30 CHECK ("defaultNoticeDays" BETWEEN 0 AND 365),
      "employeeNoticeDays" INTEGER NULL CHECK ("employeeNoticeDays" BETWEEN 0 AND 365),
      "managerNoticeDays" INTEGER NULL CHECK ("managerNoticeDays" BETWEEN 0 AND 365),
      "noticeStartsFrom" VARCHAR(20) NOT NULL DEFAULT 'submission' CHECK ("noticeStartsFrom" IN ('submission', 'approval')),
      "dayCountMode" VARCHAR(20) NOT NULL DEFAULT 'calendar' CHECK ("dayCountMode" IN ('calendar', 'working')),
      "allowProposedLastDay" BOOLEAN NOT NULL DEFAULT TRUE,
      "allowEarlyRelease" BOOLEAN NOT NULL DEFAULT TRUE,
      "allowWaiver" BOOLEAN NOT NULL DEFAULT FALSE,
      "allowAdminOverride" BOOLEAN NOT NULL DEFAULT TRUE,
      "updatedBy" INTEGER NULL REFERENCES "users"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "separation_requests" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL REFERENCES "companies"("id"),
      "employeeId" INTEGER NOT NULL REFERENCES "users"("id"),
      "applicantRole" VARCHAR(20) NOT NULL,
      "managerId" INTEGER NULL REFERENCES "users"("id"),
      "reason" VARCHAR(40) NOT NULL,
      "comments" TEXT NULL,
      "resignationDate" DATE NOT NULL,
      "requestedLastWorkingDay" DATE NULL,
      "status" VARCHAR(30) NOT NULL CHECK ("status" IN (
        'pending_manager_approval', 'pending_admin_approval', 'approved', 'rejected', 'withdrawn',
        'notice_period', 'handover_pending', 'clearance_pending', 'completed')),
      "noticeDays" INTEGER NULL,
      "noticeStartDate" DATE NULL,
      "expectedLastWorkingDay" DATE NULL,
      "approvedLastWorkingDay" DATE NULL,
      "policySnapshot" JSONB NULL,
      "lwdAdjustment" VARCHAR(20) NULL CHECK ("lwdAdjustment" IN ('override', 'early_release', 'waiver')),
      "lwdAdjustmentReason" TEXT NULL,
      "lwdAdjustedBy" INTEGER NULL REFERENCES "users"("id"),
      "lwdAdjustedAt" TIMESTAMPTZ NULL,
      "managerDecisionBy" INTEGER NULL REFERENCES "users"("id"),
      "managerDecisionAt" TIMESTAMPTZ NULL,
      "managerComment" TEXT NULL,
      "adminDecisionBy" INTEGER NULL REFERENCES "users"("id"),
      "adminDecisionAt" TIMESTAMPTZ NULL,
      "adminComment" TEXT NULL,
      "handoverStatus" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("handoverStatus" IN ('pending', 'completed', 'waived')),
      "handoverNotes" TEXT NULL,
      "handoverBy" INTEGER NULL REFERENCES "users"("id"),
      "handoverAt" TIMESTAMPTZ NULL,
      "clearanceStatus" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("clearanceStatus" IN ('pending', 'completed', 'waived')),
      "clearanceNotes" TEXT NULL,
      "clearanceBy" INTEGER NULL REFERENCES "users"("id"),
      "clearanceAt" TIMESTAMPTZ NULL,
      "withdrawnBy" INTEGER NULL REFERENCES "users"("id"),
      "withdrawnAt" TIMESTAMPTZ NULL,
      "withdrawReason" TEXT NULL,
      "completedBy" INTEGER NULL REFERENCES "users"("id"),
      "completedAt" TIMESTAMPTZ NULL,
      "accountDeactivatedAt" TIMESTAMPTZ NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "separation_requests_one_active"
      ON "separation_requests" ("employeeId")
      WHERE "status" NOT IN ('rejected', 'withdrawn', 'completed');
    CREATE INDEX IF NOT EXISTS "separation_requests_company_status"
      ON "separation_requests" ("companyId", "status");
    CREATE INDEX IF NOT EXISTS "separation_requests_manager"
      ON "separation_requests" ("managerId", "status");
    CREATE INDEX IF NOT EXISTS "separation_requests_lwd"
      ON "separation_requests" ("status", "approvedLastWorkingDay");

    CREATE TABLE IF NOT EXISTS "separation_audit_logs" (
      "id" SERIAL PRIMARY KEY,
      "requestId" INTEGER NOT NULL REFERENCES "separation_requests"("id"),
      "companyId" INTEGER NOT NULL,
      "actorId" INTEGER NULL REFERENCES "users"("id") ON DELETE SET NULL,
      "actorRole" VARCHAR(20) NULL,
      "action" VARCHAR(40) NOT NULL,
      "fromStatus" VARCHAR(30) NULL,
      "toStatus" VARCHAR(30) NULL,
      "comment" TEXT NULL,
      "meta" JSONB NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "separation_audit_logs_request"
      ON "separation_audit_logs" ("requestId", "createdAt", "id");
  `);
}
