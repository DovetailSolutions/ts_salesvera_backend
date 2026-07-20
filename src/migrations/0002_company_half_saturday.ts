import { Sequelize } from "sequelize";

/**
 * Adds a company-wide "half day Saturday" default. Department already has
 * its own halfSaturday (per-department override), but Step3.jsx also
 * collects a company-wide default toggle that had nowhere to persist.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "halfSaturday" BOOLEAN DEFAULT false;
  `);
}
