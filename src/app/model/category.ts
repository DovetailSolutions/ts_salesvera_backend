import { Sequelize, DataTypes, Model, Optional } from "sequelize";
export class Category extends Model{
  public id!:number;
  public category_name!:string;
}
export const CategoryModel = (sequelize: Sequelize) => {
  const Category = sequelize.define(
    "Category",
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
    },
    {
      tableName: "categories",
      timestamps: true,
    }
  );
  return Category;
};
