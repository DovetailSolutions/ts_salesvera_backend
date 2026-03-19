import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected";

interface QuotationAttributes {
  id: number;
  quotationNumber: string;
  userId: number;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  totalAmount: number;
  status: QuotationStatus;
  validTill?: Date;
  notes?: string;
}

interface QuotationCreationAttributes
  extends Optional<QuotationAttributes, "id" | "status"> {}

export class Quotation
  extends Model<QuotationAttributes, QuotationCreationAttributes>
  implements QuotationAttributes
{
  public id!: number;
  public quotationNumber!: string;
  public userId!: number;

  public clientName!: string;
  public clientEmail?: string;
  public clientPhone?: string;

  public totalAmount!: number;
  public status!: QuotationStatus;

  public validTill?: Date;
  public notes?: string;

  static initModel(sequelize: Sequelize) {
    Quotation.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },

        quotationNumber: {
          type: DataTypes.STRING,
          allowNull: true
        },

        userId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },

        clientName: {
          type: DataTypes.STRING,
          allowNull: true
        },

        clientEmail: {
          type: DataTypes.STRING
        },

        clientPhone: {
          type: DataTypes.STRING
        },

        totalAmount: {
          type: DataTypes.FLOAT,
          allowNull: true
        },

        status: {
          type: DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
          defaultValue: "draft"
        },

        validTill: {
          type: DataTypes.DATE
        },

        notes: {
          type: DataTypes.TEXT
        }
      },
      {
        sequelize,
        tableName: "quotations",
        modelName: "Quotation",
        timestamps: true
      }
    );
  }
}