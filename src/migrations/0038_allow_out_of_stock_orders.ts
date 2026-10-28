import { Sequelize } from "sequelize";

/**
 * Per-item "Allow orders when out of stock" switch for stock-tracked items.
 *
 * Purely additive: defaults to FALSE, so every existing item keeps today's
 * behaviour (a tracked item can't be ordered beyond its stock). When an admin
 * turns it on, sale orders may take the item's stock below zero — the
 * negative balance is what's owed (a backorder).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "sub_categories" ADD COLUMN IF NOT EXISTS "allowOutOfStock" BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}
