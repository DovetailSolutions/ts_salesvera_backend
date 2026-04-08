import { Model, DataTypes, Sequelize, Optional } from "sequelize";
export type InvoiceStatus = "draft" | "sent" | "accepted" | "rejected";

interface InvoiceAttributes {
  id: number;
  userId: number;
  companyId: number;
  quotationId?: number; // 🔥 link to quotation
  invoice?: object;
  status: InvoiceStatus;
  invoiceNumber: string;
  customerName: string;
  quotationNumber?: string;
  quotationDate?: Date;
  dueDate?: Date;
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
  public quotationId?: number;
  public invoice?: object;
  public status!: InvoiceStatus;
  public invoiceNumber!: string;
  public customerName!: string;
  public dueDate?: Date;
  public quotationDate?: Date;
  public quotationNumber?: string;
  

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

        dueDate: {
          type: DataTypes.DATE,
          allowNull: true,
        },
 status: {
          type: DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
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