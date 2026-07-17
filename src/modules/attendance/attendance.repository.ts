import { Op } from "sequelize";
import { sequelize } from "../../config/dbConnection";
import { User, Attendance, Company, Shift, Branch, CompanyLeave } from "../../config/dbConnection";

// ============================================================
// Attendance repository — wraps all direct Sequelize access for this domain.
// Covers both the admin/team-scoped side (getAttendance/markAttendancePresent/
// bulkMarkAttendance/userAttendance/AttendanceBook) and the employee
// self-service side (AttendancePunchIn/AttendancePunchOut/getTodayAttendance/
// AttendanceList).
// ============================================================

export const findTeamAttendanceToday = (params: {
  allUserIds: number[];
  excludeUserId: number;
  todayDateOnly: string;
  limit: number;
  offset: number;
}) =>
  User.findAndCountAll({
    where: {
      id: { [Op.in]: params.allUserIds, [Op.ne]: params.excludeUserId },
    },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "shiftId", "createdAt"],
    include: [
      {
        model: Attendance,
        as: "Attendances",
        where: { date: params.todayDateOnly },
        required: false,
        include: [{ model: CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] }],
      },
    ],
    offset: params.offset,
    limit: params.limit,
    order: [["createdAt", "DESC"]],
  });

export const findAttendanceForDate = (employeeId: number | string, date: string) =>
  Attendance.findOne({ where: { employee_id: employeeId, date } });

export const createAttendanceRecord = (row: any) => Attendance.create(row);

export const findEmployeeAttendancePaginated = (
  employeeId: number,
  limit: number,
  offset: number,
  dateFilter?: any
) =>
  Attendance.findAndCountAll({
    where:
      dateFilter && Object.keys(dateFilter).length > 0
        ? { employee_id: employeeId, date: dateFilter }
        : { employee_id: employeeId },
    include: [{ model: CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] }],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

export const findCompanyById = (companyId: number) => Company.findByPk(companyId);

// This company's configured leave types — drives the bulk-upload status
// vocabulary dynamically (see BULK_ATTENDANCE_STATUS_MAP in the service)
// instead of a hardcoded, company-agnostic word list.
export const findCompanyLeaveTypesForBulk = (companyId: number) =>
  CompanyLeave.findAll({ where: { companyId }, attributes: ["id", "leaveName", "leaveCode"] });

// Validates a companyLeaveId belongs to the caller's own company before
// letting a single "Mark Attendance" action tag a day with it.
export const findCompanyLeaveById = (id: number, companyId: number) =>
  CompanyLeave.findOne({ where: { id, companyId } });

export const findAttendanceRowsForBulk = (employeeIds: number[], dates: string[]) =>
  Attendance.findAll({
    where: {
      employee_id: { [Op.in]: employeeIds },
      date: { [Op.in]: dates },
    },
  });

export const saveBulkAttendance = (toUpdate: any[], toCreate: any[]) =>
  sequelize.transaction(async (t) => {
    await Promise.all(toUpdate.map((row) => row.save({ transaction: t })));
    if (toCreate.length > 0) {
      await Attendance.bulkCreate(toCreate as any, { transaction: t });
    }
  });

export const findUsersWithAttendanceForMonth = (params: {
  childIds: number[];
  search: any;
  startDate: Date;
  endDate: Date;
  limit: number;
  offset: number;
}) =>
  User.findAndCountAll({
    where: {
      id: { [Op.in]: params.childIds },
      ...params.search,
    },
    attributes: ["id", "employeeCode", "firstName", "lastName", "role", "email", "dob", "profile"],
    include: [
      {
        model: Attendance,
        as: "Attendances",
        where: { date: { [Op.between]: [params.startDate, params.endDate] } },
        required: false,
        include: [{ model: CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] }],
      },
    ],
    offset: params.offset,
    limit: params.limit,
    order: [["firstName", "ASC"]],
    distinct: true,
  });

// ---- Self-service (punch in/out, today, list) ----

export const findEmployeeById = (employeeId: number) =>
  User.findByPk(employeeId, { attributes: ["id", "firstName", "shiftId", "branchId"] });

export const findShiftById = (shiftId: number) => Shift.findByPk(shiftId);
export const findBranchById = (branchId: number) => Branch.findByPk(branchId);

// Whole-team employeeCode -> id lookup — used once, up front, to resolve
// the bulk sheet's "Employee ID" column (which now holds the human-facing
// EMP00001-style code, not the raw internal id) before any row processing.
export const findTeamEmployeeCodes = (userIds: number[]) =>
  User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "employeeCode"] });

// Batch variants — used by bulkMarkAttendance so a whole sheet's worth of
// employees/shifts resolves in 2 queries instead of one per row.
export const findUsersShiftInfo = (employeeIds: number[]) =>
  User.findAll({ where: { id: { [Op.in]: employeeIds } }, attributes: ["id", "firstName", "shiftId"] });

export const findShiftsByIds = (shiftIds: number[]) =>
  Shift.findAll({
    where: { id: { [Op.in]: shiftIds } },
    attributes: ["id", "shiftName", "startTime", "endTime", "workingHours", "fullDayHours", "halfDayAfter"],
  });

// FIX: previously had no date filter at all, so a stale "present" row left
// over from a day the auto punch-out cron didn't run (server downtime, etc.)
// would permanently block that employee from ever punching in again on any
// later day, with a confusing "already punched-in" error pointing at a
// session they can't see or close from today. Scoping to `date` means a
// stale past-day session no longer blocks today's punch-in at all — it's
// left for the cron/an admin correction to close out separately.
export const findActivePunchSession = (employeeId: number | string, date: string) =>
  Attendance.findOne({ where: { employee_id: employeeId, status: "present", date } });

// FIX: previously had no date filter when no explicit AttendanceId was
// given, so `order: [["id","DESC"]]` could close out whichever "present"
// row happened to have the highest id — a stale unclosed session from a
// day the auto punch-out cron missed, not necessarily today's — silently
// punching out the wrong day while today's own session stayed open.
// Scoping to `date` (when no explicit id override is given) guarantees a
// plain punch-out always closes today's own session.
export const findActivePunchSessionById = (employeeId: number | string, date: string, attendanceId?: any) =>
  Attendance.findOne({
    where: attendanceId
      ? { employee_id: employeeId, status: "present", id: attendanceId }
      : { employee_id: employeeId, status: "present", date },
    order: [["id", "DESC"]],
  });

export const findLatestAttendanceForDate = (employeeId: number | string, date: string) =>
  Attendance.findOne({
    where: { employee_id: employeeId, date },
    order: [["id", "DESC"]],
  });
