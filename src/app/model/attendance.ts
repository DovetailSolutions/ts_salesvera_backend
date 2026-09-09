import { Model, DataTypes, Optional, Sequelize } from "sequelize";
import { generateBusinessId } from "../../modules/shared/businessId.service";

interface AttendanceAttributes {
  id: number;
  // Human-readable Business ID (e.g. "ATT001") — separate from `id`.
  // Backend-generated only, see the beforeCreate hook below. Assigned once
  // per attendance row (a same-day re-punch reuses the existing row via
  // beforeUpdate, not a new create, so it keeps its original businessCode).
  businessCode?: string | null;
  employee_id: number;
  date: Date;
  punch_in?: Date | null;
  punch_out?: Date | null;
  working_hours?: number | null;
  status: "in" | "present" | "absent" | "leave" | "holiday" | "leaveReject" |"leaveApproved" |"out";
  // Derived from working_hours at punch-out: <3h short_leave, 3-4h half_day, >=4h full_day.
  dayType?: "full_day" | "half_day" | "short_leave" | null;
  late?: boolean;
  overtime?: number | null;
  // Which of the company's configured leave types (CompanyLeave) this row's
  // leave/leaveApproved status was granted under, e.g. so a "Comp Leave" day
  // can be told apart from a "Sick Leave" day instead of collapsing to the
  // same generic leaveApproved status. Null for non-leave rows.
  companyLeaveId?: number | null;

  latitude_in?: string | null;
  longitude_in?: string | null;
  latitude_out?: string | null;
  longitude_out?: string | null;

  // Per-user geo-fencing audit trail (modules/geoFencing) — null/false when
  // the punching user had no geo-fencing configured for them at the time.
  geoFencingEnabled?: boolean | null;
  geoFencingVerified?: boolean | null;
  geoFenceDistance?: number | null;

  // Sale Person daily travel (see modules/attendance/travelDistance.service.ts).
  // The Attendance-In -> Meeting-1 and Meeting -> Meeting legs already live on
  // each Meeting row (legDistance/totalDistance); this is only the closing
  // "last meeting -> Attendance Out" leg plus the resulting whole-day total
  // and allowance, computed once at punch-out.
  lastMeetingId?: number | null;
  finalLegDistanceKm?: number | null;
  totalTravelDistanceKm?: number | null;
  // Rate snapshotted at calculation time so a later company rate change
  // doesn't retroactively change a past day's already-paid allowance.
  vehicleAllowanceRateApplied?: number | null;
  vehicleAllowance?: number | null;
  // 'calculated' | 'failed' | 'no_meetings' | null. On Google API failure
  // this stays 'failed' with the distance/allowance fields left null — never
  // a fake 0, so a real 0km day can't be confused with an uncalculated one.
  distanceCalculationStatus?: "calculated" | "failed" | "no_meetings" | null;

  // Human-readable Attendance In/Out location ("Dovetail Solutions Office,
  // Mohali") — resolved once at punch time (see locationName.service.ts) and
  // persisted so the travel timeline never re-geocodes on every read. Null
  // when resolution failed (branch-match miss + geocode failure); the
  // frontend falls back to "Location unavailable" in that case.
  locationNameIn?: string | null;
  locationNameOut?: string | null;

  // Attendance Security module — see modules/attendanceSecurity. Photo is
  // punch-in only (multer-s3 file.location URL); device ids record which
  // trusted device (if device security is enabled for this user) performed
  // each punch. All null when the corresponding control isn't enabled.
  attendancePhoto?: string | null;
  punchInDeviceId?: string | null;
  punchOutDeviceId?: string | null;

  // Attendance Regularization module (see modules/attendanceRegularization)
  // — 'NORMAL' (default, a real punch) vs 'REGULARIZATION' (admin/manager-
  // approved correction). original* preserve exactly what the row held
  // immediately before an approved regularization overwrote it (NULL if
  // there was no prior attendance row at all — a genuinely missed punch),
  // so "what actually happened vs. what was corrected" stays auditable
  // directly on the row, not only in attendance_audit_logs.
  attendanceSource?: "NORMAL" | "REGULARIZATION" | null;
  originalPunchIn?: Date | null;
  originalPunchOut?: Date | null;
  regularizedFromRequestId?: number | null;

  created_at?: Date;
  updated_at?: Date;
}

