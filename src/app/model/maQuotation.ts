import { Model, DataTypes, Sequelize, Optional } from "sequelize";
interface QuotationItemAttributes {
  id: number;
  quotationId: number;
  serviceName: string;
  description?: string;
  price: number;
  quantity: number;
}

interface QuotationItemCreationAttributes
  extends Optional<QuotationItemAttributes, "id"> {}

export class QuotationItem
  extends Model<QuotationItemAttributes, QuotationItemCreationAttributes>
  implements QuotationItemAttributes
{
  public id!: number;
  public quotationId!: number;
  public serviceName!: string;
  public description?: string;
  public price!: number;
  public quantity!: number;

  static initModel(sequelize: Sequelize) {
    QuotationItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },

        quotationId: {
          type: DataTypes.INTEGER,
          allowNull: false
        },

        serviceName: {
          type: DataTypes.STRING,
          allowNull: false
        },

        description: {
          type: DataTypes.TEXT
        },

        price: {
          type: DataTypes.FLOAT,
          allowNull: false
        },

        quantity: {
          type: DataTypes.INTEGER,
          defaultValue: 1
        }
      },
      {
        sequelize,
        tableName: "quotation_items",
        modelName: "QuotationItem",
        timestamps: true
      }
    );
  }
}