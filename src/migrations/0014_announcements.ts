import { Sequelize } from "sequelize";

/**
 * Announcements — hierarchy-aware broadcasts (User -> Admin/Manager,
 * Admin -> Manager/SalePerson, Manager -> SalePerson). priority/status are
 * plain VARCHAR (app-level enum) rather than a Postgres ENUM so new values
 * can be added later without an ALTER TYPE migration.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "announcements" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(255) NOT NULL,
      "message" TEXT NOT NULL,
      "createdBy" INTEGER NOT NULL,
      "creatorRole" VARCHAR(20) NOT NULL,
      "companyId" INTEGER NOT NULL,
      "priority" VARCHAR(10) NOT NULL DEFAULT 'normal',
      "status" VARCHAR(15) NOT NULL DEFAULT 'published',
      "scheduledAt" TIMESTAMP WITH TIME ZONE,
      "expiresAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "announcements_company_id_idx" ON "announcements" ("companyId");
    CREATE INDEX IF NOT EXISTS "announcements_created_by_idx" ON "announcements" ("createdBy");
    CREATE INDEX IF NOT EXISTS "announcements_status_scheduled_idx" ON "announcements" ("status", "scheduledAt");
  `);
}
