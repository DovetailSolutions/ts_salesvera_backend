import { Sequelize } from "sequelize";

/**
 * Travel-range expense claims: a sale_person can claim a travel expense
 * covering a date range (matching GET /travel-range) with the total distance
 * driven. All nullable so existing expenses are unaffected.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "startDate" DATE;
    ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "endDate" DATE;
    ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "totalDistance" FLOAT;
  `);
}
