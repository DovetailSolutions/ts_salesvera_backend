import { Sequelize } from "sequelize";

/**
 * Birthday Celebrations — purely additive (two new tables, nothing existing
 * is altered).
 *
 * birthday_settings: one row per company. No row = feature disabled, so no
 * company starts receiving birthday announcements until an admin opts in.
 *
 * birthday_runs: one row per company per local calendar date. The UNIQUE
 * (companyId, birthdayDate) key is the idempotency guard — a second cron
 * tick, a restart or another backend instance can never claim the same day
 * twice. leaseUntil serialises processing of a claimed row across instances
 * (and lets a crashed attempt be resumed once the lease lapses); the
 * per-channel status columns let a retry resume only the unfinished channel
 * instead of re-publishing the announcement.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "birthday_settings" (
      "companyId" INTEGER PRIMARY KEY,
      "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
      "messageTemplate" TEXT,
      "pushEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "sendHour" SMALLINT NOT NULL DEFAULT 9,
      "updatedBy" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "birthday_runs" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "birthdayDate" DATE NOT NULL,
      "timezone" VARCHAR(64) NOT NULL,
      "celebrantIds" JSONB NOT NULL DEFAULT '[]',
      "recipientIds" JSONB NOT NULL DEFAULT '[]',
      "announcementId" INTEGER,
      "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
      "inAppStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "inAppDelivered" INTEGER NOT NULL DEFAULT 0,
      "inAppFailed" INTEGER NOT NULL DEFAULT 0,
      "socketStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "pushStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "pushSuccess" INTEGER NOT NULL DEFAULT 0,
      "pushFailure" INTEGER NOT NULL DEFAULT 0,
      "pushInvalidTokens" INTEGER NOT NULL DEFAULT 0,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "leaseUntil" TIMESTAMP WITH TIME ZONE,
      "processedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "birthday_runs_company_date_unique_idx" ON "birthday_runs" ("companyId", "birthdayDate");
    CREATE INDEX IF NOT EXISTS "birthday_runs_status_idx" ON "birthday_runs" ("status");
  `);
}
