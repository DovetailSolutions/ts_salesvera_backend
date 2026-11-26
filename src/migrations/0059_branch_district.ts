import { Sequelize } from "sequelize";

/**
 * Branch district (branch form → Full Address → District; filled from the
 * PIN-code lookup for Indian addresses, editable).
 *
 *   branches."branchDistrict"  VARCHAR(100) NULL
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "branchDistrict" VARCHAR(100);
  `);
}
