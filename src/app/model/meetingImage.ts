import { Sequelize, DataTypes, Model } from "sequelize";

export class MeetingImage extends Model {
  public id!: number;
  public meetingId!: number;
  public meetingUserId!: number;
  public image!: string;
}

export const MeetingImageModel = (sequelize: Sequelize) => {
  MeetingImage.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      meetingId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      meetingUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      image: {
        type: DataTypes.STRING,
      },
    },
    {
      sequelize,
      tableName: "meeting_images",
      timestamps: false,
    }
  );

  return MeetingImage;
};