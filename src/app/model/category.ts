import { Sequelize, DataTypes, Model, Optional } from "sequelize";
export class Category extends Model{
  public id!:number;
  public category_name!:string;
  public adminId!: number;
  public managerId!:number
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
       adminId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
       managerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "categories",
      timestamps: true,
    }
  );
  return Category;
};
