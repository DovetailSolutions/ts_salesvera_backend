import { Model, DataTypes, Optional, Sequelize } from "sequelize";

interface DeviceAttributes {
  id: number;
  userId: number;
  deviceToken: string;
  deviceType: "android" | "ios" | "web";
  deviceId:string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  devicemodel?: string;
  devicename?: string;
}

interface DeviceCreation extends Optional<DeviceAttributes, "id"> {}

export class Device
  extends Model<DeviceAttributes, DeviceCreation>
  implements DeviceAttributes
{
  public id!: number;
  public userId!: number;
  public deviceToken!: string;
  public deviceType!: "android" | "ios" | "web";
  public devicemodel!: string;
  public devicename!: string;
  public isActive!: boolean;
  public deviceId!:string
}

export const DeviceModel = (sequelize: Sequelize) => {
  Device.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      deviceToken: {
        type: DataTypes.STRING,
        allowNull: false,
        // unique: true,
      },
      devicemodel: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      devicename: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deviceType: {
        type: DataTypes.ENUM("android", "ios", "web"),
        defaultValue: "android",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      deviceId:{
        type:DataTypes.STRING,
        allowNull:true
      }
    },
    {
      sequelize,
      modelName: "Device",
      tableName: "devices",
    }
  );

  return Device;
};
