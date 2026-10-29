import { Sequelize } from "sequelize";

/**
 * Comp-off earned by working on a weekly off or holiday — one row per
 * employee per worked day (UNIQUE), so re-classifying the day updates the
 * same credit instead of adding another. The employee's "Comp Off" leave
 * balance (employee_leave_type_balances.allocated) is recomputed from these
 * rows: approved/expired days minus the part that expired unused.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "comp_off_credits" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "employeeId" INTEGER NOT NULL,
      "companyLeaveId" INTEGER NOT NULL,
      "workDate" DATE NOT NULL,
      "year" INTEGER NOT NULL,
      "days" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "expiresOn" DATE NULL,
      "expiredDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "note" VARCHAR(255) NULL,
      "reviewedBy" INTEGER NULL,
      "reviewedAt" TIMESTAMPTZ NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "comp_off_credits_employee_day" UNIQUE ("employeeId", "workDate")
    );
    CREATE INDEX IF NOT EXISTS "comp_off_credits_company_status" ON "comp_off_credits" ("companyId", "status");
    CREATE INDEX IF NOT EXISTS "comp_off_credits_expiry" ON "comp_off_credits" ("status", "expiresOn");
  `);
}
