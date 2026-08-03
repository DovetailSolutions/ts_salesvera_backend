"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLatestAttendanceForDate = exports.findActivePunchSessionById = exports.findActivePunchSession = exports.findShiftsByIds = exports.findUsersShiftInfo = exports.findTeamEmployeeCodes = exports.findBranchById = exports.findShiftById = exports.findEmployeeById = exports.findUsersWithAttendanceForMonth = exports.saveBulkAttendance = exports.findAttendanceRowsForBulk = exports.findCompanyLeaveById = exports.findCompanyLeaveTypesForBulk = exports.findCompanyById = exports.findTeamAttendanceForReport = exports.findEmployeeAttendancePaginated = exports.createAttendanceRecord = exports.findAttendanceForDate = exports.findTeamAttendanceToday = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const dbConnection_2 = require("../../config/dbConnection");
// ============================================================
// Attendance repository — wraps all direct Sequelize access for this domain.
// Covers both the admin/team-scoped side (getAttendance/markAttendancePresent/
// bulkMarkAttendance/userAttendance/AttendanceBook) and the employee
// self-service side (AttendancePunchIn/AttendancePunchOut/getTodayAttendance/
// AttendanceList).
// ============================================================
const findTeamAttendanceToday = (params) => dbConnection_2.User.findAndCountAll({
    where: {
        id: { [sequelize_1.Op.in]: params.allUserIds, [sequelize_1.Op.ne]: params.excludeUserId },
    },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "shiftId", "createdAt"],
    include: [
        {
            model: dbConnection_2.Attendance,
            as: "Attendances",
            where: { date: params.todayDateOnly },
            required: false,
            include: [{ model: dbConnection_2.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] }],
        },
    ],
    offset: params.offset,
    limit: params.limit,
    order: [["createdAt", "DESC"]],
});
exports.findTeamAttendanceToday = findTeamAttendanceToday;
const findAttendanceForDate = (employeeId, date) => dbConnection_2.Attendance.findOne({ where: { employee_id: employeeId, date } });
exports.findAttendanceForDate = findAttendanceForDate;
const createAttendanceRecord = (row) => dbConnection_2.Attendance.create(row);
exports.createAttendanceRecord = createAttendanceRecord;
const findEmployeeAttendancePaginated = (employeeId, limit, offset, dateFilter) => dbConnection_2.Attendance.findAndCountAll({
    // FIX: dateFilter's meaningful keys are the Sequelize Op.* Symbols
    // (Op.between/Op.gte/Op.lte) — Object.keys() only sees string keys, so
    // this always read as "empty" even when a real date range was built,
    // silently ignoring startDate/endDate on every call and returning the
    // employee's entire history instead of just the requested range.
    where: dateFilter && Reflect.ownKeys(dateFilter).length > 0
        ? { employee_id: employeeId, date: dateFilter }
        : { employee_id: employeeId },
    include: [{ model: dbConnection_2.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] }],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
});
exports.findEmployeeAttendancePaginated = findEmployeeAttendancePaginated;
// Flat attendance rows (one row per day, not the per-employee day-matrix
// attendanceBook uses) for the team attendance Excel export — joined with
// the owning employee so the sheet doesn't need a second round-trip per row.
const findTeamAttendanceForReport = (params) => dbConnection_2.Attendance.findAll({
    where: Object.assign({ employee_id: { [sequelize_1.Op.in]: params.employeeIds } }, (params.dateFilter && Reflect.ownKeys(params.dateFilter).length > 0
        ? { date: params.dateFilter }
        : {})),
    include: [
        { model: dbConnection_2.User, as: "user", attributes: ["id", "employeeCode", "firstName", "lastName", "email", "role"] },
        { model: dbConnection_2.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] },
    ],
    order: [
        ["employee_id", "ASC"],
        ["date", "ASC"],
    ],
});
exports.findTeamAttendanceForReport = findTeamAttendanceForReport;
const findCompanyById = (companyId) => dbConnection_2.Company.findByPk(companyId);
exports.findCompanyById = findCompanyById;
// This company's configured leave types — drives the bulk-upload status
// vocabulary dynamically (see BULK_ATTENDANCE_STATUS_MAP in the service)
// instead of a hardcoded, company-agnostic word list.
const findCompanyLeaveTypesForBulk = (companyId) => dbConnection_2.CompanyLeave.findAll({ where: { companyId }, attributes: ["id", "leaveName", "leaveCode"] });
exports.findCompanyLeaveTypesForBulk = findCompanyLeaveTypesForBulk;
// Validates a companyLeaveId belongs to the caller's own company before
// letting a single "Mark Attendance" action tag a day with it.
const findCompanyLeaveById = (id, companyId) => dbConnection_2.CompanyLeave.findOne({ where: { id, companyId } });
exports.findCompanyLeaveById = findCompanyLeaveById;
const findAttendanceRowsForBulk = (employeeIds, dates) => dbConnection_2.Attendance.findAll({
    where: {
        employee_id: { [sequelize_1.Op.in]: employeeIds },
        date: { [sequelize_1.Op.in]: dates },
    },
});
exports.findAttendanceRowsForBulk = findAttendanceRowsForBulk;
const saveBulkAttendance = (toUpdate, toCreate) => dbConnection_1.sequelize.transaction((t) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(toUpdate.map((row) => row.save({ transaction: t })));
    if (toCreate.length > 0) {
        yield dbConnection_2.Attendance.bulkCreate(toCreate, { transaction: t });
    }
}));
exports.saveBulkAttendance = saveBulkAttendance;
const findUsersWithAttendanceForMonth = (params) => dbConnection_2.User.findAndCountAll({
    where: Object.assign({ id: { [sequelize_1.Op.in]: params.childIds } }, params.search),
    attributes: ["id", "employeeCode", "firstName", "lastName", "role", "email", "dob", "profile"],
    include: [
        {
            model: dbConnection_2.Attendance,
            as: "Attendances",
            where: { date: { [sequelize_1.Op.between]: [params.startDate, params.endDate] } },
            required: false,
            include: [{ model: dbConnection_2.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode"] }],
        },
    ],
    offset: params.offset,
    limit: params.limit,
    order: [["firstName", "ASC"]],
    distinct: true,
});
exports.findUsersWithAttendanceForMonth = findUsersWithAttendanceForMonth;
// ---- Self-service (punch in/out, today, list) ----
const findEmployeeById = (employeeId) => dbConnection_2.User.findByPk(employeeId, { attributes: ["id", "firstName", "shiftId", "branchId"] });
exports.findEmployeeById = findEmployeeById;
const findShiftById = (shiftId) => dbConnection_2.Shift.findByPk(shiftId);
exports.findShiftById = findShiftById;
const findBranchById = (branchId) => dbConnection_2.Branch.findByPk(branchId);
exports.findBranchById = findBranchById;
// Whole-team employeeCode -> id lookup — used once, up front, to resolve
// the bulk sheet's "Employee ID" column (which now holds the human-facing
// EMP00001-style code, not the raw internal id) before any row processing.
const findTeamEmployeeCodes = (userIds) => dbConnection_2.User.findAll({ where: { id: { [sequelize_1.Op.in]: userIds } }, attributes: ["id", "employeeCode"] });
exports.findTeamEmployeeCodes = findTeamEmployeeCodes;
// Batch variants — used by bulkMarkAttendance so a whole sheet's worth of
// employees/shifts resolves in 2 queries instead of one per row.
const findUsersShiftInfo = (employeeIds) => dbConnection_2.User.findAll({ where: { id: { [sequelize_1.Op.in]: employeeIds } }, attributes: ["id", "firstName", "shiftId"] });
exports.findUsersShiftInfo = findUsersShiftInfo;
const findShiftsByIds = (shiftIds) => dbConnection_2.Shift.findAll({
    where: { id: { [sequelize_1.Op.in]: shiftIds } },
    attributes: ["id", "shiftName", "startTime", "endTime", "workingHours", "fullDayHours", "halfDayAfter"],
});
exports.findShiftsByIds = findShiftsByIds;
// FIX: previously had no date filter at all, so a stale "present" row left
// over from a day the auto punch-out cron didn't run (server downtime, etc.)
// would permanently block that employee from ever punching in again on any
// later day, with a confusing "already punched-in" error pointing at a
// session they can't see or close from today. Scoping to `date` means a
// stale past-day session no longer blocks today's punch-in at all — it's
// left for the cron/an admin correction to close out separately.
const findActivePunchSession = (employeeId, date) => dbConnection_2.Attendance.findOne({ where: { employee_id: employeeId, status: "present", date } });
exports.findActivePunchSession = findActivePunchSession;
// FIX: previously had no date filter when no explicit AttendanceId was
// given, so `order: [["id","DESC"]]` could close out whichever "present"
// row happened to have the highest id — a stale unclosed session from a
// day the auto punch-out cron missed, not necessarily today's — silently
// punching out the wrong day while today's own session stayed open.
// Scoping to `date` (when no explicit id override is given) guarantees a
// plain punch-out always closes today's own session.
const findActivePunchSessionById = (employeeId, date, attendanceId) => dbConnection_2.Attendance.findOne({
    where: attendanceId
        ? { employee_id: employeeId, status: "present", id: attendanceId }
        : { employee_id: employeeId, status: "present", date },
    order: [["id", "DESC"]],
});
exports.findActivePunchSessionById = findActivePunchSessionById;
const findLatestAttendanceForDate = (employeeId, date) => dbConnection_2.Attendance.findOne({
    where: { employee_id: employeeId, date },
    order: [["id", "DESC"]],
});
exports.findLatestAttendanceForDate = findLatestAttendanceForDate;
