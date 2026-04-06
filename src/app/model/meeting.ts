import { Sequelize, DataTypes, Model } from "sequelize";
export class Meeting extends Model {
  public id!: number;
  public userId!: number;
  public companyId!: number;
  public meetingUserId!: number;
  public categoryId!: number;
  public meetingPurpose!:
    | "demo"
    | "support"
    | "collection"
    | "general"
    | "newlead"
    | "other"
    | "feedback";

  public status!: "pending" | "completed" | "cancelled" | "in" | "out";
  public scheduledTime!: Date;
  public meetingTimeIn!: Date;
  public meetingTimeOut!: Date;
  public latitude_in!: string;
  public longitude_in!: string;
  public latitude_out!: string;
  public longitude_out!: string;
  public totalDistance!: string;
  public legDistance!: string;
}
export const MeetingModel = (sequelize: Sequelize) => {
  Meeting.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "user_id",
      },

      companyId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "company_id",
      },

      meetingUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "meeting_user_id",
      },


      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "category_id",
      },

      meetingPurpose: {
        type: DataTypes.ENUM(
          "demo",
          "support",
          "collection",
          "general",
          "newlead",
          "other",
          "feedback"
        ),
        field: "meeting_purpose",
      },

      status: {
        type: DataTypes.ENUM(
          "pending",
          "completed",
          "cancelled",
          "in",
          "out",
          "scheduled"
        ),
        defaultValue: "pending",
      },
      scheduledTime: {
        type: DataTypes.DATE,
        field: "scheduled_time",
      },

      meetingTimeIn: {
        type: DataTypes.DATE,
        field: "meeting_time_in",
      },

      meetingTimeOut: {
        type: DataTypes.DATE,
        field: "meeting_time_out",
      },

      latitude_in: DataTypes.STRING,
      longitude_in: DataTypes.STRING,
      latitude_out: DataTypes.STRING,
      longitude_out: DataTypes.STRING,
      totalDistance: {
        type: DataTypes.STRING,
        field: "total_distance",
      },

      legDistance: {
        type: DataTypes.STRING,
        field: "leg_distance",
      },

    },
    {
      sequelize,
      tableName: "meetings",
      timestamps: true,
    }
  );
  return Meeting;
};