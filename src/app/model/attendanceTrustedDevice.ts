import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// attendance_trusted_devices — the single device currently trusted for a
// user's attendance punches. One row per user (unique userId): approving a
// new device REPLACES this row rather than adding a second trusted device
// (single-trusted-device, "replace on approval" policy — confirmed choice,
// no multi-device support).
// ============================================================

export interface AttendanceTrustedDeviceAttributes {
  id: number;
  userId: number;
  companyId?: number | null;
  deviceId: string;
  deviceName?: string | null;
  deviceType?: string | null;
  registeredAt?: Date;
  lastSeenAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type AttendanceTrustedDeviceCreationAttributes = Optional<
  AttendanceTrustedDeviceAttributes,
  "id" | "companyId" | "deviceName" | "deviceType" | "registeredAt" | "lastSeenAt"
>;

export class AttendanceTrustedDevice
  extends Model<AttendanceTrustedDeviceAttributes, AttendanceTrustedDeviceCreationAttributes>
  implements AttendanceTrustedDeviceAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number | null;
  public deviceId!: string;
  public deviceName!: string | null;
  public deviceType!: string | null;
  public registeredAt!: Date;
  public lastSeenAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof AttendanceTrustedDevice {
    AttendanceTrustedDevice.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        deviceId: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        deviceName: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        deviceType: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        registeredAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        lastSeenAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "attendance_trusted_devices",
        timestamps: true,
        indexes: [{ unique: true, fields: ["userId"], name: "attendance_trusted_devices_user_unique" }],
      }
    );

    return AttendanceTrustedDevice;
  }
}
