import { Model, DataTypes, Sequelize, Optional } from "sequelize";
export type InvoiceStatus = "draft" | "sent" | "accepted" | "rejected" |"imported" | "cancelled" | "deleted";

interface InvoiceAttributes {
  id: number;
  userId: number;
  companyId: number;
  quotationId?: number | null; // 🔥 link to quotation
  invoice?: object;
  status: InvoiceStatus;
  invoiceNumber: string;
  customerName: string;
  quotationNumber?: string | null;
  quotationDate?: Date | null;
  invoiceDate?: Date | null;
}

interface InvoiceCreationAttributes
  extends Optional<InvoiceAttributes, "id" | "invoice" | "status" | "quotationId"> {}

export class Invoices
  extends Model<InvoiceAttributes, InvoiceCreationAttributes>
  implements InvoiceAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number;
  public quotationId?: number | null;
  public invoice?: object;
  public status!: InvoiceStatus;
  public invoiceNumber!: string;
  public customerName!: string;
  public invoiceDate?: Date | null;
  public quotationDate?: Date | null;
  public quotationNumber?: string | null;
  

  static initModel(sequelize: Sequelize) {
    Invoices.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },

        invoiceNumber: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        customerName: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        quotationId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
        },

        invoice: {
          type: DataTypes.JSON,
          allowNull: true,
        },

        quotationNumber: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        quotationDate:{
          type: DataTypes.DATE,
          allowNull: true,
        },

        invoiceDate: {
          type: DataTypes.DATE,
          allowNull: true,
        },
 status: {
          type: DataTypes.ENUM("draft", "sent", "accepted","imported", "rejected", "cancelled", "deleted"),
          defaultValue: "draft",
        },
      },
      {
        sequelize,
        tableName: "invoices",
        modelName: "Invoice",
        timestamps: true,
      }
    );
  }
}