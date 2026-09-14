import { Sequelize } from "sequelize";

/**
 * Effective-dated Vehicle Allowance Rate history.
 *
 * Company.vehicleAllowanceRatePerKm (migration 0010) is a single ₹/km value
 * with no history — every payout calculation read it as-is, so raising the
 * rate today silently changed the computed allowance for every past travel
 * record too (they're recalculated on read, not stored as a locked total —
 * see travelDistance.service.ts). This table gives each rate an
 * effectiveFrom date so a lookup for a specific travel date always resolves
 * to the rate that was actually in force on that date, and past periods
 * stay correct after a later rate change.
 *
 * Company.vehicleAllowanceRatePerKm is kept (not dropped) and continues to
 * be maintained as "the current effective rate" for any code that reads it
 * directly — this table is the source of truth for historical/scheduled
 * lookups, not a competing one.
 *
 * One row per (companyId, effectiveFrom) — enforced by a unique index, so
 * "add a new rate for a date that already has one" is a deterministic
 * update, never a duplicate.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "company_vehicle_allowance_rates" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "ratePerKm" DOUBLE PRECISION NOT NULL,
      "effectiveFrom" DATE NOT NULL,
      "createdBy" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "idx_cvar_company_effective_unique"
      ON "company_vehicle_allowance_rates" ("companyId", "effectiveFrom");

    CREATE INDEX IF NOT EXISTS "idx_cvar_company_effective_lookup"
      ON "company_vehicle_allowance_rates" ("companyId", "effectiveFrom" DESC);
  `);

  // Backfill: every company that already has a vehicleAllowanceRatePerKm
  // gets one history row so existing travel dates resolve correctly instead
  // of falling through to the generic default. effectiveFrom is backdated
  // to the company's own creation date (date-only) — the earliest date any
  // of its travel records could possibly have — rather than "today", so a
  // lookup for an old travel date still finds this rate instead of nothing.
  await sequelize.query(`
    INSERT INTO "company_vehicle_allowance_rates" ("companyId", "ratePerKm", "effectiveFrom", "createdAt", "updatedAt")
    SELECT "id", "vehicleAllowanceRatePerKm", "createdAt"::date, NOW(), NOW()
    FROM "companies"
    WHERE "vehicleAllowanceRatePerKm" IS NOT NULL
    ON CONFLICT ("companyId", "effectiveFrom") DO NOTHING;
  `);
}