type AttendanceCreationAttributes = Optional<
  AttendanceAttributes,
  | "id"
  | "punch_in"
  | "punch_out"
  | "working_hours"
  | "late"
  | "overtime"
  | "latitude_in"
  | "longitude_in"
  | "latitude_out"
  | "longitude_out"
  | "geoFencingEnabled"
  | "geoFencingVerified"
  | "geoFenceDistance"
  | "lastMeetingId"
  | "finalLegDistanceKm"
  | "totalTravelDistanceKm"
  | "vehicleAllowanceRateApplied"
  | "vehicleAllowance"
  | "distanceCalculationStatus"
  | "locationNameIn"
  | "locationNameOut"
  | "attendancePhoto"
  | "punchInDeviceId"
  | "punchOutDeviceId"
  | "businessCode"
  | "attendanceSource"
  | "originalPunchIn"
  | "originalPunchOut"
  | "regularizedFromRequestId"
>;

export class Attendance
  extends Model<AttendanceAttributes, AttendanceCreationAttributes>
  implements AttendanceAttributes
{
  public id!: number;
  public businessCode!: string | null;
  public employee_id!: number;
  public date!: Date;
  public punch_in!: Date | null;
  public punch_out!: Date | null;
  public working_hours!: number | null;
  public status!: "in" | "present" | "absent" | "leave" | "holiday" | "leaveReject" | "leaveApproved"|"out";
  public dayType!: "full_day" | "half_day" | "short_leave" | null;
  public late!: boolean;
  public overtime!: number | null;
  public companyLeaveId!: number | null;

  public latitude_in!: string | null;
  public longitude_in!: string | null;
  public latitude_out!: string | null;
  public longitude_out!: string | null;

  public geoFencingEnabled!: boolean | null;
  public geoFencingVerified!: boolean | null;
  public geoFenceDistance!: number | null;

  public lastMeetingId!: number | null;
  public finalLegDistanceKm!: number | null;
  public totalTravelDistanceKm!: number | null;
  public vehicleAllowanceRateApplied!: number | null;
  public vehicleAllowance!: number | null;
  public distanceCalculationStatus!: "calculated" | "failed" | "no_meetings" | null;
  public locationNameIn!: string | null;
  public locationNameOut!: string | null;

  public attendancePhoto!: string | null;
  public punchInDeviceId!: string | null;
  public punchOutDeviceId!: string | null;

  public attendanceSource!: "NORMAL" | "REGULARIZATION" | null;
  public originalPunchIn!: Date | null;
  public originalPunchOut!: Date | null;
  public regularizedFromRequestId!: number | null;

  static initModel(sequelize: Sequelize): typeof Attendance {
    Attendance.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        businessCode: {
          type: DataTypes.STRING(20),
          allowNull: true,
          unique: true,
        },
        employee_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        punch_in: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        punch_out: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        working_hours: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        dayType: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("in", "present","out","absent", "leave","leaveReject","leaveApproved", "holiday"),
          allowNull: false,
          defaultValue: "absent",
        },
        late: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        overtime: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        companyLeaveId: {
          type: DataTypes.INTEGER,
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
        geoFencingEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        geoFencingVerified: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        geoFenceDistance: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        lastMeetingId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        finalLegDistanceKm: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        totalTravelDistanceKm: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        vehicleAllowanceRateApplied: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        vehicleAllowance: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        distanceCalculationStatus: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        locationNameIn: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        locationNameOut: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        attendancePhoto: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        punchInDeviceId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        punchOutDeviceId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        attendanceSource: {
          type: DataTypes.STRING(20),
          allowNull: true,
          defaultValue: "NORMAL",
        },
        originalPunchIn: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        originalPunchOut: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        regularizedFromRequestId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "attendance",
        timestamps: true,
        hooks: {
          // Always backend-generated — a client-supplied businessCode in
          // the create payload is discarded, not just defaulted.
          beforeCreate: async (attendance: any) => {
            attendance.businessCode = await generateBusinessId(sequelize, "attendance");
          },
          // Immutable by default — a same-day re-punch reuses this row via
          // .save() (see attendance.service.ts), which must not reassign a
          // fresh Business ID or let a stray field in the update payload
          // change the existing one.
          beforeUpdate: (attendance: any) => {
            if (attendance.changed("businessCode")) {
              attendance.businessCode = attendance.previous("businessCode");
            }
          },
        },
      }
    );

    return Attendance;
  }
}
