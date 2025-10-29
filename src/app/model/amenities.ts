import { Sequelize, DataTypes, Model, Optional } from "sequelize";
export class Amenities extends Model{
  public id!:number;
  public type!:string;
}
export const AmenitiesModel = (sequelize: Sequelize) => {
  const Amenities = sequelize.define(
    "Amenities",
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
      tableName: "amenities",
      timestamps: true,
    }
  );
  return Amenities;
};