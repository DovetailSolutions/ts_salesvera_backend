import { Sequelize } from "sequelize";

/**
 * Extends the access-request workflow from migration 0029 to cover
 * EMPLOYEE-LIMIT increases, not just subscription-expiry extensions.
 *
 * 0029's access_extension_requests could only ever say "give me N more
 * days" (requestedDurationDays NOT NULL) — raising a tenant's employee
 * limit was a Super-Admin-only direct PATCH with no request/approval
 * workflow behind it, so a tenant that hit its employee cap had no
 * in-product way to ask for more. Rather than add a second, near-identical
 * requests table, the existing one grows a discriminator:
 *
 *   requestType = 'duration'       -> requestedDurationDays  (0029 behaviour)
 *   requestType = 'employee_limit' -> requestedEmployeeLimit (new)
 *
 * so one table, one status machine, one audit trail and one Super Admin
 * review queue keep serving both. Every pre-existing row is a duration
 * request by definition, which is exactly what the column default
 * backfills.
 *
 * requestedDurationDays is relaxed to NULL because an employee-limit
 * request has no duration to carry; the service layer requires exactly the
 * field matching the row's requestType (see accessExtension.service.ts).
 *
 * The 0029 partial unique index allowed only ONE pending request per tenant
 * of ANY kind, which would make a pending expiry extension block an urgent
 * employee-limit request (and vice versa). Re-scoped to one pending request
 * per tenant PER TYPE — still a DB-level guarantee against duplicate-submit
 * races, just no longer a cross-purpose one.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "access_extension_requests"
      ADD COLUMN IF NOT EXISTS "requestType" VARCHAR(20) NOT NULL DEFAULT 'duration',
      ADD COLUMN IF NOT EXISTS "currentEmployeeLimit" INTEGER,
      ADD COLUMN IF NOT EXISTS "requestedEmployeeLimit" INTEGER,
      ADD COLUMN IF NOT EXISTS "approvedEmployeeLimit" INTEGER;
  `);

  await sequelize.query(`
    ALTER TABLE "access_extension_requests"
      ALTER COLUMN "requestedDurationDays" DROP NOT NULL;
  `);

  // Guards the discriminator at the DB level so neither a future code path
  // nor a manual UPDATE can leave a row that carries neither payload (or
  // the wrong one for its type) — the service layer validates the same
  // thing, this is the backstop.
  await sequelize.query(`
    ALTER TABLE "access_extension_requests"
      DROP CONSTRAINT IF EXISTS "access_ext_req_type_payload_chk";
    ALTER TABLE "access_extension_requests"
      ADD CONSTRAINT "access_ext_req_type_payload_chk" CHECK (
        ("requestType" = 'duration' AND "requestedDurationDays" IS NOT NULL)
        OR
        ("requestType" = 'employee_limit' AND "requestedEmployeeLimit" IS NOT NULL)
      );
  `);

  await sequelize.query(`
    DROP INDEX IF EXISTS "access_ext_req_one_pending_per_owner";
    CREATE UNIQUE INDEX IF NOT EXISTS "access_ext_req_one_pending_per_owner_type"
      ON "access_extension_requests" ("ownerUserId", "requestType")
      WHERE "status" = 'pending';
  `);

  // Drives the expiry-warning cron's "which tenants are approaching expiry"
  // sweep (config/cronJobs.ts) — a status+endDate scan over every
  // subscription row, run daily.
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "subscriptions_status_end_date_idx"
      ON "subscriptions" ("status", "endDate");
  `);
}
