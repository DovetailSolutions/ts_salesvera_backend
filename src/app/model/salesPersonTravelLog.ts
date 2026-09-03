import { Model, DataTypes, Optional, Sequelize } from "sequelize";

export type TravelSegmentFromType = "ATTENDANCE_IN" | "MEETING_OUT" | "MEETING";
export type TravelSegmentToType = "MEETING_IN" | "MEETING" | "ATTENDANCE_OUT";

export interface SalesPersonTravelLogAttributes {
  id: number;
  userId: number;
  companyId: number;
  attendanceId?: number | null;

  fromType: TravelSegmentFromType;
  fromId?: number | null;
  fromLatitude: string;
  fromLongitude: string;
  fromTimestamp?: Date | null;

  toType: TravelSegmentToType;
  toId?: number | null;
  toLatitude: string;
  toLongitude: string;
  toTimestamp?: Date | null;

  distanceMeters: number;
  distanceKm: number;
  travelDuration?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type SalesPersonTravelLogCreationAttributes = Optional<
  SalesPersonTravelLogAttributes,
  "id" | "attendanceId" | "fromId" | "toId" | "fromTimestamp" | "toTimestamp" | "travelDuration" | "createdAt" | "updatedAt"
>;

export class SalesPersonTravelLog
  extends Model<SalesPersonTravelLogAttributes, SalesPersonTravelLogCreationAttributes>
  implements SalesPersonTravelLogAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number;
  public attendanceId!: number | null;

  public fromType!: TravelSegmentFromType;
  public fromId!: number | null;
  public fromLatitude!: string;
  public fromLongitude!: string;
  public fromTimestamp!: Date | null;

  public toType!: TravelSegmentToType;
  public toId!: number | null;
  public toLatitude!: string;
  public toLongitude!: string;
  public toTimestamp!: Date | null;

  public distanceMeters!: number;
  public distanceKm!: number;
  public travelDuration!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof SalesPersonTravelLog {
    SalesPersonTravelLog.init(
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
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        attendanceId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        fromType: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        fromId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        fromLatitude: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        fromLongitude: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        fromTimestamp: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        toType: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        toId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        toLatitude: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        toLongitude: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        toTimestamp: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        distanceMeters: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        distanceKm: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        travelDuration: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "sales_person_travel_logs",
        timestamps: true,
      }
    );

    return SalesPersonTravelLog;
  }
}
