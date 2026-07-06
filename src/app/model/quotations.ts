import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "imported" | "cancelled" | "deleted";

interface QuotationAttributes {
  id: number;
  userId: number;
  companyId: number;
  quotation?: object;
  status: QuotationStatus;
  quotationNumber: string;
  referenceNumber: string;
  customerName: string;
  isConsumed: boolean;
  guid?: string | null;
  alterid?: string | null;
  TallyAPISync?: boolean
  branchId?: number | null;
}

interface QuotationCreationAttributes
  extends Optional<QuotationAttributes, "id" | "quotation" | "status"> { }

export class Quotations
  extends Model<QuotationAttributes, QuotationCreationAttributes>
  implements QuotationAttributes {
  public id!: number;
  public userId!: number;
  public companyId!: number;
  public quotation?: object;
  public status!: QuotationStatus;
  public quotationNumber!: string;
  public referenceNumber!: string;
  public customerName!: string;
  public isConsumed!: boolean;
  public guid?: string | null;
  public alterid?: string | null;
  public TallyAPISync!: boolean

  static initModel(sequelize: Sequelize) {
    Quotations.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        quotationNumber: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        guid: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        alterid: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        referenceNumber: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        customerName: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },

        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        isConsumed: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true,
        },

        TallyAPISync: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: true,
        },
        quotation: {
          type: DataTypes.JSON, // 🔥 best for storing object
          allowNull: true,
        },

        status: {
          type: DataTypes.ENUM("draft", "imported", "sent", "accepted", "rejected", "cancelled", "deleted"),
          defaultValue: "draft",
        },
        branchId: {
          type: DataTypes.INTEGER,
          allowNull: true,
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