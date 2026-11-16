import { Sequelize } from "sequelize";

/**
 * The ledger's type check (0037) only knew sale order rows. Proforma
 * invoices (0048) write "proforma" / "proforma_reversal" rows too.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "inventory_stock_movements" DROP CONSTRAINT IF EXISTS "inventory_stock_movements_type_check";
    ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_type_check"
      CHECK ("type" IN ('sale', 'sale_reversal', 'adjustment', 'proforma', 'proforma_reversal'));
  `);
}
