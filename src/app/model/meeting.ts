import {
  Sequelize,
  DataTypes,
  Model,
  BelongsToManyGetAssociationsMixin,
  BelongsToManySetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
  BelongsToManyRemoveAssociationsMixin,
} from "sequelize";

import { Category } from "./category";

export class Meeting extends Model {
  public id!: number;
  public image!: string[];

  public companyName!: string;
  public personName!: string;
  public mobileNumber!: string;
  public customerType!: "new" | "existing" | "followup";
  public meetingPurpose!: "demo" | "support" | "collection" | "general" |"newlead"|"other"|"feedback";
  public categoryId!: number;
  public remarks!: string | null;
  public status!: "pending" | "completed" | "cancelled" |"in"|"out";

  public latitude_in!: string | null;
  public longitude_in!: string | null;
  public latitude_out!: string | null;
  public longitude_out!: string | null;

  public meetingTimeOut!: Date;
  public meetingTimeIn!: Date;
  public userId!: number;
  public scheduledTime!:Date;

  // Relationship helpers
  public getCategories!: BelongsToManyGetAssociationsMixin<Category>;
  public setCategories!: BelongsToManySetAssociationsMixin<Category, number>;
  public addCategory!: BelongsToManyAddAssociationMixin<Category, number>;
  public addCategories!: BelongsToManyAddAssociationsMixin<Category, number>;
  public removeCategory!: BelongsToManyRemoveAssociationMixin<Category, number>;
  public removeCategories!: BelongsToManyRemoveAssociationsMixin<Category, number>;
}

export const MeetingTypeModel = (sequelize: Sequelize) => {
  Meeting.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      image: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },

      companyName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      personName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      customerType: {
        type: DataTypes.ENUM("new", "existing", "followup"),
        defaultValue: "new",
      },

      meetingPurpose: {
        type: DataTypes.ENUM("demo", "support", "collection", "general","newlead","other","feedback"),
        allowNull: true,
      },

      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM("pending", "completed", "cancelled","in","out","scheduled"),
        defaultValue: "pending",
      },

        scheduledTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      latitude_in: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      longitude_in: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      latitude_out: {
        type: DataTypes.STRING,
        allowNull: true,
      },
       longitude_out: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      meetingTimeIn: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      meetingTimeOut: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "meeting",
      sequelize,
      timestamps: true,
    }
  );

  return Meeting;
};
