import { Sequelize } from "sequelize";

/**
 * Days a leave request takes from its balance, fixed when the request is
 * created under the attendance policy's sandwich / working-days rule — so
 * approval and a later cancellation deduct and restore exactly the same
 * number even if holidays, weekly offs or the policy change in between.
 * NULL (every existing request, and the default "count all days" rule)
 * keeps the previous calendar-day count.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "chargedDays" DOUBLE PRECISION NULL;
  `);
}
