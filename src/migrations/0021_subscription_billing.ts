import { Sequelize } from "sequelize";

/**
 * Subscription + billing system — a top-level tenant "user" (see
 * app/model/user.ts's tenantId) has exactly one live Subscription at a
 * time, tied to a SubscriptionPlan (Free Trial / Basic / Professional /
 * Enterprise, centrally configured here rather than hardcoded), and zero or
 * more Payment rows (one per Razorpay Order checkout attempt). See
 * modules/subscription/ for the service layer and businessId.service.ts for
 * the businessCode generator these three tables' beforeCreate hooks call.
 *
 * Same all-in-one style as 0018_business_id_system.ts: seed the new
 * business_id_sequences rows first, then CREATE TABLE IF NOT EXISTS for all
 * three tables with their indexes, then seed the 4 initial plan rows.
 *
 * "Unlimited" for a plan/subscription's maxAdmins/maxCompanies/maxManagers/
 * maxSalePersons is represented as SQL NULL, consistently, across both
 * subscription_plans and subscriptions (never -1, never 0, never a magic
 * string) — see subscriptionLimit.service.ts's assertCanCreate.
 *
 * Subscription rows are snapshotted (own maxAdmins/.../maxSalePersons
 * columns, not a live join to subscription_plans) so editing a plan's
 * limits later never retroactively changes an already-purchased
 * subscription's enforced limits — only a fresh checkout/upgrade picks up
 * the new numbers.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
    VALUES
      ('subscription_plan', 'PLAN', 1),
      ('subscription', 'SUB', 1),
      ('payment', 'PAY', 1)
    ON CONFLICT ("entityType") DO NOTHING;

    -- ── subscription_plans ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "subscription_plans" (
      "id" SERIAL PRIMARY KEY,
      "businessCode" VARCHAR(20),
      "planCode" VARCHAR(20) NOT NULL,
      "name" VARCHAR(100) NOT NULL,
      "description" TEXT,
      "price" NUMERIC(10,2),
      "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
      "billingInterval" VARCHAR(10),
      "trialDays" INTEGER,
      "maxAdmins" INTEGER,
      "maxCompanies" INTEGER,
      "maxManagers" INTEGER,
      "maxSalePersons" INTEGER,
      "features" JSONB NOT NULL DEFAULT '{}',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isTrialPlan" BOOLEAN NOT NULL DEFAULT false,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_business_code_idx" ON "subscription_plans" ("businessCode");
    CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_plan_code_idx" ON "subscription_plans" ("planCode");

    -- ── subscriptions ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" SERIAL PRIMARY KEY,
      "businessCode" VARCHAR(20),
      "userId" INTEGER NOT NULL REFERENCES "users"("id"),
      "planId" INTEGER NOT NULL REFERENCES "subscription_plans"("id"),
      "status" VARCHAR(20) NOT NULL DEFAULT 'TRIALING',
      "startDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
      "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
      "autoRenew" BOOLEAN NOT NULL DEFAULT true,
      "cancelledAt" TIMESTAMP WITH TIME ZONE,
      "maxAdmins" INTEGER,
      "maxCompanies" INTEGER,
      "maxManagers" INTEGER,
      "maxSalePersons" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_business_code_idx" ON "subscriptions" ("businessCode");
    CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("userId");
    CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" ("status");

    -- ── payments ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "payments" (
      "id" SERIAL PRIMARY KEY,
      "businessCode" VARCHAR(20),
      "userId" INTEGER NOT NULL REFERENCES "users"("id"),
      "subscriptionId" INTEGER REFERENCES "subscriptions"("id"),
      "planId" INTEGER NOT NULL REFERENCES "subscription_plans"("id"),
      "amount" NUMERIC(10,2) NOT NULL,
      "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
      "status" VARCHAR(20) NOT NULL DEFAULT 'CREATED',
      "purpose" VARCHAR(20) NOT NULL DEFAULT 'NEW',
      "razorpayOrderId" VARCHAR(64) NOT NULL,
      "razorpayPaymentId" VARCHAR(64),
      "razorpaySignature" VARCHAR(256),
      "method" VARCHAR(30),
      "notes" JSONB,
      "failureReason" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_business_code_idx" ON "payments" ("businessCode");
    -- Idempotency guardrails — verify-payment and the webhook both rely on
    -- these unique indexes to never double-activate/double-notify (a race
    -- between the two hitting the DB in either order fails the loser's
    -- insert/duplicate update instead of creating a second row).
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_order_id_idx" ON "payments" ("razorpayOrderId");
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_payment_id_idx" ON "payments" ("razorpayPaymentId") WHERE "razorpayPaymentId" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments" ("userId");
    CREATE INDEX IF NOT EXISTS "payments_subscription_id_idx" ON "payments" ("subscriptionId");

    -- ── seed plans (placeholder prices — confirm with business before go-live) ──
    INSERT INTO "subscription_plans"
      ("businessCode","planCode","name","description","price","currency","billingInterval","trialDays","maxAdmins","maxCompanies","maxManagers","maxSalePersons","features","isActive","isTrialPlan","sortOrder")
    VALUES
      ('PLAN001','TRIAL','Free Trial','3-month free trial for new accounts',0,'INR',NULL,90,1,1,1,10,'{"geofencing":true,"travel":true,"advancedReports":false}',true,true,0),
      ('PLAN002','BASIC','Basic','For small teams getting started',999.00,'INR','month',NULL,2,2,5,50,'{"geofencing":true,"travel":true,"advancedReports":false}',true,false,1),
      ('PLAN003','PROFESSIONAL','Professional','For growing organizations',2499.00,'INR','month',NULL,5,5,20,200,'{"geofencing":true,"travel":true,"advancedReports":true}',true,false,2),
      ('PLAN004','ENTERPRISE','Enterprise','Unlimited scale, custom pricing',NULL,'INR','month',NULL,NULL,NULL,NULL,NULL,'{"geofencing":true,"travel":true,"advancedReports":true}',true,false,3)
    ON CONFLICT ("planCode") DO NOTHING;

    UPDATE "business_id_sequences" SET "nextNumber" = 5, "updatedAt" = NOW() WHERE "entityType" = 'subscription_plan';
  `);
}
