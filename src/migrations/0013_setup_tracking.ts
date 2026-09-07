import { Sequelize } from "sequelize";

/**
 * Setup Tracking — tenant/company onboarding checklist override state +
 * append-only audit log. The checklist itself is computed live from
 * existing tables (see modules/setupTracking/setupTracking.service.ts);
 * these tables only persist an explicit complete/skip decision (who, when)
 * that can't be derived, plus the audit trail of every setup-related event.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "tenant_setup_status" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "overrideStatus" VARCHAR(20),
      "completedBy" INTEGER,
      "completedAt" TIMESTAMP WITH TIME ZONE,
      "skippedBy" INTEGER,
      "skippedAt" TIMESTAMP WITH TIME ZONE,
      "notes" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tenant_setup_status_user_unique" UNIQUE ("userId")
    );

    CREATE TABLE IF NOT EXISTS "company_setup_status" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "overrideStatus" VARCHAR(20),
      "completedBy" INTEGER,
      "completedAt" TIMESTAMP WITH TIME ZONE,
      "skippedBy" INTEGER,
      "skippedAt" TIMESTAMP WITH TIME ZONE,
      "notes" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "company_setup_status_company_unique" UNIQUE ("companyId")
    );

    CREATE TABLE IF NOT EXISTS "setup_audit_log" (
      "id" SERIAL PRIMARY KEY,
      "entityType" VARCHAR(10) NOT NULL,
      "entityId" INTEGER NOT NULL,
      "action" VARCHAR(20) NOT NULL,
      "actorId" INTEGER,
      "actorRole" VARCHAR(20),
      "detail" JSONB,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_setup_audit_entity" ON "setup_audit_log" ("entityType", "entityId", "createdAt");
  `);
}
