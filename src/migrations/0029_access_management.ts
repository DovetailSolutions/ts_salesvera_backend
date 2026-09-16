import { Sequelize } from "sequelize";

/**
 * Access-management layer on top of the existing (but never actually wired
 * up) subscription/billing system from migration 0021:
 *
 * 1. Renames subscriptions.maxSalePersons / subscription_plans.maxSalePersons
 *    -> maxEmployees, matching the users.role rename already done in
 *    migration 0028 (users.role: sale_person -> employee). Column rename
 *    only — no data change, no code path depends on the old name surviving.
 *
 * 2. access_extension_requests — a tenant ("user" role) asks Super Admin
 *    for more time and/or higher role limits before/after their
 *    subscription expires. One row per request; status transitions
 *    pending -> approved|rejected|cancelled, enforced at the service layer
 *    (see modules/accessExtension/).
 *
 * 3. access_audit_log — append-only trail of Super-Admin-level access
 *    changes (limit edits, expiry edits, suspend/reactivate, extension
 *    approve/reject). Same shape/conventions as setup_audit_log
 *    (app/model/setupAuditLog.ts) — entityType/entityId/action/actor/detail
 *    JSONB — reused deliberately instead of inventing a new audit shape.
 *
 * 4. Backfill: every existing "user"-role tenant has ZERO subscription rows
 *    today (the subscription system was modeled and seeded with plans in
 *    0021, but nothing ever actually created a Subscription row for a
 *    tenant — confirmed against the live database before writing this
 *    migration). Wiring subscription-limit enforcement into
 *    register()/addCompany() (this task) would otherwise instantly lock
 *    EVERY existing tenant out of creating any admin/manager/employee/
 *    company the moment this ships. Backfilled with an unlimited,
 *    long-dated ACTIVE row (NULL limits = unlimited, same convention
 *    subscriptionLimit.service.ts already uses) so no existing tenant's
 *    behavior changes — Super Admin can later assign any of them a real,
 *    limited plan through the new access-management UI. Only BRAND NEW
 *    tenant signups from here on start on the real seeded TRIAL plan (see
 *    auth.service.ts's register()).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
    VALUES ('access_extension_request', 'EXT', 1)
    ON CONFLICT ("entityType") DO NOTHING;
  `);

  await sequelize.query(`
    ALTER TABLE "subscriptions" RENAME COLUMN "maxSalePersons" TO "maxEmployees";
  `).catch((e: any) => {
    // Already renamed (re-run safety) or column genuinely absent — surface
    // anything else.
    if (!/does not exist/i.test(e.message)) throw e;
  });

  await sequelize.query(`
    ALTER TABLE "subscription_plans" RENAME COLUMN "maxSalePersons" TO "maxEmployees";
  `).catch((e: any) => {
    if (!/does not exist/i.test(e.message)) throw e;
  });

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "access_extension_requests" (
      "id" SERIAL PRIMARY KEY,
      "publicId" VARCHAR(20),
      "requestedByUserId" INTEGER NOT NULL REFERENCES "users"("id"),
      "ownerUserId" INTEGER NOT NULL REFERENCES "users"("id"),
      "subscriptionId" INTEGER REFERENCES "subscriptions"("id"),
      "requestedDurationDays" INTEGER NOT NULL,
      "reason" TEXT NOT NULL,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "reviewedBy" INTEGER REFERENCES "users"("id"),
      "reviewedAt" TIMESTAMP WITH TIME ZONE,
      "reviewComment" TEXT,
      "previousExpiresAt" TIMESTAMP WITH TIME ZONE,
      "approvedExpiresAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "access_ext_req_public_id_idx" ON "access_extension_requests" ("publicId");
    CREATE INDEX IF NOT EXISTS "access_ext_req_owner_idx" ON "access_extension_requests" ("ownerUserId");
    CREATE INDEX IF NOT EXISTS "access_ext_req_status_idx" ON "access_extension_requests" ("status");
    -- One PENDING request per tenant at a time — a partial unique index
    -- (rather than an application-only check) so a duplicate-submit race
    -- can't create two pending rows for the same tenant even under
    -- concurrent requests.
    CREATE UNIQUE INDEX IF NOT EXISTS "access_ext_req_one_pending_per_owner"
      ON "access_extension_requests" ("ownerUserId")
      WHERE "status" = 'pending';
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "access_audit_log" (
      "id" SERIAL PRIMARY KEY,
      "entityType" VARCHAR(30) NOT NULL,
      "entityId" INTEGER NOT NULL,
      "action" VARCHAR(40) NOT NULL,
      "actorId" INTEGER REFERENCES "users"("id"),
      "actorRole" VARCHAR(20),
      "previousValue" JSONB,
      "newValue" JSONB,
      "reason" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "access_audit_log_entity_idx" ON "access_audit_log" ("entityType", "entityId", "createdAt");
  `);

  // ── Backfill: one unlimited, non-expiring ACTIVE subscription for every
  // existing tenant that has none yet. Uses the seeded TRIAL plan's id
  // purely as a foreign key target (planId is NOT NULL) — every limit
  // column is explicitly NULL (unlimited) regardless of what that plan
  // itself specifies, and endDate is set 100 years out, so this is really
  // "grandfathered, unrestricted" rather than "on the trial plan" in any
  // meaningful sense. A fresh install with no rows in subscription_plans
  // yet (migration 0021 not run) has nothing to backfill against — guarded
  // below rather than failing the whole migration.
  const [[trialPlan]]: any = await sequelize.query(`
    SELECT id FROM "subscription_plans" ORDER BY id ASC LIMIT 1;
  `);

  if (trialPlan?.id) {
    await sequelize.query(`
      INSERT INTO "subscriptions"
        ("userId","planId","status","startDate","endDate","maxAdmins","maxCompanies","maxManagers","maxEmployees","autoRenew")
      SELECT u.id, :planId, 'ACTIVE', NOW(), NOW() + INTERVAL '100 years', NULL, NULL, NULL, NULL, false
      FROM "users" u
      WHERE u.role = 'user'
        AND NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."userId" = u.id);
    `, { replacements: { planId: trialPlan.id } });
  }
}
