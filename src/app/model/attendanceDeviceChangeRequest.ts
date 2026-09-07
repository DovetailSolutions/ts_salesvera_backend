import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// attendance_device_change_requests — created whenever an attendance punch
// arrives from a device that differs from the user's current trusted device
// (see attendanceSecurity.service.ts's checkDeviceSecurity). Admin
// approves/rejects; approval promotes the requested device to trusted
// (replacing the old one) via attendanceSecurity.service.ts, not here.
//
// status is a plain STRING(20), not a Postgres ENUM — same convention as
// Attendance.dayType / Meeting.status elsewhere in this codebase.
// ============================================================

export type AttendanceDeviceChangeRequestStatus = "pending" | "approved" | "rejected";

export interface AttendanceDeviceChangeRequestAttributes {
  id: number;
  userId: number;
  companyId?: number | null;
  requestedDeviceId: string;
  requestedDeviceName?: string | null;
  requestedDeviceType?: string | null;
  previousDeviceId?: string | null;
  status: AttendanceDeviceChangeRequestStatus;
  reviewedBy?: number | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AttendanceDeviceChangeRequestCreationAttributes = Optional<
  AttendanceDeviceChangeRequestAttributes,
  | "id"
  | "companyId"
  | "requestedDeviceName"
  | "requestedDeviceType"
  | "previousDeviceId"
  | "status"
  | "reviewedBy"
  | "reviewedAt"
  | "reviewNote"
>;

export class AttendanceDeviceChangeRequest
  extends Model<AttendanceDeviceChangeRequestAttributes, AttendanceDeviceChangeRequestCreationAttributes>
  implements AttendanceDeviceChangeRequestAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number | null;
  public requestedDeviceId!: string;
  public requestedDeviceName!: string | null;
  public requestedDeviceType!: string | null;
  public previousDeviceId!: string | null;
  public status!: AttendanceDeviceChangeRequestStatus;
  public reviewedBy!: number | null;
  public reviewedAt!: Date | null;
  public reviewNote!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof AttendanceDeviceChangeRequest {
    AttendanceDeviceChangeRequest.init(
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
        requestedDeviceId: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        requestedDeviceName: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        requestedDeviceType: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        previousDeviceId: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: "pending",
        },
        reviewedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        reviewedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        reviewNote: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "attendance_device_change_requests",
        timestamps: true,
        indexes: [
          { fields: ["userId", "requestedDeviceId"], name: "idx_adcr_user_device" },
          { fields: ["companyId", "status"], name: "idx_adcr_company_status" },
        ],
      }
    );

    return AttendanceDeviceChangeRequest;
  }
}
