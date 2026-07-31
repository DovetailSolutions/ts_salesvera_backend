import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface ContactQueryAttributes {
  id: number;
  name: string;
  email: string;
  companyName?: string | null;
  subject: string;
  message: string;
  status: string;
}

interface ContactQueryCreationAttributes
  extends Optional<ContactQueryAttributes, "id" | "companyName" | "status"> {}

export class ContactQuery
  extends Model<ContactQueryAttributes, ContactQueryCreationAttributes>
  implements ContactQueryAttributes
{
  public id!: number;
  public name!: string;
  public email!: string;
  public companyName?: string | null;
  public subject!: string;
  public message!: string;
  public status!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    ContactQuery.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        companyName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        subject: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        // "new" | "read" | "resolved" — plain string column (not a DB enum) so
        // adding a status later never risks the Postgres enum-migration gap
        // that bit the task-status column.
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "new",
        },
      },
      {
        sequelize,
        tableName: "contact_queries",
        modelName: "ContactQuery",
        timestamps: true,
      }
    );
  }
}
