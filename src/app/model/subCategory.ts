import { Sequelize, DataTypes, Model } from "sequelize";

export class SubCategory extends Model {
  public id!: number;
  public sub_category_name!: string;
  public CategoryId!: number;
  public adminId!: number;
  public managerId!: number;
  public amount!: string;
  public text!: string;
}

export const SubCategoryModel = (sequelize: Sequelize) => {
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
    },
    {
      sequelize,
      tableName: "sub_categories",
      timestamps: true,
    }
  );

  return SubCategory;
};