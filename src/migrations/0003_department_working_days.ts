import { Sequelize } from "sequelize";

/**
 * Adds per-department working-day overrides. Step4.jsx already collects
 * these (a department can inherit the company-wide working days from Step3,
 * or set its own custom days) and the wizard already sends them, but the
 * Department model/table had no matching columns — silently discarded.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "workingDays" JSONB;
    ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "customWorkingDays" BOOLEAN DEFAULT false;
  `);
}
