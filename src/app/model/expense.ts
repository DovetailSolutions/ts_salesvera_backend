import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
} from "sequelize";

export type ApprovalStatus = "accepted" | "rejected" | "not_clear" | "pending";

export interface ExpenseAttributes {
  id: number;
  userId: number;
  billImage: string[];
  approvedByAdmin: ApprovalStatus;
  approvedBySuperAdmin: ApprovalStatus;
  title: string;
  total_amount:string;
  createdAt?: Date;
  updatedAt?: Date;

}

export interface ExpenseCreation
  extends Optional<
    ExpenseAttributes,
    "id" | "approvedByAdmin" | "approvedBySuperAdmin"
  > {}

export class Expense
  extends Model<ExpenseAttributes, ExpenseCreation>
  implements ExpenseAttributes
{
  public id!: number;
  public userId!: number;
  public billImage!: string[];
  public approvedByAdmin!: ApprovalStatus;
  public approvedBySuperAdmin!: ApprovalStatus;
  public title!: string;
  public total_amount!:string

  static initModel(sequelize: Sequelize) {
    Expense.init(
      {
        id: {
          type: DataTypes.INTEGER,   // ✅ FIXED
          autoIncrement: true,
          primaryKey: true,
        },

        userId: {
          type: DataTypes.INTEGER,   // ✅ FIXED
          allowNull: true,
        },

        billImage: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          allowNull: true,
          defaultValue: [],
        },

        approvedByAdmin: {
          type: DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
          defaultValue: "pending",
        },

        approvedBySuperAdmin: {
          type: DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
          defaultValue: "pending",
        },

        title: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        total_amount:{
          type:DataTypes.STRING,
          allowNull:true
        }
      },
      {
        sequelize,
        tableName: "expenses",
        modelName: "Expense",
        timestamps: true,
      }
    );

    return Expense;
  }
}
