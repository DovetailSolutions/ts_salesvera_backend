import { Sequelize } from "sequelize";

/**
 * Per-user Vehicle Allowance Rate override.
 *
 * company_vehicle_allowance_rates (migration 0023) covers the company-wide
 * rate, effective-dated. Some staff need a genuinely different rate than
 * the company default — including ₹0 (no travel allowance at all for that
 * person) — with no history requirement: it's just "this person's current
 * rate," changeable/clearable anytime. One row per user (unique userId);
 * absence of a row means "use the company rate."
 *
 * Deliberately NOT effective-dated like the company table — a simple
 * current-value override is what was actually asked for, and a stray
 * ratePerKm = 0 must be distinguishable from "no override" (hence a
 * nullable ratePerKm is wrong too — presence of the ROW is the override
 * flag, not the value being non-null).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "user_vehicle_allowance_rates" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "companyId" INTEGER,
      "ratePerKm" DOUBLE PRECISION NOT NULL,
      "createdBy" INTEGER,
      "updatedBy" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "idx_uvar_user_unique"
      ON "user_vehicle_allowance_rates" ("userId");

    CREATE INDEX IF NOT EXISTS "idx_uvar_company"
      ON "user_vehicle_allowance_rates" ("companyId");
  `);
}
