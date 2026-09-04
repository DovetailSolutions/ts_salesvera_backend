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
exports.findTeamLeaveTypeBalances = exports.findBalancesForUserIds = exports.findOrCreateLeaveTypeBalance = exports.findLatestPriorYearBalance = exports.findEmployeeLeaveTypeBalances = exports.findCompanyLeaveTypesForCompany = exports.findCompanyLeaveByIdOnly = exports.findCompanyLeaveOwnedBy = exports.findCompanyLeavesPaginated = exports.bulkCreateCompanyLeaves = exports.findTeamLeaveBalances = exports.findLeaveBalance = exports.findOrCreateLeaveBalance = exports.findOwnLeavesPaginated = exports.findEmployeeLeavesPaginated = exports.fillMissingLeaveAttendance = exports.bulkCreateLeaveAttendance = exports.createLeaveRequest = exports.findOverlappingLeave = exports.createPresentAttendance = exports.findOrCreateAttendanceForDate = exports.findTodayLeaveActivity = exports.findLeavesForUsersPaginated = exports.markAttendanceForLeaveRange = exports.setLeaveStatus = exports.findLeaveForEmployee = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const dateUtils_1 = require("../shared/dateUtils");
// ============================================================
// Leave repository — wraps all direct Sequelize access for this domain.
// Covers three sub-models: Leave (requests), EmployeeLeaveBalance
// (per-employee/year allocations), CompanyLeave (leave-type policies).
// ============================================================
// ---- Leave (requests) ----
const findLeaveForEmployee = (employeeId, id) => dbConnection_1.Leave.findOne({ where: { employee_id: employeeId, id } });
exports.findLeaveForEmployee = findLeaveForEmployee;
const setLeaveStatus = (leave, status) => __awaiter(void 0, void 0, void 0, function* () {
    leave.status = status;
    yield leave.save();
    return leave;
});
exports.setLeaveStatus = setLeaveStatus;
const markAttendanceForLeaveRange = (employeeId, fromDate, toDate, fromStatus, toStatus, companyLeaveId) => dbConnection_1.Attendance.update(Object.assign({ status: toStatus }, (companyLeaveId !== undefined ? { companyLeaveId } : {})), {
    where: {
        employee_id: employeeId,
        date: { [sequelize_1.Op.between]: [fromDate, toDate] },
        status: { [sequelize_1.Op.in]: fromStatus },
    },
});
exports.markAttendanceForLeaveRange = markAttendanceForLeaveRange;
const findLeavesForUsersPaginated = (params) => dbConnection_1.User.findAndCountAll({
    where: {
        id: {
            [sequelize_1.Op.in]: params.allUserIds,
            [sequelize_1.Op.ne]: params.excludeUserId,
        },
    },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "createdAt"],
    include: [
        {
            model: dbConnection_1.Leave,
            as: "Leaves",
            required: false,
            where: params.status ? { status: params.status } : undefined,
        },
    ],
    order: [["createdAt", "DESC"]],
    limit: params.limit,
    offset: params.offset,
    distinct: true,
});
exports.findLeavesForUsersPaginated = findLeavesForUsersPaginated;
const findTodayLeaveActivity = (childIds) => {
    // FIX: todayStart/todayEnd were computed via setHours(0, 0, 0, 0) on a
    // fresh local Date, which only lands on IST midnight if the server
    // process's OS timezone happens to be set to Asia/Kolkata — true on this
    // dev machine but not guaranteed on the production droplet (cloud Linux
    // images commonly default to UTC). Deriving the IST calendar day via
    // getISTDateString() first, then parsing its midnight boundaries with an
    // explicit +05:30 offset, yields the correct UTC instants regardless of
    // the server's local timezone configuration.
    const todayIST = (0, dateUtils_1.getISTDateString)();
    const todayStart = new Date(`${todayIST}T00:00:00.000+05:30`);
    const todayEnd = new Date(`${todayIST}T23:59:59.999+05:30`);
    // FIX: was new Date().toISOString().slice(0, 10) — toISOString() converts
    // to UTC first, which rolls the calendar day backward for any real-world
    // IST time before ~05:30 AM (e.g. 2:30 AM IST still reports yesterday's
    // date). This from_date/to_date range check decides "who is on leave
    // today" for the dashboard's On Leave Today widget, so a wrong "today"
    // here silently shows the wrong day's leave data. Use getISTDateString()
    // (explicit +5:30 offset arithmetic) instead.
    const todayDateOnly = (0, dateUtils_1.getISTDateString)();
    const userAttributes = ["id", "firstName", "lastName", "email", "phone", "role"];
    return Promise.all([
        dbConnection_1.Leave.findAll({
            where: {
                employee_id: { [sequelize_1.Op.in]: childIds },
                createdAt: { [sequelize_1.Op.between]: [todayStart, todayEnd] },
            },
            include: [{ model: dbConnection_1.User, as: "user", attributes: userAttributes }],
            order: [["createdAt", "DESC"]],
        }),
        dbConnection_1.Leave.findAll({
            where: {
                employee_id: { [sequelize_1.Op.in]: childIds },
                from_date: { [sequelize_1.Op.lte]: todayDateOnly },
                to_date: { [sequelize_1.Op.gte]: todayDateOnly },
            },
            include: [{ model: dbConnection_1.User, as: "user", attributes: userAttributes }],
            order: [["from_date", "ASC"]],
        }),
    ]);
};
exports.findTodayLeaveActivity = findTodayLeaveActivity;
const findOrCreateAttendanceForDate = (employeeId, date) => dbConnection_1.Attendance.findOne({ where: { employee_id: employeeId, date } });
exports.findOrCreateAttendanceForDate = findOrCreateAttendanceForDate;
const createPresentAttendance = (employeeId, date, punchIn) => dbConnection_1.Attendance.create({
    employee_id: employeeId,
    date,
    punch_in: punchIn,
    status: "present",
});
exports.createPresentAttendance = createPresentAttendance;
const findOverlappingLeave = (employeeId, from, to) => dbConnection_1.Leave.findOne({
    where: {
        employee_id: employeeId,
        status: { [sequelize_1.Op.in]: ["pending", "approved"] },
        from_date: { [sequelize_1.Op.lte]: to },
        to_date: { [sequelize_1.Op.gte]: from },
    },
});
exports.findOverlappingLeave = findOverlappingLeave;
const createLeaveRequest = (data) => dbConnection_1.Leave.create(data);
exports.createLeaveRequest = createLeaveRequest;
const bulkCreateLeaveAttendance = (rows) => dbConnection_1.Attendance.bulkCreate(rows);
exports.bulkCreateLeaveAttendance = bulkCreateLeaveAttendance;
// FIX (ATT-001): createLeaveRequest deliberately skips creating a placeholder
// Attendance row for half_day/short_leave (they're partial-day, and a
// placeholder would collide with a real punch-in/out that day) — but
// approveLeave's markAttendanceForLeaveRange only ever UPDATES an existing
// row, so those two leave types ended up with no Attendance row at all once
// approved: the register/reports showed the day as a plain, unexplained
// absence, indistinguishable from a no-show. findOrCreate here only fills
// the gap where NOTHING exists yet (i.e. the employee never punched in) —
// a real punch for that day is left completely untouched, preserving the
// original intent.
const fillMissingLeaveAttendance = (employeeId, dates, companyLeaveId, dayType) => __awaiter(void 0, void 0, void 0, function* () {
    for (const date of dates) {
        yield dbConnection_1.Attendance.findOrCreate({
            where: { employee_id: employeeId, date },
            defaults: {
                employee_id: employeeId,
                date,
                status: "leaveApproved",
                companyLeaveId,
                dayType,
            },
        });
    }
});
exports.fillMissingLeaveAttendance = fillMissingLeaveAttendance;
const findEmployeeLeavesPaginated = (employeeId, limit, offset) => dbConnection_1.Leave.findAndCountAll({
    where: { employee_id: employeeId },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
});
exports.findEmployeeLeavesPaginated = findEmployeeLeavesPaginated;
const findOwnLeavesPaginated = (employeeId, limit, offset) => dbConnection_1.Leave.findAndCountAll({
    where: { employee_id: employeeId },
    limit,
    offset,
    order: [["id", "DESC"]],
});
exports.findOwnLeavesPaginated = findOwnLeavesPaginated;
// ---- EmployeeLeaveBalance ----
const findOrCreateLeaveBalance = (params) => dbConnection_1.EmployeeLeaveBalance.findOrCreate({
    where: { employeeId: params.employeeId, year: params.year },
    defaults: {
        employeeId: params.employeeId,
        year: params.year,
        companyId: params.companyId,
        branchId: params.branchId,
        assignedBy: params.assignedBy,
    },
});
exports.findOrCreateLeaveBalance = findOrCreateLeaveBalance;
const findLeaveBalance = (employeeId, year) => dbConnection_1.EmployeeLeaveBalance.findOne({ where: { employeeId, year } });
exports.findLeaveBalance = findLeaveBalance;
const findTeamLeaveBalances = (params) => dbConnection_1.User.findAndCountAll({
    where: { id: { [sequelize_1.Op.in]: params.childIds } },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "createdAt"],
    include: [
        {
            model: dbConnection_1.EmployeeLeaveBalance,
            as: "leaveBalances",
            required: false,
            where: { year: params.year },
        },
    ],
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
});
exports.findTeamLeaveBalances = findTeamLeaveBalances;
// ---- CompanyLeave (leave-type policy) ----
const bulkCreateCompanyLeaves = (rows) => dbConnection_1.CompanyLeave.bulkCreate(rows);
exports.bulkCreateCompanyLeaves = bulkCreateCompanyLeaves;
const findCompanyLeavesPaginated = (where, limit, offset) => dbConnection_1.CompanyLeave.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
});
exports.findCompanyLeavesPaginated = findCompanyLeavesPaginated;
const findCompanyLeaveOwnedBy = (id, userId) => dbConnection_1.CompanyLeave.findOne({ where: { id, userId } });
exports.findCompanyLeaveOwnedBy = findCompanyLeaveOwnedBy;
// Plain lookup with no ownership filter — used once the caller's access has
// already been verified via shared/companyAccess.ts's hasCompanyAccess (same
// pattern as company/branch/shift/department/holiday), so any admin/manager
// of the company can manage its leave types, not just whichever specific
// user originally created them.
const findCompanyLeaveByIdOnly = (id) => dbConnection_1.CompanyLeave.findByPk(id);
exports.findCompanyLeaveByIdOnly = findCompanyLeaveByIdOnly;
// Every leave type configured for a company (+ optionally scoped to one
// branch), regardless of which specific admin/manager created each row —
// the source of truth for "which leave types exist here" everywhere dynamic
// dropdowns/templates need to read from.
const findCompanyLeaveTypesForCompany = (companyId, branchId) => dbConnection_1.CompanyLeave.findAll({
    where: Object.assign({ companyId }, (branchId ? { branchId } : {})),
    order: [["leaveName", "ASC"]],
});
exports.findCompanyLeaveTypesForCompany = findCompanyLeaveTypesForCompany;
// ---- EmployeeLeaveTypeBalance (dynamic per-configured-type balance) ----
const findEmployeeLeaveTypeBalances = (employeeId, year) => dbConnection_1.EmployeeLeaveTypeBalance.findAll({
    where: { employeeId, year },
    include: [{ model: dbConnection_1.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear"] }],
});
exports.findEmployeeLeaveTypeBalances = findEmployeeLeaveTypeBalances;
// The immediately preceding year's balance for this employee/type, if any —
// the source carry-forward is computed from. Carry-forward only ever rolls
// one year forward from whatever was actually recorded, never further back.
const findLatestPriorYearBalance = (employeeId, companyLeaveId, year) => dbConnection_1.EmployeeLeaveTypeBalance.findOne({ where: { employeeId, companyLeaveId, year: year - 1 } });
exports.findLatestPriorYearBalance = findLatestPriorYearBalance;
const findOrCreateLeaveTypeBalance = (params) => {
    var _a;
    return dbConnection_1.EmployeeLeaveTypeBalance.findOrCreate({
        where: { employeeId: params.employeeId, companyLeaveId: params.companyLeaveId, year: params.year },
        defaults: {
            employeeId: params.employeeId,
            companyLeaveId: params.companyLeaveId,
            year: params.year,
            assignedBy: params.assignedBy,
            carriedForward: (_a = params.carriedForward) !== null && _a !== void 0 ? _a : 0,
        },
    });
};
exports.findOrCreateLeaveTypeBalance = findOrCreateLeaveTypeBalance;
const findBalancesForUserIds = (userIds, year) => dbConnection_1.EmployeeLeaveTypeBalance.findAll({
    where: { employeeId: { [sequelize_1.Op.in]: userIds }, year },
    include: [{ model: dbConnection_1.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear"] }],
});
exports.findBalancesForUserIds = findBalancesForUserIds;
const findTeamLeaveTypeBalances = (params) => dbConnection_1.User.findAndCountAll({
    where: { id: { [sequelize_1.Op.in]: params.childIds } },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "createdAt"],
    include: [
        {
            model: dbConnection_1.EmployeeLeaveTypeBalance,
            as: "leaveTypeBalances",
            required: false,
            where: { year: params.year },
            include: [{ model: dbConnection_1.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear"] }],
        },
    ],
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
});
exports.findTeamLeaveTypeBalances = findTeamLeaveTypeBalances;
