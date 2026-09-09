import { Sequelize, DataTypes, Model, Optional } from "sequelize";
import { generateBusinessId } from "../../modules/shared/businessId.service";

// ============================================================
// attendance_regularizations — Sale Person-initiated correction requests
// for missed/incorrect attendance (missed punch-in/out, client visit, WFH,
// technical glitch, other). See modules/attendanceRegularization. Approval
// applies the correction to the existing `attendance` row (see
// attendance.repository.ts's findAttendanceForDate/createAttendanceRecord,
// reused rather than duplicated) and stamps attendanceSource=
// 'REGULARIZATION' there — this table is the request/approval record, not
// a second copy of attendance data.
//
// status is a plain STRING(20), not a Postgres ENUM — same convention as
// AttendanceDeviceChangeRequest.status and Attendance.dayType elsewhere in
// this codebase.
// ============================================================

export type AttendanceRegularizationStatus = "pending" | "approved" | "rejected" | "cancelled";
export type AttendanceRegularizationType =
  | "MISSED_PUNCH_IN"
  | "MISSED_PUNCH_OUT"
  | "MISSED_BOTH"
  | "CLIENT_VISIT"
  | "WORK_FROM_HOME"
  | "TECHNICAL_GLITCH"
  | "OTHER";

export interface AttendanceRegularizationAttributes {
  id: number;
  businessCode: string | null;
  userId: number;
  companyId: number | null;
  attendanceId: number | null;
  requestType: AttendanceRegularizationType;
  attendanceDate: string;
  requestedPunchIn: Date | null;
  requestedPunchOut: Date | null;
  reason: string | null;
  description: string | null;
  attachmentUrl: string | null;
  status: AttendanceRegularizationStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: number | null;
  reviewComment: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AttendanceRegularizationCreationAttributes = Optional<
  AttendanceRegularizationAttributes,
  | "id"
  | "businessCode"
  | "companyId"
  | "attendanceId"
  | "requestedPunchIn"
  | "requestedPunchOut"
  | "reason"
  | "description"
  | "attachmentUrl"
  | "status"
  | "submittedAt"
  | "reviewedAt"
  | "reviewedBy"
  | "reviewComment"
>;

export class AttendanceRegularization
  extends Model<AttendanceRegularizationAttributes, AttendanceRegularizationCreationAttributes>
  implements AttendanceRegularizationAttributes
{
  public id!: number;
  public businessCode!: string | null;
  public userId!: number;
  public companyId!: number | null;
  public attendanceId!: number | null;
  public requestType!: AttendanceRegularizationType;
  public attendanceDate!: string;
  public requestedPunchIn!: Date | null;
  public requestedPunchOut!: Date | null;
  public reason!: string | null;
  public description!: string | null;
  public attachmentUrl!: string | null;
  public status!: AttendanceRegularizationStatus;
  public submittedAt!: Date;
  public reviewedAt!: Date | null;
  public reviewedBy!: number | null;
  public reviewComment!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof AttendanceRegularization {
    AttendanceRegularization.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        businessCode: { type: DataTypes.STRING(20), allowNull: true, unique: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: true },
        attendanceId: { type: DataTypes.INTEGER, allowNull: true },
        requestType: { type: DataTypes.STRING(20), allowNull: false },
        attendanceDate: { type: DataTypes.DATEONLY, allowNull: false },
        requestedPunchIn: { type: DataTypes.DATE, allowNull: true },
        requestedPunchOut: { type: DataTypes.DATE, allowNull: true },
        reason: { type: DataTypes.STRING(255), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        attachmentUrl: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
        submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        reviewedAt: { type: DataTypes.DATE, allowNull: true },
        reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
        reviewComment: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: "attendance_regularizations",
        timestamps: true,
        indexes: [
          { fields: ["userId", "status"], name: "idx_areg_user_status" },
          { fields: ["companyId", "status"], name: "idx_areg_company_status" },
          { fields: ["attendanceDate"], name: "idx_areg_date" },
        ],
        hooks: {
          // Always backend-generated — a client-supplied businessCode in
          // the create payload is discarded, not just defaulted. Same
          // pattern as Company/User/Attendance's hooks (businessId
          // rollout).
          beforeCreate: async (request: any) => {
            request.businessCode = await generateBusinessId(sequelize, "attendance_regularization");
          },
          beforeUpdate: (request: any) => {
            if (request.changed("businessCode")) {
              request.businessCode = request.previous("businessCode");
            }
          },
        },
      }
    );

    return AttendanceRegularization;
  }
}
