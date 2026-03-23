import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected";

interface QuotationAttributes {
  id: number;
  userId: number;
  companyId: number;
  quotation?: object;
  status: QuotationStatus;
}

interface QuotationCreationAttributes
  extends Optional<QuotationAttributes, "id" | "quotation" | "status"> {}

export class Quotations
  extends Model<QuotationAttributes, QuotationCreationAttributes>
  implements QuotationAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number;
  public quotation?: object;
  public status!: QuotationStatus;

  static initModel(sequelize: Sequelize) {
    Quotations.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },

        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },

        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },

        quotation: {
          type: DataTypes.JSON, // 🔥 best for storing object
          allowNull: true,
        },

        status: {
          type: DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
          defaultValue: "draft",
        },
      },
      {
        sequelize,
        tableName: "quotations",
        modelName: "Quotation",
        timestamps: true, // adds createdAt & updatedAt automatically
      }
    );
  }
}