import { Sequelize, DataTypes, Model, Optional } from "sequelize";
export class FlatType extends Model{
  public id!:number;
  public type!:string;
}
export const FlatTypeModel = (sequelize: Sequelize) => {
  const FlatType = sequelize.define(
    "FlatType",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "flatType",
      timestamps: true,
    }
  );
  return FlatType;
};