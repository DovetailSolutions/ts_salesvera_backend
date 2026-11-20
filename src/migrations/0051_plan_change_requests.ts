import { Sequelize } from "sequelize";

/**
 * Third tenant request kind: "plan_change" — the owner/admin asks Super Admin
 * to move the organisation to another plan (Lite / Pro / Advance). Reuses
 * access_extension_requests (same status machine, review queue, audit trail
 * and one-pending-per-type unique index from 0033).
 *
 *   currentPlanId    plan at the time of asking (snapshot for the reviewer)
 *   requestedPlanId  plan asked for
 *
 * Additive only: two nullable columns, and the payload CHECK is re-created
 * with the existing two branches unchanged plus the new one, so every
 * existing row still satisfies it.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "access_extension_requests"
      ADD COLUMN IF NOT EXISTS "currentPlanId" INTEGER NULL REFERENCES "subscription_plans" ("id"),
      ADD COLUMN IF NOT EXISTS "requestedPlanId" INTEGER NULL REFERENCES "subscription_plans" ("id");

    ALTER TABLE "access_extension_requests"
      DROP CONSTRAINT IF EXISTS "access_ext_req_type_payload_chk";
    ALTER TABLE "access_extension_requests"
      ADD CONSTRAINT "access_ext_req_type_payload_chk" CHECK (
        ("requestType" = 'duration' AND "requestedDurationDays" IS NOT NULL)
        OR
        ("requestType" = 'employee_limit' AND "requestedEmployeeLimit" IS NOT NULL)
        OR
        ("requestType" = 'plan_change' AND "requestedPlanId" IS NOT NULL)
      );
  `);
}
