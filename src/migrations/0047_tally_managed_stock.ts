import { Sequelize } from "sequelize";

/**
 * Tally-managed stock.
 *
 * When Tally sends a stock quantity for an item (POST /admin/bulk/stock-items),
 * that item's stock is owned by Tally: sale orders no longer deduct from it
 * and it can't be edited by hand in SalesVera.
 *
 *   - sub_categories."stockFromTally" defaults to FALSE, so every existing
 *     item keeps its current behaviour until Tally sends a quantity for it.
 *   - inventory_stock_movements gets a new "tally_sync" type for the ledger row
 *     written when a sync changes the quantity.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "sub_categories" ADD COLUMN IF NOT EXISTS "stockFromTally" BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE "inventory_stock_movements" DROP CONSTRAINT IF EXISTS "inventory_stock_movements_type_check";
    ALTER TABLE "inventory_stock_movements"
      ADD CONSTRAINT "inventory_stock_movements_type_check"
      CHECK ("type" IN ('sale', 'sale_reversal', 'adjustment', 'proforma', 'proforma_reversal', 'tally_sync'));
  `);
}
