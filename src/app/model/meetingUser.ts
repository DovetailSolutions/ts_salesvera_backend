import { Sequelize, DataTypes, Model } from "sequelize";

export class User extends Model {
  public id!: number;
  public name!: string;
  public email?: string;
  public mobile!: string;
  public companyId!: number;
  public userId!: number;
  public customerType!: string;
  public state!: string;
  public city!: string;
  public pincode!: string;
  public country!: string;
  public address!: string;
  public gstNumber!: string;
  public companyName!: string;
  public panNumber!: string;
  public status!: "draft" | "sent" | "accepted" | "rejected";
  // public companyId!: number;
  public role!: "admin" | "manager" | "employee";
}

export const UserModel = (sequelize: Sequelize) => {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      mobile: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "user_id",
      },


      customerType: {
        type: DataTypes.STRING,
        defaultValue: "new",
        field: "customer_type",
      },
      state: DataTypes.STRING,
      city: DataTypes.STRING,
      pincode: DataTypes.STRING,
      country: DataTypes.STRING,

      address: DataTypes.TEXT,
      gstNumber: DataTypes.STRING,
      companyName: DataTypes.STRING,
      panNumber: DataTypes.STRING,
      status: {
          type: DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
          defaultValue: "draft",
        },
    },
    {
      sequelize,
      tableName: "meeting_users",
      timestamps: true,
    }
  );

  return User;
};