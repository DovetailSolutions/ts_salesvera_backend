import { Sequelize } from "sequelize";

/**
 * Proforma → Invoice finalization. A proforma invoice stays in the proforma
 * list as-is (its status is untouched); finalizing it only flips
 * isFinalized, and the Invoice page lists only finalized rows.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "isFinalized" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "finalizedBy" INTEGER;
  `);
}
