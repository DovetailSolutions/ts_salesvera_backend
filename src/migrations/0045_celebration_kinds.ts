import { Sequelize } from "sequelize";

/**
 * Work anniversaries share the birthday engine (settings, idempotent daily
 * runs, delivery audit). Both tables get a "kind" — 'birthday' or
 * 'anniversary' — and every existing row is a birthday one:
 *   birthday_settings: one row per company per kind  (PK companyId, kind)
 *   birthday_runs:     one run per company, kind and local date
 * so a birthday and an anniversary on the same day are two separate
 * announcements, each published exactly once.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
      ALTER TABLE "birthday_settings" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(20) NOT NULL DEFAULT 'birthday';
      ALTER TABLE "birthday_settings" DROP CONSTRAINT IF EXISTS "birthday_settings_pkey";
      ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_pkey" PRIMARY KEY ("companyId", "kind");

      ALTER TABLE "birthday_runs" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(20) NOT NULL DEFAULT 'birthday';
      DROP INDEX IF EXISTS "birthday_runs_company_date_unique_idx";
      CREATE UNIQUE INDEX IF NOT EXISTS "birthday_runs_company_kind_date_unique_idx"
        ON "birthday_runs" ("companyId", "kind", "birthdayDate");
      `,
      { transaction }
    );
  });
}
