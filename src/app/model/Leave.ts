import { Model, DataTypes, Optional, Sequelize } from "sequelize";

interface CompanyLeaveAttributes {
  id: number;
  leaveName: string;
  leaveCode: string;
  leavesPerYear: number;
  carryForward: boolean;
  carryForwardLimit: number;
  managerApproval: boolean;
  companyId: number;
  branchId: number;
  userId: number;
  status: "pending" | "approved" | "rejected";

  created_at?: Date;
  updated_at?: Date;
}

type CompanyLeaveCreationAttributes = Optional<
  CompanyLeaveAttributes,
  "id" | "status" | "carryForward" | "carryForwardLimit" | "managerApproval"
>;


export class CompanyLeave
  extends Model<CompanyLeaveAttributes, CompanyLeaveCreationAttributes>
  implements CompanyLeaveAttributes
{
  public id!: number;
  public leaveName!: string;
  public leaveCode!: string;
  public leavesPerYear!: number;
  public carryForward!: boolean;
  public carryForwardLimit!: number;
  public managerApproval!: boolean;
  public companyId!: number;
  public branchId!: number;
  public userId!: number;
  public status!: "pending" | "approved" | "rejected";

  static initModel(sequelize: Sequelize): typeof CompanyLeave {
    CompanyLeave.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        leaveName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        leaveCode: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true, // good practice
        },
        leavesPerYear: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        carryForward: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        carryForwardLimit: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        managerApproval: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        branchId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM("pending", "approved", "rejected"),
          allowNull: false,
          defaultValue: "pending",
        },
      },
      {
        sequelize,
        tableName: "company_leaves",
        timestamps: true,
      }
    );

    return CompanyLeave;
  }
}