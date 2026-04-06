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
      },
      companyId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      meetingUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "meeting_user_id",
      },

      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
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
      scheduledTime: DataTypes.DATE,
      meetingTimeIn: DataTypes.DATE,
      meetingTimeOut: DataTypes.DATE,
      latitude_in: DataTypes.STRING,
      longitude_in: DataTypes.STRING,
      latitude_out: DataTypes.STRING,
      longitude_out: DataTypes.STRING,
      totalDistance: DataTypes.STRING,
      legDistance: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: "meetings",
      timestamps: true,
    }
  );
  return Meeting;
};