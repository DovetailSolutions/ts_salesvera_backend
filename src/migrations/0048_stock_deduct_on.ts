import { Sequelize } from "sequelize";

/**
 * Per-item choice of which document takes a stock-tracked item's stock:
 *   'sale_order'       — a sale order (the existing behaviour, the default)
 *   'proforma_invoice' — a proforma invoice instead
 * Every existing item stays on 'sale_order', so nothing changes for it.
 *
 * Proforma stock movements are written to the same ledger, keyed by
 * invoiceId (sale order rows keep using quotationId).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "sub_categories" ADD COLUMN IF NOT EXISTS "stockDeductOn" VARCHAR(20) NOT NULL DEFAULT 'sale_order';
    ALTER TABLE "inventory_stock_movements" ADD COLUMN IF NOT EXISTS "invoiceId" INTEGER;
    CREATE INDEX IF NOT EXISTS "inventory_stock_movements_invoice_idx" ON "inventory_stock_movements" ("invoiceId");
  `);
}
