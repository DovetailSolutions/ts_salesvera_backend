import { Sequelize, DataTypes, Model, Optional } from "sequelize";

export interface CategoryAttributes {
  id: number;
  category_name: string;
  adminId?: number;
  managerId?: number;
  status: string;
}

export interface CategoryCreationAttributes
  extends Optional<CategoryAttributes, "id" | "status"> {}

export class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  public id!: number;
  public category_name!: string;
  public adminId!: number;
  public managerId!: number;
  public status!: string;

  static initModel(sequelize: Sequelize) {
    Category.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        category_name: {
          type: DataTypes.STRING,
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
        status: {
          type: DataTypes.ENUM("draft", "sent", "accepted","imported", "rejected"),
          defaultValue: "draft",
        },
      },
      {
        sequelize,
        tableName: "categories",
        timestamps: true,
      }
    );
  }
}

export const CategoryModel = (sequelize: Sequelize) => {
  Category.initModel(sequelize);
  return Category;
};
