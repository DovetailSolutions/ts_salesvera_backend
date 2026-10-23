import { Sequelize } from "sequelize";

/**
 * Inventory stock for sale orders — see src/modules/inventory/.
 *
 * Purely additive and safe for existing data:
 *   - sub_categories."trackStock" defaults to FALSE, so every existing
 *     sub-item keeps behaving exactly as before (a service-like line with no
 *     stock) until an admin switches tracking on for it.
 *   - sub_categories."stockQuantity" is NULL for every existing row.
 *   - inventory_stock_movements is a NEW, append-only ledger: one row per
 *     stock change ("sale" when an order is accepted, "sale_reversal" when it
 *     leaves accepted, "adjustment" when an admin edits the quantity). It is
 *     what makes a sale order's deduction idempotent and exactly reversible.
 *   - quotations is not altered, so sale order API responses are unchanged.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "sub_categories" ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "sub_categories" ADD COLUMN IF NOT EXISTS "stockQuantity" NUMERIC(14,3) NULL;

    CREATE TABLE IF NOT EXISTS "inventory_stock_movements" (
      "id" SERIAL PRIMARY KEY,
      "subCategoryId" INTEGER NOT NULL,
      "quotationId" INTEGER NULL,
      "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('sale', 'sale_reversal', 'adjustment')),
      "quantity" NUMERIC(14,3) NOT NULL,
      "balanceAfter" NUMERIC(14,3) NOT NULL,
      "actorId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "actorRole" VARCHAR(20),
      "note" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "inventory_stock_movements_quotation_idx"
      ON "inventory_stock_movements" ("quotationId", "id") WHERE "quotationId" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "inventory_stock_movements_item_idx"
      ON "inventory_stock_movements" ("subCategoryId", "createdAt" DESC);
  `);
}
