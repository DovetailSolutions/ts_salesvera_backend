import { Sequelize } from "sequelize";

/**
 * Branch email / phone are optional on the branch form ("Branch Email
 * (optional)", "Branch Phone (optional)") but the columns were NOT NULL, so
 * the API demanded them ("Valid branch email is required"). Make them
 * nullable; when given they are still validated by branch.service.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "branches" ALTER COLUMN "branchEmail" DROP NOT NULL;
    ALTER TABLE "branches" ALTER COLUMN "branchPhone" DROP NOT NULL;
  `);
}
