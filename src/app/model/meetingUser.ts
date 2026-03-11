import { Sequelize, DataTypes, Model } from "sequelize";

export class User extends Model {
  public id!: number;
  public name!: string;
  public email?: string;
  public mobile!: string;
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

      userId:{
        type:DataTypes.INTEGER,
        allowNull:true
      }

    //   role: {
    //     type: DataTypes.ENUM("admin", "manager", "employee"),
    //     defaultValue: "employee",
    //   },
    },
    {
      sequelize,
      tableName: "meeting_users",
      timestamps: true,
    }
  );

  return User;
};