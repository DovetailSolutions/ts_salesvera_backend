import { Sequelize } from "sequelize";

/**
 * Adds "announcement" to the notifications.type enum so the existing
 * sendNotification()/NotificationDrawer/Topbar pipeline can carry
 * announcement pushes with zero other changes to that pipeline.
 * Kept as its own migration file — Postgres does not allow ALTER TYPE ...
 * ADD VALUE to run in the same transaction/batch as other DDL.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS 'announcement';
  `);
}
