import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface HolidayAttributes {
  id: number;
  holidayName: string;
  holidayDate: Date;
  holidayType: string;
  branchId?: number;   // FK instead of "All"
  description?: string;
  adminId?: number;
  managerId?: number;
  userId?: number;
}

interface HolidayCreationAttributes
  extends Optional<HolidayAttributes, "id"> {}

export class Holiday
  extends Model<HolidayAttributes, HolidayCreationAttributes>
  implements HolidayAttributes {
  public id!: number;
  public holidayName!: string;
  public holidayDate!: Date;
  public holidayType!: string;
  public branchId?: number;
  public description?: string;
  public adminId?: number;
  public managerId?: number;
  public userId?: number;
}

export const HolidayModel = (sequelize: Sequelize) => {
  const Holiday = sequelize.define<Holiday>(
    "Holiday",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      holidayName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      holidayDate: {
        type: DataTypes.DATEONLY, // ✅ correct for date like "2026-03-04"
        allowNull: false,
      },
      holidayType: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // 🔗 Relation
      branchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true, // null = All branches
      },

      description: {
        type: DataTypes.TEXT,
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
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "holidays",
      timestamps: true,
    }
  );

  return Holiday;
};