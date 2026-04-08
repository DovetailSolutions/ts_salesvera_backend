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
}

export interface SubCategoryCreationAttributes
  extends Optional<SubCategoryAttributes, "id" | "status"> {}

export class SubCategory
  extends Model<SubCategoryAttributes, SubCategoryCreationAttributes>
  implements SubCategoryAttributes
{
  public id!: number;
  public sub_category_name!: string;
  public CategoryId!: number;
  public adminId!: number;
  public managerId!: number;
  public amount!: string;
  public text!: string;
  public hsnCode!: string;
  public status!: string;

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
          allowNull: false,
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
        status: {
          type: DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
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