import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface ShiftAttributes {
  id: number;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  adminId?: number;
  managerId?: number;
  userId?: number;
}

interface ShiftCreationAttributes extends Optional<ShiftAttributes, "id"> {}

export class Shift extends Model<ShiftAttributes, ShiftCreationAttributes>
  implements ShiftAttributes {
  public id!: number;
  public shiftName!: string;
  public shiftCode!: string;
  public startTime!: string;
  public endTime!: string;
  public adminId?: number;
  public managerId?: number;
  public userId?: number;
}

export const ShiftModel = (sequelize: Sequelize) => {
  const Shift = sequelize.define<Shift>(
    "Shift",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      shiftName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      shiftCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      startTime: {
        type: DataTypes.TIME, // better than string
        allowNull: false,
      },
      endTime: {
        type: DataTypes.TIME, // better than string
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
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "shifts",
      timestamps: true,
    }
  );

  return Shift;
};