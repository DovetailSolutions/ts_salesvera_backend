import { Sequelize, DataTypes, Model, Optional } from "sequelize";

export interface SubCategoryAttributes {
  id: number;
  sub_category_name: string;
  CategoryId: number;
  adminId?: number;
  managerId?: number;
  amount?: string;
  text?: string;
  hsnCode?: string;
  status: string;
  gst: string
  unit?: string
  baseUnit?: string;
  secondaryUnit?: string;
  tallyGuid?: string;
  gstedit?: boolean;
  totaledit?: boolean;
  discount?: string;
  discountedit?: boolean;
  // Inventory (migration 0037): only trackStock items have stock that sale
  // orders reduce — see modules/inventory/inventory.service.ts.
  trackStock?: boolean;
  stockQuantity?: number | null;
  // Migration 0038: a tracked item may still be ordered at/below zero stock.
  allowOutOfStock?: boolean;
}

export interface SubCategoryCreationAttributes
  extends Optional<SubCategoryAttributes, "id" | "status"> { }

export class SubCategory
  extends Model<SubCategoryAttributes, SubCategoryCreationAttributes>
  implements SubCategoryAttributes {
  public id!: number;
  public sub_category_name!: string;
  public CategoryId!: number;
  public adminId!: number;
  public managerId!: number;
  public amount!: string;
  public text!: string;
  public hsnCode!: string;
  public status!: string;
  public gst!: string;
  public unit!: string;
  public baseUnit?: string;
  public secondaryUnit?: string;
  public tallyGuid?: string;
  public gstedit?: boolean;
  public totaledit?: boolean;
  public discount?: string;
  public trackStock?: boolean;
  public stockQuantity?: number | null;
  public allowOutOfStock?: boolean;
  static initModel(sequelize: Sequelize) {
    SubCategory.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        sub_category_name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        CategoryId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        adminId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        managerId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
        amount: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        text: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        hsnCode: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        gst: {
          type: DataTypes.STRING,
          allowNull: true
        },
        unit: {
          type: DataTypes.STRING,
          allowNull: true
        },
        baseUnit: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        secondaryUnit: {
          type: DataTypes.STRING,
          allowNull: true,
          field: "secondaryUnit",
        },
        tallyGuid: {
          type: DataTypes.STRING,
          allowNull: true,
          field: "tally_guid",
        },
        discount: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        discountedit: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        gstedit: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        totaledit: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        trackStock: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        stockQuantity: {
          type: DataTypes.DECIMAL(14, 3),
          allowNull: true,
          // pg returns NUMERIC as a string; expose a plain number.
          get(this: any) {
            const raw = this.getDataValue("stockQuantity");
            return raw === null || raw === undefined ? null : Number(raw);
          },
        },
        allowOutOfStock: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        status: {
          type: DataTypes.ENUM("draft", "sent", "accepted", "imported", "rejected"),
          defaultValue: "draft",
        },
      },
      {
        sequelize,
        tableName: "sub_categories",
        timestamps: true,
      }
    );
  }
}

export const SubCategoryModel = (sequelize: Sequelize) => {
  SubCategory.initModel(sequelize);
  return SubCategory;
};