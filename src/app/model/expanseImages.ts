import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface ExpenseImageAttributes {
  id: number;
  expenseId: number;
  imageUrl: string;
}

interface ExpenseImageCreationAttributes
  extends Optional<ExpenseImageAttributes, "id"> {}

export class ExpenseImage
  extends Model<ExpenseImageAttributes, ExpenseImageCreationAttributes>
  implements ExpenseImageAttributes
{
  public id!: number;
  public expenseId!: number;
  public imageUrl!: string;

  static initModel(sequelize: Sequelize) {
    ExpenseImage.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        expenseId: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        imageUrl: {
          type: DataTypes.STRING,
          allowNull: false
        }
      },
      {
        sequelize,
        tableName: "expense_images",
        timestamps: true
      }
    );
  }
}