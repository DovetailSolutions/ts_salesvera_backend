import { Sequelize } from "sequelize";

/**
 * When the "your comp-off expires soon" reminder went out for an approved
 * comp-off — set by a conditional UPDATE, so the daily job sends it once
 * across restarts and multiple server instances. NULL = not sent yet.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "comp_off_credits" ADD COLUMN IF NOT EXISTS "expiryReminderSentAt" TIMESTAMPTZ NULL;
  `);
}
