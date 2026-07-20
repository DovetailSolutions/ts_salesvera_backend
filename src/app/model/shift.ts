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
  companyId?: number;
  branchId?: number;
  fullDayHours: number;
  nightShift: boolean;
  breakMinutes?: number;
  workingHours?: number;
  lateMarkAfter?: number;
  halfDayAfter?: number;
}

interface ShiftCreationAttributes extends Optional<ShiftAttributes, "id"> {}

export class Shift extends Model<ShiftAttributes, ShiftCreationAttributes>
  implements ShiftAttributes {
  public id!: number;
  public shiftName!: string;
  public shiftCode!: string;
  public startTime!: string;
  public endTime!: string;
  public fullDayHours!: number;
  public nightShift!: boolean;
  public adminId?: number;
  public managerId?: number;
  public userId?: number;
  public companyId?: number;
  public branchId?: number;
  public breakMinutes?: number;
  public workingHours?: number;
  public lateMarkAfter?: number;
  public halfDayAfter?: number;
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
      companyId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      fullDayHours: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      nightShift: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      branchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      breakMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      workingHours: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 8,
      },
      lateMarkAfter: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      halfDayAfter: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
    },
    {
      tableName: "shifts",
      timestamps: true,
    }
  );

  return Shift;
};