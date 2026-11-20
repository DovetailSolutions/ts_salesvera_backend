import { Sequelize } from "sequelize";

/**
 * Two branches each replaced inventory_stock_movements' type CHECK with their
 * own list: 0049 (proforma stock) allowed proforma/proforma_reversal, and
 * 0047_tally_managed_stock allowed tally_sync. Whichever ran last removed the
 * other's types — on databases where 0047_tally ran after 0049, proforma
 * stock deduction was rejected by the constraint.
 *
 * Both files now carry the full list, and this migration sets it once more
 * for databases that already applied either of them. Only widens the
 * allowed set, so every existing row still satisfies it.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "inventory_stock_movements" DROP CONSTRAINT IF EXISTS "inventory_stock_movements_type_check";
    ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_type_check"
      CHECK ("type" IN ('sale', 'sale_reversal', 'adjustment', 'proforma', 'proforma_reversal', 'tally_sync'));
  `);
}
