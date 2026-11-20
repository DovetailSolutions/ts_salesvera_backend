import { Sequelize } from "sequelize";

/**
 * Optional attachment on a separation request (e.g. a signed resignation
 * letter as an image or PDF), uploaded with POST /admin/separation/my.
 * Additive only: three nullable columns, existing rows unchanged.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "separation_requests" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT NULL;
    ALTER TABLE "separation_requests" ADD COLUMN IF NOT EXISTS "attachmentName" VARCHAR(255) NULL;
    ALTER TABLE "separation_requests" ADD COLUMN IF NOT EXISTS "attachmentType" VARCHAR(100) NULL;
  `);
}
