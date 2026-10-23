import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config/dbConnection";

// ============================================================
// inventory_stock_movements — append-only ledger of every stock change on a
// sub-item (migration 0037_inventory_stock). quantity is signed: negative
// for a sale, positive for a sale reversal or an upward adjustment.
// ============================================================

export type StockMovementType = "sale" | "sale_reversal" | "adjustment";

export class StockMovement extends Model {
  public id!: number;
  public subCategoryId!: number;
  public quotationId!: number | null;
  public type!: StockMovementType;
  public quantity!: number;
  public balanceAfter!: number;
  public actorId!: number | null;
  public actorRole!: string | null;
  public note!: string | null;
  public readonly createdAt!: Date;
}

const numeric = (name: string) => ({
  type: DataTypes.DECIMAL(14, 3),
  allowNull: false,
  get(this: any) {
    const raw = this.getDataValue(name);
    return raw === null || raw === undefined ? null : Number(raw);
  },
});

StockMovement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    subCategoryId: { type: DataTypes.INTEGER, allowNull: false },
    quotationId: { type: DataTypes.INTEGER, allowNull: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    quantity: numeric("quantity"),
    balanceAfter: numeric("balanceAfter"),
    actorId: { type: DataTypes.INTEGER, allowNull: true },
    actorRole: { type: DataTypes.STRING(20), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: "inventory_stock_movements", modelName: "StockMovement", timestamps: true }
);
