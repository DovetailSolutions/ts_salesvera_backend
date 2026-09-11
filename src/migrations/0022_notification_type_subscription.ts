import { Sequelize } from "sequelize";

/**
 * Adds "subscription" to the notifications.type enum so the existing
 * sendNotification()/NotificationDrawer/Topbar pipeline can carry
 * subscription/billing events (trial started, payment successful, plan
 * upgraded, etc. — see modules/subscription/subscription.service.ts) with
 * zero other changes to that pipeline. Kept as its own migration file —
 * Postgres does not allow ALTER TYPE ... ADD VALUE to run in the same
 * transaction/batch as other DDL (same reason 0016 is separate).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS 'subscription';
  `);
}
