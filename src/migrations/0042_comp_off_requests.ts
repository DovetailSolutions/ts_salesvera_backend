import { Sequelize } from "sequelize";

/**
 * Comp-off an employee asks for themselves (e.g. worked a holiday without
 * punching) — source 'request' with their reason. Every existing row was
 * earned from attendance, so it keeps source 'attendance'. A 'request' row is
 * never changed by later attendance classification of that day.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "comp_off_credits" ADD COLUMN IF NOT EXISTS "source" VARCHAR(20) NOT NULL DEFAULT 'attendance';
    ALTER TABLE "comp_off_credits" ADD COLUMN IF NOT EXISTS "reason" VARCHAR(255) NULL;
  `);
}
