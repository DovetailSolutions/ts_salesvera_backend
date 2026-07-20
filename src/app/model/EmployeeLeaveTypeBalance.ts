import { Model, DataTypes, Optional, Sequelize } from "sequelize";

interface EmployeeLeaveTypeBalanceAttributes {
  id: number;
  employeeId: number;
  companyLeaveId: number;
  year: number;
  allocated: number;
  used: number;
  // Days rolled over from the prior year's unused balance (capped at that
  // leave type's CompanyLeave.carryForwardLimit) — kept separate from
  // `allocated` so it stays visibly distinct and isn't clobbered when this
  // year's allocation is later edited.
  carriedForward: number;
  assignedBy?: number | null;

  created_at?: Date;
  updated_at?: Date;
}

type EmployeeLeaveTypeBalanceCreationAttributes = Optional<
  EmployeeLeaveTypeBalanceAttributes,
  "id" | "allocated" | "used" | "carriedForward" | "assignedBy"
>;

// One row per (employee, company-configured leave type, year) — replaces the
// old EmployeeLeaveBalance model's fixed casual/sick/paid columns with a
// dynamic structure that can represent however many leave types a company
// actually configured at registration (CompanyLeave), including custom ones.
export class EmployeeLeaveTypeBalance
  extends Model<EmployeeLeaveTypeBalanceAttributes, EmployeeLeaveTypeBalanceCreationAttributes>
  implements EmployeeLeaveTypeBalanceAttributes
{
  public id!: number;
  public employeeId!: number;
  public companyLeaveId!: number;
  public year!: number;
  public allocated!: number;
  public used!: number;
  public carriedForward!: number;
  public assignedBy?: number | null;

  static initModel(sequelize: Sequelize): typeof EmployeeLeaveTypeBalance {
    EmployeeLeaveTypeBalance.init(
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
        companyLeaveId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        year: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        allocated: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        used: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carriedForward: {
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
        tableName: "employee_leave_type_balances",
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ["employeeId", "companyLeaveId", "year"],
          },
        ],
      }
    );

    return EmployeeLeaveTypeBalance;
  }
}
