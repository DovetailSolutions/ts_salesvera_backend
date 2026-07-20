import { Sequelize } from "sequelize";

/**
 * Adds the three approval/carry-forward toggles Step5.jsx's "Casual Holiday
 * Settings" and "Comp Off" sections present — previously plain local
 * useState in the component, not even part of the submitted form data.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "casualHolidayApprovalRequired" BOOLEAN DEFAULT true;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "casualHolidayCarryForward" BOOLEAN DEFAULT false;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "compOffApprovalRequired" BOOLEAN DEFAULT true;
  `);
}
