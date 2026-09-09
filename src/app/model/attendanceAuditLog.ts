import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// attendance_audit_logs — append-only security event trail for the
// Attendance Security module (photo/device/geofence events). Writes are
// always fire-and-forget from attendanceSecurity.service.ts's
// logSecurityEvent — a logging failure must never block a real attendance
// action, so nothing in this codebase ever awaits a write to this table.
// ============================================================

export interface AttendanceAuditLogAttributes {
  id: number;
  userId: number;
  companyId?: number | null;
  actorId?: number | null;
  eventType: string;
  attendanceId?: number | null;
  deviceChangeRequestId?: number | null;
  regularizationRequestId?: number | null;
  message?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AttendanceAuditLogCreationAttributes = Optional<
  AttendanceAuditLogAttributes,
  | "id"
  | "companyId"
  | "actorId"
  | "attendanceId"
  | "deviceChangeRequestId"
  | "regularizationRequestId"
  | "message"
  | "metadata"
>;

export class AttendanceAuditLog
  extends Model<AttendanceAuditLogAttributes, AttendanceAuditLogCreationAttributes>
  implements AttendanceAuditLogAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number | null;
  public actorId!: number | null;
  public eventType!: string;
  public attendanceId!: number | null;
  public deviceChangeRequestId!: number | null;
  public regularizationRequestId!: number | null;
  public message!: string | null;
  public metadata!: Record<string, any> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof AttendanceAuditLog {
    AttendanceAuditLog.init(
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
        actorId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        eventType: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        attendanceId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        deviceChangeRequestId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        regularizationRequestId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "attendance_audit_logs",
        timestamps: true,
        indexes: [
          { fields: ["userId", "createdAt"], name: "idx_audit_user" },
          { fields: ["companyId", "eventType"], name: "idx_audit_company_event" },
        ],
      }
    );

    return AttendanceAuditLog;
  }
}
