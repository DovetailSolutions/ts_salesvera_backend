import { Sequelize } from "sequelize";

/**
 * SalesVera Lite / Pro / Advance feature tiers + paid add-ons.
 *
 * - subscription_plans.tier: LITE | PRO | ADVANCE. The feature list each
 *   tier unlocks lives in code (modules/subscription/planFeatures.ts) so the
 *   backend gate and the API that describes it can never disagree.
 *   Existing plan codes are kept as stable keys and mapped:
 *     BASIC → LITE, PROFESSIONAL → PRO, ENTERPRISE → ADVANCE,
 *     TRIAL → ADVANCE (a trial shows the whole product; every existing
 *     tenant is on TRIAL, so nobody loses a feature they use today).
 *   The three paid plans are renamed only while they still carry their
 *   original seed names, so a later manual rename is never overwritten.
 *
 * - subscription_addons: one row per add-on period for a tenant owner
 *   (same tenant key as subscriptions.userId). Rows are never deleted;
 *   cancelling sets status CANCELLED, so the table is also the add-on
 *   history. At most one ACTIVE row per tenant + add-on.
 *
 * - Grandfathering: tenants that already hold Tally-synced data (invoices
 *   or quotations with a Tally guid, outstanding-report rows, or Tally
 *   masters) get an ACTIVE TALLY add-on so the sync connector keeps working.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "tier" VARCHAR(20);

    UPDATE "subscription_plans" SET "tier" = CASE "planCode"
        WHEN 'BASIC' THEN 'LITE'
        WHEN 'PROFESSIONAL' THEN 'PRO'
        ELSE 'ADVANCE'
      END
    WHERE "tier" IS NULL;

    UPDATE "subscription_plans" SET "name" = 'SalesVera Lite',
      "description" = 'Attendance, HR, employee management and collaboration'
      WHERE "planCode" = 'BASIC' AND "name" = 'Basic';
    UPDATE "subscription_plans" SET "name" = 'SalesVera Pro',
      "description" = 'Everything in Lite, plus client visits, travel allowance and expenses'
      WHERE "planCode" = 'PROFESSIONAL' AND "name" = 'Professional';
    UPDATE "subscription_plans" SET "name" = 'SalesVera Advance',
      "description" = 'Everything in Pro, plus orders, inventory, assets, separation and business reports'
      WHERE "planCode" = 'ENTERPRISE' AND "name" = 'Enterprise';

    CREATE TABLE IF NOT EXISTS "subscription_addons" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES "users" ("id"),
      "addonCode" VARCHAR(30) NOT NULL,
      "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      "startDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endDate" TIMESTAMP WITH TIME ZONE,
      "grantedBy" INTEGER,
      "cancelledAt" TIMESTAMP WITH TIME ZONE,
      "cancelledBy" INTEGER,
      "notes" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "subscription_addons_status_check" CHECK ("status" IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
    );
    CREATE INDEX IF NOT EXISTS "subscription_addons_user_idx" ON "subscription_addons" ("userId");
    CREATE UNIQUE INDEX IF NOT EXISTS "subscription_addons_one_active_idx"
      ON "subscription_addons" ("userId", "addonCode") WHERE "status" = 'ACTIVE';

    INSERT INTO "subscription_addons" ("userId", "addonCode", "status", "notes")
    SELECT DISTINCT t.tenant, 'TALLY', 'ACTIVE', 'Granted automatically: tenant already had Tally-synced data when add-ons were introduced'
    FROM (
      SELECT COALESCE(u."tenantId", CASE WHEN u."role" = 'user' THEN u."id" END) AS tenant
      FROM "invoices" i JOIN "users" u ON u."id" = i."userId" WHERE i."guid" IS NOT NULL
      UNION
      SELECT COALESCE(u."tenantId", CASE WHEN u."role" = 'user' THEN u."id" END)
      FROM "quotations" q JOIN "users" u ON u."id" = q."userId" WHERE q."guid" IS NOT NULL
      UNION
      SELECT COALESCE(u."tenantId", CASE WHEN u."role" = 'user' THEN u."id" END)
      FROM "repost" r JOIN "users" u ON u."id" = r."userId"
      UNION
      SELECT COALESCE(u."tenantId", CASE WHEN u."role" = 'user' THEN u."id" END)
      FROM "tally_masters" m JOIN "users" u ON u."id" = m."user_id"
    ) t
    WHERE t.tenant IS NOT NULL
      AND EXISTS (SELECT 1 FROM "users" o WHERE o."id" = t.tenant AND o."role" = 'user')
    ON CONFLICT DO NOTHING;
  `);
}
