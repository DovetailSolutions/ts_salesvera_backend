import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface DepartmentAttributes {
  id: number;
  deptName: string;
  deptCode: string;
  deptHead: string;
  branchId?: number;      // FK instead of "All"
  shiftId?: number;       // FK instead of "Morning shift"
  maxHeadcount: number;
  halfSaturday: boolean;
  adminId?: number;
  managerId?: number;
  userId?: number;
  companyId?: number;

}

interface DepartmentCreationAttributes
  extends Optional<DepartmentAttributes, "id"> {}

export class Department
  extends Model<DepartmentAttributes, DepartmentCreationAttributes>
  implements DepartmentAttributes {
  public id!: number;
  public deptName!: string;
  public deptCode!: string;
  public deptHead!: string;
  public branchId?: number;
  public shiftId?: number;
  public maxHeadcount!: number;
  public halfSaturday!: boolean;
  public adminId?: number;
  public managerId?: number;
  public userId?: number;
  public companyId?: number;

}

export const DepartmentModel = (sequelize: Sequelize) => {
  const Department = sequelize.define<Department>(
    "Department",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      deptName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      deptCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      deptHead: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // 🔗 Relations
      branchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true, // if "All" case
      },
      shiftId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      maxHeadcount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      halfSaturday: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
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
    },
    {
      tableName: "departments",
      timestamps: true,
    }
  );

  return Department;
};