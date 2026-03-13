import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export type ApprovalStatus = "accepted" | "rejected" | "not_clear" | "pending";

interface ExpenseAttributes {
  id: number;
  userId: number;
  title?: string;
  total_amount?: string;
  approvedByAdmin: ApprovalStatus;
  approvedBySuperAdmin: ApprovalStatus;
  date?: string;
  category?: string;
  amount?: string;
  description?: string;
  location?: string;
}

interface ExpenseCreationAttributes
  extends Optional<
    ExpenseAttributes,
    "id" | "approvedByAdmin" | "approvedBySuperAdmin"
  > {}

export class Expense
  extends Model<ExpenseAttributes, ExpenseCreationAttributes>
  implements ExpenseAttributes
{
  public id!: number;
  public userId!: number;

  public title?: string;
  public total_amount?: string;

  public approvedByAdmin!: ApprovalStatus;
  public approvedBySuperAdmin!: ApprovalStatus;

  public date?: string;
  public category?: string;
  public amount?: string;
  public description?: string;
  public location?: string;

  static initModel(sequelize: Sequelize) {
    Expense.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },

        userId: {
          type: DataTypes.INTEGER,
          allowNull: false
        },

        approvedByAdmin: {
          type: DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
          defaultValue: "pending"
        },

        approvedBySuperAdmin: {
          type: DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
          defaultValue: "pending"
        },

        title: {
          type: DataTypes.STRING,
          allowNull: true
        },

        total_amount: {
          type: DataTypes.STRING,
          allowNull: true
        },

        date: {
          type: DataTypes.STRING,
          allowNull: true
        },

        category: {
          type: DataTypes.STRING,
          allowNull: true
        },

        amount: {
          type: DataTypes.STRING,
          allowNull: true
        },

        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },

        location: {
          type: DataTypes.STRING,
          allowNull: true
        }
      },
      {
        sequelize,
        tableName: "expenses",
        modelName: "Expense",
        timestamps: true
      }
    );
  }
}