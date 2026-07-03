import { Model, DataTypes, Optional, Sequelize } from "sequelize";

interface EmployeeLeaveBalanceAttributes {
  id: number;
  employeeId: number;
  companyId?: number | null;
  branchId?: number | null;
  year: number;
  casualLeaveAllocated: number;
  casualLeaveUsed: number;
  sickLeaveAllocated: number;
  sickLeaveUsed: number;
  paidLeaveAllocated: number;
  paidLeaveUsed: number;
  assignedBy?: number | null;

  created_at?: Date;
  updated_at?: Date;
}

type EmployeeLeaveBalanceCreationAttributes = Optional<
  EmployeeLeaveBalanceAttributes,
  | "id"
  | "companyId"
  | "branchId"
  | "casualLeaveAllocated"
  | "casualLeaveUsed"
  | "sickLeaveAllocated"
  | "sickLeaveUsed"
  | "paidLeaveAllocated"
  | "paidLeaveUsed"
  | "assignedBy"
>;

export class EmployeeLeaveBalance
  extends Model<EmployeeLeaveBalanceAttributes, EmployeeLeaveBalanceCreationAttributes>
  implements EmployeeLeaveBalanceAttributes
{
  public id!: number;
  public employeeId!: number;
  public companyId?: number | null;
  public branchId?: number | null;
  public year!: number;
  public casualLeaveAllocated!: number;
  public casualLeaveUsed!: number;
  public sickLeaveAllocated!: number;
  public sickLeaveUsed!: number;
  public paidLeaveAllocated!: number;
  public paidLeaveUsed!: number;
  public assignedBy?: number | null;

  static initModel(sequelize: Sequelize): typeof EmployeeLeaveBalance {
    EmployeeLeaveBalance.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        employeeId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        branchId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        year: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        casualLeaveAllocated: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        casualLeaveUsed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        sickLeaveAllocated: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        sickLeaveUsed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        paidLeaveAllocated: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        paidLeaveUsed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        assignedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "employee_leave_balances",
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ["employeeId", "year"],
          },
        ],
      }
    );

    return EmployeeLeaveBalance;
  }
}
