import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface RecordSaleAttributes {
  id: number;
  customerName: string;
  productDescription: string;
  saleAmount: number;
  remarks?: string;
  paymentReceived: boolean;
  userId: number;
  companyId: number;
}

interface RecordSaleCreationAttributes
  extends Optional<RecordSaleAttributes, "id" | "remarks"> {}

export class RecordSales
  extends Model<RecordSaleAttributes, RecordSaleCreationAttributes>
  implements RecordSaleAttributes
{
  public id!: number;
  public customerName!: string;
  public productDescription!: string;
  public saleAmount!: number;
  public remarks?: string;
  public paymentReceived!: boolean;
  public userId!: number;
  public companyId!: number;

  static initModel(sequelize: Sequelize) {
    RecordSales.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },

        customerName: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        productDescription: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        saleAmount: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },

        remarks: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        paymentReceived: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },

        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "record_sales",
        modelName: "RecordSale",
        timestamps: true,
      }
    );
  }
}