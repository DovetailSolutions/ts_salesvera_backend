"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayAttendance = exports.attendancePunchOut = exports.getDayTypeFromWorkingHours = exports.attendancePunchIn = exports.bulkMarkAttendance = exports.exportAttendanceReportExcel = exports.attendanceBook = exports.userAttendance = exports.markAttendancePresent = exports.getAttendance = void 0;
const sequelize_1 = require("sequelize");
const spaces_1 = require("../../config/spaces");
const XLSX = __importStar(require("xlsx"));
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
const AttendanceRepo = __importStar(require("./attendance.repository"));
// ============================================================
// Attendance service — validation + orchestration. Byte-for-byte port of the
// previous getAttendance/markAttendancePresent/bulkMarkAttendance/
// userAttendance/AttendanceBook (admin.ts) and AttendancePunchIn/
// AttendancePunchOut/getDayTypeFromWorkingHours/getTodayAttendance/
// AttendanceList (user.ts) controller bodies.
// ============================================================
const getPagination = (query) => {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
// ---- Admin/team-scoped ----
const getAttendance = (loggedInId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, offset } = getPagination(query);
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const allUserIds = [loggedInId, ...childIds];
    const todayDateOnly = new Date().toISOString().slice(0, 10);
    const { rows, count } = yield AttendanceRepo.findTeamAttendanceToday({
        allUserIds,
        excludeUserId: loggedInId,
        todayDateOnly,
        limit,
        offset,
    });
    return {
        data: rows,
        pagination: {
            totalRecords: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
        },
    };
});
exports.getAttendance = getAttendance;
const LEAVE_STATUSES = ["leave", "leaveApproved", "leaveReject"];
// The single "Mark Attendance" action's outcome vocabulary — deliberately a
// small fixed set of machine-friendly values (not bulk's free-text CSV
// words) since this is driven by a UI dropdown, not a spreadsheet cell.
// "leave" always requires a companyLeaveId (which specific configured type).
const MARK_ATTENDANCE_STATUSES = ["present", "half_day", "absent", "leave"];
// Statuses that mean "showed up" — only these are gated by the shift-start
// window and only these get shift-derived punch data at all.
const SHOWED_UP_STATUSES = ["present", "half_day"];
const markAttendancePresent = (loggedInId, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, date, punchIn, companyLeaveId } = body || {};
    const status = MARK_ATTENDANCE_STATUSES.includes(body === null || body === void 0 ? void 0 : body.status) ? body.status : "present";
    if (!employeeId)
        throw new serviceError_1.ServiceError("employeeId is required");
    if (status === "leave" && !companyLeaveId) {
        throw new serviceError_1.ServiceError("companyLeaveId is required when marking a specific leave type");
    }
    // Team members only — covers any sale_person/manager (or deeper) under this admin/manager.
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    if (!childIds.includes(Number(employeeId))) {
        throw new serviceError_1.ServiceError("You can only mark attendance for your own team members");
    }
    let leaveTypeRow = null;
    if (status === "leave") {
        if (!callerCompanyId)
            throw new serviceError_1.ServiceError("No company context — cannot resolve this company's leave types");
        leaveTypeRow = yield AttendanceRepo.findCompanyLeaveById(Number(companyLeaveId), callerCompanyId);
        if (!leaveTypeRow)
            throw new serviceError_1.ServiceError("companyLeaveId is not a leave type configured for your company");
    }
    const attendanceDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const employee = (yield AttendanceRepo.findEmployeeById(Number(employeeId)));
    const shift = (employee === null || employee === void 0 ? void 0 : employee.shiftId) ? yield AttendanceRepo.findShiftById(employee.shiftId) : null;
    const company = (shift === null || shift === void 0 ? void 0 : shift.companyId) ? yield AttendanceRepo.findCompanyById(shift.companyId) : null;
    // Shift-start gate — only meaningful for a "showed up" outcome on
    // "today": marking someone present/half-day for a past date is a
    // correction, not a real-time attendance event, and absent/leave never
    // involve showing up at all. Skipped entirely if the employee has no
    // assigned shift.
    const todayDateOnly = new Date().toISOString().slice(0, 10);
    if (SHOWED_UP_STATUSES.includes(status) && attendanceDate === todayDateOnly && isBeforeShiftWindow(shift, attendanceDate)) {
        throw new serviceError_1.ServiceError(formatShiftWindowMessage(shift, attendanceDate, employee === null || employee === void 0 ? void 0 : employee.firstName));
    }
    const fields = buildMarkAttendanceFields(status, shift, company, attendanceDate, punchIn, leaveTypeRow);
    const existing = yield AttendanceRepo.findAttendanceForDate(employeeId, attendanceDate);
    if (existing) {
        // Already on a leave-type status — don't let a routine correction
        // silently clobber it unless the admin is deliberately re-marking it as
        // a (possibly different) leave outcome. Anything else (present/half-day/
        // absent) must go through cancelling the leave first.
        if (LEAVE_STATUSES.includes(existing.status) && status !== "leave") {
            throw new serviceError_1.ServiceError(`This employee is marked "${existing.status}" on ${attendanceDate}. Reject/cancel the leave first before marking ${status.replace("_", " ")}.`);
        }
        existing.status = fields.status;
        existing.companyLeaveId = fields.companyLeaveId;
        // Never overwrite a real punch already on the record (e.g. the employee
        // already self-punched-in for real) — only fill in shift-derived times
        // when there's nothing there yet. Non-"showed up" outcomes (absent/
        // leave) always clear punch data — the day didn't happen that way.
        if (SHOWED_UP_STATUSES.includes(status) && existing.punch_in) {
            // keep the existing real punch as-is
        }
        else {
            existing.punch_in = fields.punchIn;
            existing.punch_out = fields.punchOut;
            existing.working_hours = fields.workingHours;
            existing.dayType = fields.dayType;
            existing.overtime = fields.overtime;
        }
        yield existing.save();
        return existing;
    }
    return AttendanceRepo.createAttendanceRecord({
        employee_id: employeeId,
        date: attendanceDate,
        punch_in: fields.punchIn,
        punch_out: fields.punchOut,
        working_hours: fields.workingHours,
        dayType: fields.dayType,
        overtime: fields.overtime,
        status: fields.status,
        companyLeaveId: fields.companyLeaveId,
    });
});
exports.markAttendancePresent = markAttendancePresent;
// Builds the Attendance fields for each of the single-mark outcomes:
// - present: shift-derived full day (unchanged from before this status
//   picker existed) — falls back to the caller-supplied/now punch-in with
//   no punch-out when the employee has no assigned shift at all.
// - half_day: shift-derived, but only half the shift's normal working
//   hours — a genuine partial-attendance record (punch data + working_hours),
//   not a zero-hours leave-like entry.
// - absent / leave: no punch data at all — the day didn't involve showing up.
const buildMarkAttendanceFields = (status, shift, company, attendanceDate, punchIn, leaveTypeRow) => {
    if (status === "absent") {
        return { status: "absent", companyLeaveId: null, punchIn: null, punchOut: null, workingHours: null, dayType: null, overtime: null };
    }
    if (status === "leave") {
        return { status: "leaveApproved", companyLeaveId: leaveTypeRow.id, punchIn: null, punchOut: null, workingHours: null, dayType: null, overtime: null };
    }
    if (status === "half_day") {
        const start = (shift === null || shift === void 0 ? void 0 : shift.startTime) ? shiftStartInstant(shift, attendanceDate) : null;
        const officeHours = (shift === null || shift === void 0 ? void 0 : shift.workingHours) && shift.workingHours > 0 ? shift.workingHours : 8;
        const halfHours = officeHours / 2;
        if (start) {
            const end = new Date(start.getTime() + halfHours * 60 * 60 * 1000);
            return { status: "present", companyLeaveId: null, punchIn: start, punchOut: end, workingHours: Number(halfHours.toFixed(2)), dayType: "half_day", overtime: 0 };
        }
        const fallbackStart = punchIn ? new Date(punchIn) : new Date();
        return { status: "present", companyLeaveId: null, punchIn: fallbackStart, punchOut: null, workingHours: null, dayType: "half_day", overtime: null };
    }
    // status === "present"
    const derived = (shift === null || shift === void 0 ? void 0 : shift.startTime)
        ? deriveShiftPunchFields(shift, company, attendanceDate)
        : { punchIn: punchIn ? new Date(punchIn) : new Date(), punchOut: null, workingHours: null, dayType: null, overtime: null };
    return Object.assign({ status: "present", companyLeaveId: null }, derived);
};
const userAttendance = (loggedInId, userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const employeeId = Number(userId);
    if (!Number.isInteger(employeeId) || employeeId < 0) {
        throw new serviceError_1.ServiceError("Invalid userId");
    }
    // FIX: this previously had no ownership check at all — any caller with
    // attendance:view could pass any userId and read another team's data.
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    if (employeeId !== loggedInId && !childIds.includes(employeeId)) {
        throw new serviceError_1.ServiceError("You can only view attendance of your own team members", 403);
    }
    const { page, limit, offset } = getPagination(query);
    const dateFilter = getDateFilter(query);
    const { rows, count } = yield AttendanceRepo.findEmployeeAttendancePaginated(employeeId, limit, offset, dateFilter);
    return {
        attendance: rows,
        pagination: {
            totalRecords: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
        },
    };
});
exports.userAttendance = userAttendance;
const getDateFilter = (query) => {
    const { startDate, endDate, lastDays, today } = query;
    const filter = {};
    if (startDate && endDate) {
        filter[sequelize_1.Op.between] = [new Date(startDate), new Date(endDate)];
    }
    else if (startDate) {
        filter[sequelize_1.Op.gte] = new Date(startDate);
    }
    else if (endDate) {
        filter[sequelize_1.Op.lte] = new Date(endDate);
    }
    if (lastDays) {
        const now = new Date();
        const past = new Date();
        past.setDate(now.getDate() - Number(lastDays));
        filter[sequelize_1.Op.between] = [past, now];
    }
    if (today === "true") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        filter[sequelize_1.Op.between] = [start, end];
    }
    return filter;
};
const generateDayMap = (totalDays) => Object.fromEntries(Array.from({ length: totalDays }, (_, i) => [String(i + 1), "-"]));
const buildSearchFilter = (search) => search
    ? {
        [sequelize_1.Op.or]: [
            { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
            { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
        ],
    }
    : {};
const attendanceBook = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(userId);
    if (!childIds.length) {
        throw new serviceError_1.ServiceError("No child users found");
    }
    const month = Number(query.month) || new Date().getMonth() + 1;
    const year = Number(query.year) || new Date().getFullYear();
    const search = String(query.search || "");
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 10;
    const offset = (pageNum - 1) * limitNum;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const totalDays = endDate.getDate();
    const { rows: users, count: totalCount } = yield AttendanceRepo.findUsersWithAttendanceForMonth({
        childIds,
        search: buildSearchFilter(search),
        startDate,
        endDate,
        limit: limitNum,
        offset,
    });
    const totalPages = Math.ceil(totalCount / limitNum);
    const formatted = users.map((u) => {
        var _a, _b;
        const days = generateDayMap(totalDays);
        // dayType (full_day/half_day/short_leave) is a separate column from
        // status — surfaced alongside `days` so the UI can tell an admin exactly
        // what they're about to overwrite (e.g. "Sick Leave — Half Day")
        // instead of just the coarse status.
        const dayTypes = {};
        // Which specific company-configured leave type (if any) produced this
        // day's leave/leaveApproved status — lets the UI show "Sick Leave"
        // instead of just the generic "On Leave".
        const leaveTypes = {};
        if ((_a = u.Attendances) === null || _a === void 0 ? void 0 : _a.length) {
            u.Attendances.forEach((attendance) => {
                var _a;
                const day = new Date(attendance.date).getDate();
                days[String(day)] = (_a = attendance.status) !== null && _a !== void 0 ? _a : "-";
                if (attendance.dayType)
                    dayTypes[String(day)] = attendance.dayType;
                if (attendance.leaveType) {
                    leaveTypes[String(day)] = { id: attendance.leaveType.id, name: attendance.leaveType.leaveName };
                }
            });
        }
        return {
            id: u.id,
            employeeCode: (_b = u.employeeCode) !== null && _b !== void 0 ? _b : null,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            dob: u.dob,
            profile: u.profile,
            role: u.role,
            days,
            dayTypes,
            leaveTypes,
        };
    });
    return {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        users: formatted,
    };
});
exports.attendanceBook = attendanceBook;
// Flat, per-day Excel export of an admin/manager's own team's attendance —
// distinct from attendanceBook's per-employee day-matrix view, this is one
// row per attendance record so it can be opened directly as a payroll-style
// register. Scoped to childIds only (never includes the caller's own
// attendance), same ownership rule as attendanceBook/markAttendancePresent.
const exportAttendanceReportExcel = (loggedInId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    if (!childIds.length) {
        throw new serviceError_1.ServiceError("No child users found");
    }
    let employeeIds = childIds;
    if (query.userId) {
        const requestedId = Number(query.userId);
        if (!childIds.includes(requestedId)) {
            throw new serviceError_1.ServiceError("You can only export attendance of your own team members", 403);
        }
        employeeIds = [requestedId];
    }
    const dateFilter = getDateFilter(query);
    if (Reflect.ownKeys(dateFilter).length === 0) {
        // No range given — default to the current calendar month (same default
        // attendanceBook uses) instead of dumping an employee's entire history.
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateFilter[sequelize_1.Op.between] = [start, end];
    }
    const rows = yield AttendanceRepo.findTeamAttendanceForReport({ employeeIds, dateFilter });
    const formatClockTime = (value) => {
        if (!value)
            return "";
        const d = new Date(value);
        if (isNaN(d.getTime()))
            return "";
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const sheetRows = rows.map((row) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        const plain = row.get ? row.get({ plain: true }) : row;
        return {
            "Employee Code": (_b = (_a = plain.user) === null || _a === void 0 ? void 0 : _a.employeeCode) !== null && _b !== void 0 ? _b : "",
            "Employee Name": `${(_d = (_c = plain.user) === null || _c === void 0 ? void 0 : _c.firstName) !== null && _d !== void 0 ? _d : ""} ${(_f = (_e = plain.user) === null || _e === void 0 ? void 0 : _e.lastName) !== null && _f !== void 0 ? _f : ""}`.trim(),
            "Email": (_h = (_g = plain.user) === null || _g === void 0 ? void 0 : _g.email) !== null && _h !== void 0 ? _h : "",
            "Role": (_k = (_j = plain.user) === null || _j === void 0 ? void 0 : _j.role) !== null && _k !== void 0 ? _k : "",
            "Date": String((_l = plain.date) !== null && _l !== void 0 ? _l : "").slice(0, 10),
            "Status": (_m = plain.status) !== null && _m !== void 0 ? _m : "",
            "Leave Type": (_p = (_o = plain.leaveType) === null || _o === void 0 ? void 0 : _o.leaveName) !== null && _p !== void 0 ? _p : "",
            "Punch In": formatClockTime(plain.punch_in),
            "Punch Out": formatClockTime(plain.punch_out),
            "Working Hours": (_q = plain.working_hours) !== null && _q !== void 0 ? _q : "",
            "Day Type": (_r = plain.dayType) !== null && _r !== void 0 ? _r : "",
            "Overtime": (_s = plain.overtime) !== null && _s !== void 0 ? _s : "",
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [{ "No records found for the selected range": "" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return {
        buffer,
        filename: `attendance-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    };
});
exports.exportAttendanceReportExcel = exportAttendanceReportExcel;
// ---- Bulk attendance upload ----
// Keys are space-separated (not snake_case) because normalizeStatusKey folds
// underscores to spaces too — so "half_day", "Half Day" and "half day" all
// normalize the same way regardless of which style the caller sends.
// Generic, non-leave-type-specific statuses (present/absent/week off/
// holiday) plus a legacy fallback for the old free-text leave words, kept
// for backward compatibility with templates downloaded before leave types
// became company-configurable — these never carry a companyLeaveId.
const BULK_ATTENDANCE_STATUS_MAP = {
    absent: "absent",
    present: "present",
    "double present": "present",
    "week off": "holiday",
    holiday: "holiday",
    "half day": "leaveApproved",
    "unpaid leave": "leaveApproved",
    "paid leave": "leaveApproved",
    "sick leave": "leaveApproved",
    "casual leave": "leaveApproved",
    "comp leave": "leaveApproved",
};
const normalizeStatusKey = (value) => String(value !== null && value !== void 0 ? value : "").trim().toLowerCase().replace(/[_\s]+/g, " ");
// This company's configured leave types (by name or code) resolve to
// leaveApproved + the specific type's id — takes priority over the generic
// legacy map so "Comp Leave", "Maternity Leave", or any other custom type
// configured at registration is recognized by name in the bulk template.
const buildDynamicLeaveStatusMap = (leaveTypes) => {
    const map = {};
    for (const lt of leaveTypes) {
        const entry = { status: "leaveApproved", companyLeaveId: lt.id };
        map[normalizeStatusKey(lt.leaveName)] = entry;
        map[normalizeStatusKey(lt.leaveCode)] = entry;
    }
    return map;
};
const resolveBulkStatus = (rawStatus, dynamicLeaveMap) => {
    const key = normalizeStatusKey(rawStatus);
    if (dynamicLeaveMap[key])
        return dynamicLeaveMap[key];
    const legacyStatus = BULK_ATTENDANCE_STATUS_MAP[key];
    return legacyStatus ? { status: legacyStatus, companyLeaveId: null } : null;
};
// Uses local getters (not toISOString) — toISOString converts to UTC first,
// which shifts non-ISO date strings (e.g. CSV-reformatted "7/6/26") back a
// day in any timezone ahead of UTC.
const formatLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};
const normalizeHeaderDate = (value) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
        return formatLocalDate(value);
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
        return value.trim().slice(0, 10);
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : formatLocalDate(parsed);
};
// A date-column cell may hold a status word (handled above) OR a punch-in
// clock time (e.g. "09:15", "9:15:00", "9:15 AM") to backfill a real
// punch_in for a past date. Excel time-formatted cells and plain text both
// come through sheet_to_json as strings in this format, so a status-word
// miss is retried against this pattern before falling back to "unknown".
const TIME_OF_DAY_RE = /^([0-1]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?$/i;
const parseTimeOfDayOnDate = (dateStr, value) => {
    var _a;
    const raw = String(value !== null && value !== void 0 ? value : "").trim();
    const match = raw.match(TIME_OF_DAY_RE);
    if (!match)
        return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;
    const meridiem = (_a = match[4]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (meridiem) {
        if (hours < 1 || hours > 12)
            return null;
        if (meridiem === "am")
            hours = hours === 12 ? 0 : hours;
        else
            hours = hours === 12 ? 12 : hours + 12;
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const result = new Date(y, m - 1, d, hours, minutes, seconds);
    return isNaN(result.getTime()) ? null : result;
};
const bulkMarkAttendance = (loggedInId, companyId, file, body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d, _e, _f;
    // Resolved once (not per-row) — bulk uploads don't carry per-employee
    // shift context, but they should still respect whether this company has
    // opted into overtime tracking at all, instead of always assuming yes.
    const bulkCompany = companyId ? yield AttendanceRepo.findCompanyById(Number(companyId)) : null;
    const bulkOvertimeAllowed = (_d = bulkCompany === null || bulkCompany === void 0 ? void 0 : bulkCompany.overtimeAllowed) !== null && _d !== void 0 ? _d : false;
    const bulkLeaveTypes = companyId ? yield AttendanceRepo.findCompanyLeaveTypesForBulk(Number(companyId)) : [];
    const dynamicLeaveMap = buildDynamicLeaveStatusMap(bulkLeaveTypes);
    if (!file)
        throw new serviceError_1.ServiceError("Attendance file (.csv or .xlsx) is required");
    const data = yield (0, spaces_1.getObjectFromSpaces)(file.key, file.bucket);
    if (!data.Body)
        throw new serviceError_1.ServiceError("Unable to read file from Spaces");
    const chunks = [];
    try {
        for (var _g = true, _h = __asyncValues(data.Body), _j; _j = yield _h.next(), _a = _j.done, !_a; _g = true) {
            _c = _j.value;
            _g = false;
            const chunk = _c;
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_g && !_a && (_b = _h.return)) yield _b.call(_h);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const buffer = Buffer.concat(chunks);
    // Parse .csv explicitly as text instead of relying on XLSX's binary-format
    // auto-detection — guards against edge cases (BOM from "CSV UTF-8" saves,
    // CRLF line endings, commas inside quoted names) silently mis-parsing.
    const isCsv = (file.originalname || "").toLowerCase().endsWith(".csv") || file.mimetype === "text/csv";
    const BOM = String.fromCharCode(0xfeff);
    const workbook = isCsv
        ? XLSX.read(buffer.toString("utf8").replace(new RegExp(`^${BOM}`), ""), {
            type: "string",
            cellDates: true,
            raw: false,
        })
        : XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "employee_details") ||
        workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
    });
    if (rows.length < 2)
        throw new serviceError_1.ServiceError("No attendance rows found in the uploaded file");
    const [headerRow, ...dataRows] = rows;
    // Column 0: Staff Name, 1: Employee ID, 2: Job Title, 3+: dates
    const dateColumns = [];
    for (let i = 3; i < headerRow.length; i++) {
        const date = normalizeHeaderDate(headerRow[i]);
        if (date)
            dateColumns.push({ index: i, date });
    }
    const dateColumnIndexByDate = new Map(dateColumns.map(({ index, date }) => [date, index]));
    // The frontend also sends fromDate/toDate alongside the file (the range
    // picked in the UI). When present, that range — not just the columns the
    // sheet happens to have — decides which dates get processed per
    // employee; any date in range with no column or a blank cell defaults to
    // "present" instead of being silently skipped.
    const { fromDate, toDate } = body;
    let rangeDates = dateColumns.map((c) => c.date);
    if (fromDate && toDate) {
        const normalizedFrom = normalizeHeaderDate(fromDate);
        const normalizedTo = normalizeHeaderDate(toDate);
        if (!normalizedFrom || !normalizedTo)
            throw new serviceError_1.ServiceError("Invalid fromDate/toDate");
        if (normalizedFrom > normalizedTo)
            throw new serviceError_1.ServiceError("fromDate must be before toDate");
        const start = new Date(normalizedFrom);
        const end = new Date(normalizedTo);
        const MAX_RANGE_DAYS = 366;
        const spanDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        if (spanDays > MAX_RANGE_DAYS)
            throw new serviceError_1.ServiceError(`Date range too large (max ${MAX_RANGE_DAYS} days)`);
        rangeDates = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            rangeDates.push(formatLocalDate(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
    }
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const allowedIds = new Set([loggedInId, ...childIds]);
    const skippedNonNumericEmployeeId = [];
    const skippedNotInTeam = [];
    const skippedUnknownStatus = [];
    const skippedWrongShift = [];
    const skippedTooEarly = [];
    // "Employee ID" column holds each employee's human-facing code
    // (EMP00001, from the template's own "Employee ID" column) — resolved
    // against this caller's team up front, once, rather than per row. A bare
    // number is still accepted as a fallback (older templates downloaded
    // before employee codes existed, or someone typing the internal id
    // directly), so nothing already in the wild breaks.
    const teamForCodes = allowedIds.size ? yield AttendanceRepo.findTeamEmployeeCodes([...allowedIds]) : [];
    const idByEmployeeCode = new Map(teamForCodes
        .filter((u) => u.employeeCode)
        .map((u) => [String(u.employeeCode).toUpperCase(), u.id]));
    const resolveEmployeeIdCell = (rawCell) => {
        const trimmed = String(rawCell !== null && rawCell !== void 0 ? rawCell : "").trim();
        if (!trimmed)
            return null;
        const byCode = idByEmployeeCode.get(trimmed.toUpperCase());
        if (byCode !== undefined)
            return byCode;
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
    };
    // Pass 1: collect every row's employeeId that resolves to someone on this
    // caller's team, so their shifts can be resolved in one batch query each
    // (2 queries total) instead of one query per row.
    const validEmployeeIds = [];
    for (const row of dataRows) {
        const resolved = resolveEmployeeIdCell(row[1]);
        if (resolved !== null && allowedIds.has(resolved)) {
            validEmployeeIds.push(resolved);
        }
    }
    const requestedShiftId = body.shiftId ? Number(body.shiftId) : null;
    const employeeShiftInfo = validEmployeeIds.length ? yield AttendanceRepo.findUsersShiftInfo(validEmployeeIds) : [];
    const shiftInfoByEmployee = new Map(employeeShiftInfo.map((u) => { var _a, _b; return [u.id, { shiftId: (_a = u.shiftId) !== null && _a !== void 0 ? _a : null, firstName: (_b = u.firstName) !== null && _b !== void 0 ? _b : null }]; }));
    const involvedShiftIds = [...new Set(employeeShiftInfo.map((u) => u.shiftId).filter((id) => !!id))];
    const shiftsById = involvedShiftIds.length
        ? new Map((yield AttendanceRepo.findShiftsByIds(involvedShiftIds)).map((s) => [s.id, s]))
        : new Map();
    const todayDateOnly = new Date().toISOString().slice(0, 10);
    const assignments = [];
    const employeeIds = new Set();
    for (const row of dataRows) {
        const rawEmployeeId = row[1];
        const resolvedEmployeeId = resolveEmployeeIdCell(rawEmployeeId);
        if (resolvedEmployeeId === null) {
            if (String(rawEmployeeId !== null && rawEmployeeId !== void 0 ? rawEmployeeId : "").trim())
                skippedNonNumericEmployeeId.push(rawEmployeeId);
            continue;
        }
        const employeeId = resolvedEmployeeId;
        if (!allowedIds.has(employeeId)) {
            skippedNotInTeam.push(employeeId);
            continue;
        }
        const empShiftInfo = shiftInfoByEmployee.get(employeeId);
        // If this upload was scoped to a specific shift (dropdown), reject any
        // employee not actually assigned to that shift outright — guards
        // against a manually-edited sheet slipping someone in under the wrong
        // roster.
        if (requestedShiftId && (empShiftInfo === null || empShiftInfo === void 0 ? void 0 : empShiftInfo.shiftId) !== requestedShiftId) {
            skippedWrongShift.push(employeeId);
            continue;
        }
        const empShift = (empShiftInfo === null || empShiftInfo === void 0 ? void 0 : empShiftInfo.shiftId) ? shiftsById.get(empShiftInfo.shiftId) : null;
        // Only "present" rows for TODAY are gated — marking someone present for
        // a past date is a correction (no "about to start" to wait for), and
        // leave/holiday rows don't involve showing up at all. No assigned shift
        // never gates (nothing to wait for).
        const applyIfNotTooEarly = (date, status, extra = {}) => {
            var _a;
            if (status === "present" && date === todayDateOnly && empShift && isBeforeShiftWindow(empShift, date)) {
                skippedTooEarly.push({
                    employeeId,
                    date,
                    reason: formatShiftWindowMessage(empShift, date, (_a = empShiftInfo === null || empShiftInfo === void 0 ? void 0 : empShiftInfo.firstName) !== null && _a !== void 0 ? _a : undefined),
                });
                return;
            }
            employeeIds.add(employeeId);
            assignments.push(Object.assign({ employee_id: employeeId, date, status }, extra));
        };
        for (const date of rangeDates) {
            const colIndex = dateColumnIndexByDate.get(date);
            const rawStatus = colIndex !== undefined ? row[colIndex] : undefined;
            // No column for this date, or the cell is blank: default to present
            // rather than silently skipping the day.
            if (!String(rawStatus !== null && rawStatus !== void 0 ? rawStatus : "").trim()) {
                applyIfNotTooEarly(date, "present");
                continue;
            }
            const resolved = resolveBulkStatus(rawStatus, dynamicLeaveMap);
            if (resolved) {
                applyIfNotTooEarly(date, resolved.status, { companyLeaveId: resolved.companyLeaveId });
                continue;
            }
            // Not a recognized status word — try it as a punch-in clock time
            // (e.g. "09:15") to backfill a real punch_in for that date.
            const punchInTime = parseTimeOfDayOnDate(date, rawStatus);
            if (punchInTime) {
                applyIfNotTooEarly(date, "present", { punch_in: punchInTime });
                continue;
            }
            skippedUnknownStatus.push({ employeeId, date, status: rawStatus });
        }
    }
    if (assignments.length === 0) {
        return {
            applied: 0,
            skippedNonNumericEmployeeId,
            skippedNotInTeam,
            skippedUnknownStatus,
            skippedWrongShift,
            skippedTooEarly,
        };
    }
    const dates = [...new Set(assignments.map((a) => a.date))];
    const existingRows = yield AttendanceRepo.findAttendanceRowsForBulk([...employeeIds], dates);
    const existingMap = new Map();
    for (const row of existingRows) {
        existingMap.set(`${row.employee_id}|${row.date}`, row);
    }
    const toCreate = [];
    const toUpdate = [];
    // Same employee -> shift resolution built for the start-time gate above,
    // reused here so a bulk-backfilled punch's half-day/overtime classification
    // respects that employee's own shift thresholds — matching what
    // self-service punch-out already does — instead of silently falling back
    // to the hardcoded 8h/4h split for everyone.
    const resolveEmployeeShift = (employeeId) => {
        var _a;
        const info = shiftInfoByEmployee.get(employeeId);
        return (info === null || info === void 0 ? void 0 : info.shiftId) ? (_a = shiftsById.get(info.shiftId)) !== null && _a !== void 0 ? _a : null : null;
    };
    for (const assignment of assignments) {
        const key = `${assignment.employee_id}|${assignment.date}`;
        const existing = existingMap.get(key);
        const empShiftForRow = resolveEmployeeShift(assignment.employee_id);
        if (assignment.status === "present") {
            // Punch-in/out are derived from the employee's assigned shift, same
            // as the single "Mark Present" action — a typed punch-in time (e.g.
            // "09:15") overrides the shift's own start, but punch_out (and the
            // working_hours/dayType/overtime built from it) still comes from the
            // shift's end time, so a bulk-marked day reflects the hours actually
            // scheduled instead of staying null forever.
            const derived = deriveShiftPunchFields(empShiftForRow, bulkCompany, assignment.date, (_e = assignment.punch_in) !== null && _e !== void 0 ? _e : null);
            if (existing) {
                existing.status = "present";
                // A real punch means they showed up — no longer a leave day, so any
                // prior leave-type association is stale and must be cleared.
                existing.companyLeaveId = null;
                existing.punch_in = derived.punchIn;
                // Prefer an existing real punch_out if there is one and it's later
                // than the (possibly new) punch_in — don't discard a genuine punch
                // just because this row is being backfilled/re-marked.
                const keepExistingPunchOut = existing.punch_out && existing.punch_out > derived.punchIn;
                existing.punch_out = keepExistingPunchOut ? existing.punch_out : derived.punchOut;
                if (existing.punch_out) {
                    const workingHours = Number(((existing.punch_out.getTime() - derived.punchIn.getTime()) / (1000 * 60 * 60)).toFixed(2));
                    const officeHours = (empShiftForRow === null || empShiftForRow === void 0 ? void 0 : empShiftForRow.workingHours) && empShiftForRow.workingHours > 0 ? empShiftForRow.workingHours : 8;
                    existing.working_hours = workingHours;
                    existing.dayType = (0, exports.getDayTypeFromWorkingHours)(workingHours, empShiftForRow, bulkCompany);
                    existing.overtime = bulkOvertimeAllowed && workingHours > officeHours ? Number((workingHours - officeHours).toFixed(2)) : 0;
                }
                else {
                    existing.working_hours = null;
                    existing.dayType = null;
                    existing.overtime = null;
                }
                toUpdate.push(existing);
            }
            else {
                toCreate.push(Object.assign(Object.assign({}, assignment), { punch_in: derived.punchIn, punch_out: derived.punchOut, working_hours: derived.workingHours, dayType: derived.dayType, overtime: derived.overtime }));
            }
        }
        else if (existing) {
            // Bulk-marking overwrites the day's status directly; punch-derived
            // fields from any prior real punch no longer apply and must be
            // cleared, or they end up contradicting the new status (e.g.
            // status "absent" next to a full punched day's hours).
            existing.status = assignment.status;
            existing.companyLeaveId = (_f = assignment.companyLeaveId) !== null && _f !== void 0 ? _f : null;
            existing.punch_in = null;
            existing.punch_out = null;
            existing.working_hours = null;
            existing.dayType = null;
            existing.overtime = null;
            toUpdate.push(existing);
        }
        else {
            toCreate.push(assignment);
        }
    }
    // All rows for this upload commit or roll back together (transaction).
    yield AttendanceRepo.saveBulkAttendance(toUpdate, toCreate);
    return {
        applied: assignments.length,
        created: toCreate.length,
        updated: toUpdate.length,
        skippedNonNumericEmployeeId,
        skippedNotInTeam,
        skippedUnknownStatus,
        skippedWrongShift,
        skippedTooEarly,
    };
});
exports.bulkMarkAttendance = bulkMarkAttendance;
// ---- Self-service (punch in/out, today, list) ----
const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
// ── Shift-start gate ─────────────────────────────────────────────────────
// An employee's attendance for "today" can only be marked present starting
// this many minutes before their assigned shift's start time ("about to
// start") — shared by markAttendancePresent, bulkMarkAttendance, and
// self-service punch-in so "shift about to start" means the same instant
// everywhere in the app, not three slightly different rules.
const EARLY_MARK_LEAD_MINUTES = 30;
// dateStr: "YYYY-MM-DD". Builds the actual Date instant the shift starts on
// that day from its "HH:mm[:ss]" startTime string.
const shiftStartInstant = (shift, dateStr) => {
    if (!(shift === null || shift === void 0 ? void 0 : shift.startTime))
        return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    const [h, min] = String(shift.startTime).split(":").map(Number);
    return new Date(y, (m || 1) - 1, d, h || 0, min || 0, 0);
};
// Builds the shift's end instant on `dateStr`, rolling to the next calendar
// day when endTime <= startTime (a night shift crossing midnight, e.g.
// 22:00–06:00) — otherwise a same-day "end before start" would produce a
// negative/zero working-hours span.
const shiftEndInstant = (shift, dateStr) => {
    if (!(shift === null || shift === void 0 ? void 0 : shift.endTime))
        return null;
    const start = shiftStartInstant(shift, dateStr);
    const [y, m, d] = dateStr.split("-").map(Number);
    const [h, min] = String(shift.endTime).split(":").map(Number);
    const end = new Date(y, (m || 1) - 1, d, h || 0, min || 0, 0);
    if (start && end <= start)
        end.setDate(end.getDate() + 1);
    return end;
};
// Derives punch_in/punch_out/working_hours/dayType/overtime for a day being
// marked present administratively (single mark or a bulk "present" row)
// from the employee's assigned shift — so a retroactively-marked day
// reflects the hours they were actually scheduled to work, not an arbitrary
// time an admin happened to pick. `explicitPunchIn` (bulk's punch-time-
// backfill cells, e.g. "09:15") overrides the shift's own start time while
// punch_out still comes from the shift's end. Returns punch_in only (no
// punch_out/derived fields) when there's no assigned shift, matching the
// previous fallback behavior for shift-less employees.
const deriveShiftPunchFields = (shift, company, dateStr, explicitPunchIn) => {
    const punchIn = explicitPunchIn !== null && explicitPunchIn !== void 0 ? explicitPunchIn : shiftStartInstant(shift, dateStr);
    const punchOut = shiftEndInstant(shift, dateStr);
    if (!punchIn || !punchOut || punchOut <= punchIn) {
        return { punchIn: punchIn !== null && punchIn !== void 0 ? punchIn : new Date(), punchOut: null, workingHours: null, dayType: null, overtime: null };
    }
    const workingHours = Number(((punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60)).toFixed(2));
    const officeHours = (shift === null || shift === void 0 ? void 0 : shift.workingHours) && shift.workingHours > 0 ? shift.workingHours : 8;
    const overtime = (company === null || company === void 0 ? void 0 : company.overtimeAllowed) && workingHours > officeHours ? Number((workingHours - officeHours).toFixed(2)) : 0;
    const dayType = (0, exports.getDayTypeFromWorkingHours)(workingHours, shift, company);
    return { punchIn, punchOut, workingHours, dayType, overtime };
};
// True when `atInstant` is still more than EARLY_MARK_LEAD_MINUTES before
// the shift's start on `dateStr` — i.e. too early to mark present yet.
// No assigned shift (shift is null) never gates — there's nothing to wait
// for, matching how punch-in already behaves when no shift is assigned.
const isBeforeShiftWindow = (shift, dateStr, atInstant = new Date()) => {
    const start = shiftStartInstant(shift, dateStr);
    if (!start)
        return false;
    const earliestAllowed = new Date(start.getTime() - EARLY_MARK_LEAD_MINUTES * 60000);
    return atInstant < earliestAllowed;
};
const formatShiftWindowMessage = (shift, dateStr, employeeName) => {
    const start = shiftStartInstant(shift, dateStr);
    const earliestAllowed = new Date(start.getTime() - EARLY_MARK_LEAD_MINUTES * 60000);
    const fmt = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const who = employeeName ? `${employeeName}'s` : "This employee's";
    const shiftLabel = shift.shiftName ? `${shift.shiftName} shift` : "shift";
    return `${who} ${shiftLabel} starts at ${fmt(start)} — attendance can only be marked from ${fmt(earliestAllowed)} onward.`;
};
// Resolve an employee's assigned shift + their company's attendance
// policy + their branch (for geofencing) — precedence used throughout this
// file: employee's Shift > Company policy > hardcoded fallback, only when
// neither is configured.
//
// FIX: companyId used to be derived ONLY from the shift/branch's own
// companyId — fine for a sale_person (always has both), but admin/manager
// accounts routinely have neither (shiftId/branchId are null), so company
// silently resolved to null for them: late-marking fell back to a
// hardcoded 09:30/no-grace regardless of the company's actual
// lateMarkAfter policy, and overtime could never be credited since
// company.overtimeAllowed was never even looked up. `callerCompanyId` is
// the same companyId tokenCheck already resolves for every role (via
// Company.adminId/CompanyAdmin for admin, CompanyManager for manager) —
// passing it through here means an admin/manager without a shift still
// gets their real company's policy instead of a hardcoded stand-in.
const resolveAttendanceContext = (employeeId, callerCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const employee = (yield AttendanceRepo.findEmployeeById(employeeId));
    const [shift, branch] = yield Promise.all([
        (employee === null || employee === void 0 ? void 0 : employee.shiftId) ? AttendanceRepo.findShiftById(employee.shiftId) : Promise.resolve(null),
        (employee === null || employee === void 0 ? void 0 : employee.branchId) ? AttendanceRepo.findBranchById(employee.branchId) : Promise.resolve(null),
    ]);
    const companyId = (_c = (_b = (_a = shift === null || shift === void 0 ? void 0 : shift.companyId) !== null && _a !== void 0 ? _a : branch === null || branch === void 0 ? void 0 : branch.companyId) !== null && _b !== void 0 ? _b : callerCompanyId) !== null && _c !== void 0 ? _c : null;
    const company = companyId ? yield AttendanceRepo.findCompanyById(companyId) : null;
    return { shift: shift, company: company, branch: branch };
});
const attendancePunchIn = (finalUserId, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { punch_in, latitude_in, longitude_in } = body || {};
    if (!punch_in)
        throw new serviceError_1.ServiceError("Punch-in time is required");
    // FIX: was new Date().toISOString().slice(0,10) — toISOString() converts
    // to UTC first, which rolls the calendar day backward for any local time
    // before ~05:30 IST, silently recording an early-morning punch against
    // yesterday instead of today. formatLocalDate uses local getters instead,
    // matching the fix already applied to bulk attendance in this same file.
    const today = formatLocalDate(new Date());
    const activeSession = yield AttendanceRepo.findActivePunchSession(finalUserId, today);
    if (activeSession)
        throw new serviceError_1.ServiceError("You have already punched-in. Please punch-out first.");
    const { shift, company, branch } = yield resolveAttendanceContext(Number(finalUserId), callerCompanyId);
    // Shift-start gate — can't punch in for today until the assigned shift is
    // about to start (within EARLY_MARK_LEAD_MINUTES of its start time). No
    // assigned shift skips this entirely.
    if (isBeforeShiftWindow(shift, today)) {
        throw new serviceError_1.ServiceError(formatShiftWindowMessage(shift, today));
    }
    // Geofencing — only enforced when the company requires it AND the
    // employee's branch has geofence data configured; missing config never
    // blocks a punch (there's nothing to enforce against).
    const geofencingActive = ((_a = company === null || company === void 0 ? void 0 : company.geoFencingRequired) !== null && _a !== void 0 ? _a : true) &&
        ((_b = company === null || company === void 0 ? void 0 : company.officeLocationRequired) !== null && _b !== void 0 ? _b : true) &&
        (branch === null || branch === void 0 ? void 0 : branch.latitude) != null &&
        (branch === null || branch === void 0 ? void 0 : branch.longitude) != null &&
        Number(branch === null || branch === void 0 ? void 0 : branch.geoRadius) > 0;
    if (geofencingActive) {
        if (latitude_in == null || longitude_in == null) {
            throw new serviceError_1.ServiceError("Location is required to punch in for this company");
        }
        const distance = haversineMeters(Number(latitude_in), Number(longitude_in), Number(branch.latitude), Number(branch.longitude));
        if (distance > Number(branch.git)) {
            throw new serviceError_1.ServiceError(`You are ${Math.round(distance)}m away from ${branch.branchName || "your branch"} — must be within ${branch.geoRadius}m to punch in`);
        }
    }
    // Check if this is the first punch of the day to determine "late" status
    // — shift start time + company grace minutes, falling back to 09:30 with
    // no grace only when neither is configured.
    const existingRecordsForToday = yield AttendanceRepo.findAttendanceForDate(finalUserId, today);
    let late = false;
    if (!existingRecordsForToday) {
        const officeStartTime = (shift === null || shift === void 0 ? void 0 : shift.startTime) || "09:30:00";
        const graceMinutes = (_c = company === null || company === void 0 ? void 0 : company.lateMarkAfter) !== null && _c !== void 0 ? _c : 0;
        const [y, m, d] = today.split("-").map(Number);
        const [startHour, startMin] = String(officeStartTime).split(":").map(Number);
        const officeTime = new Date(y, (m || 1) - 1, d, startHour || 0, (startMin || 0) + graceMinutes, 0);
        const punchInTime = new Date(punch_in);
        if (punchInTime > officeTime)
            late = true;
    }
    const punchInTime = new Date(punch_in);
    // A row for today already exists but isn't an active "present" session
    // (already punched out once today, or an admin-marked absent/leave/holiday
    // day) — reuse that same row instead of creating a second one for the
    // same employee+date, which the rest of the app (Mark Attendance,
    // Attendance Register, bulk upload) all assume is unique. A genuine punch
    // is the most authoritative record of what actually happened that day, so
    // it overrides whatever the row previously said. "late" reflects the
    // day's first arrival only — preserved as-is on a re-punch, not recomputed.
    if (existingRecordsForToday) {
        existingRecordsForToday.punch_in = punchInTime;
        existingRecordsForToday.punch_out = null;
        existingRecordsForToday.working_hours = null;
        existingRecordsForToday.dayType = null;
        existingRecordsForToday.overtime = null;
        existingRecordsForToday.status = "present";
        existingRecordsForToday.companyLeaveId = null;
        existingRecordsForToday.latitude_in = latitude_in;
        existingRecordsForToday.longitude_in = longitude_in;
        yield existingRecordsForToday.save();
        return existingRecordsForToday;
    }
    return AttendanceRepo.createAttendanceRecord({
        employee_id: finalUserId,
        date: today,
        punch_in: punchInTime,
        status: "present",
        late,
        latitude_in,
        longitude_in,
    });
});
exports.attendancePunchIn = attendancePunchIn;
// Derived from a punch-out session's working_hours against the employee's
// shift thresholds (fullDayHours / halfDayAfter, both in HOURS — compared
// directly against workingHours) when a shift is assigned, falling back to
// the company's autoHalfDayAfter policy (registration Step3 — collected in
// MINUTES, per that form's own label, so it's converted to hours here)
// when the shift itself doesn't specify one, and only then to an 8h full
// day / 4h half day hardcoded split — same "Shift > Company > hardcoded"
// precedence used throughout this file (geofencing, lateMarkAfter, etc.).
// Previously this used a hardcoded <3h / <9h split regardless of shift —
// which, e.g., misclassified a full 8h day as "half_day" since 8 < 9.
const getDayTypeFromWorkingHours = (workingHours, shift, company) => {
    const fullDayThreshold = (shift === null || shift === void 0 ? void 0 : shift.fullDayHours) && shift.fullDayHours > 0 ? shift.fullDayHours : 8;
    const companyHalfDayHours = (company === null || company === void 0 ? void 0 : company.autoHalfDayAfter) && company.autoHalfDayAfter > 0
        ? company.autoHalfDayAfter / 60
        : null;
    const halfDayThreshold = (shift === null || shift === void 0 ? void 0 : shift.halfDayAfter) && shift.halfDayAfter > 0
        ? shift.halfDayAfter
        : companyHalfDayHours !== null && companyHalfDayHours !== void 0 ? companyHalfDayHours : fullDayThreshold / 2;
    if (workingHours < Math.min(3, halfDayThreshold))
        return "short_leave";
    if (workingHours < fullDayThreshold)
        return "half_day";
    return "full_day";
};
exports.getDayTypeFromWorkingHours = getDayTypeFromWorkingHours;
const attendancePunchOut = (finalUserId, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { punch_out, AttendanceId, latitude_out, longitude_out } = body || {};
    if (!punch_out)
        throw new serviceError_1.ServiceError("Punch-out time is required");
    const today = formatLocalDate(new Date());
    const attendance = yield AttendanceRepo.findActivePunchSessionById(finalUserId, today, AttendanceId);
    if (!attendance)
        throw new serviceError_1.ServiceError("No active punch-in record found. Please punch-in first.");
    const punchInTime = new Date(attendance.punch_in);
    const punchOutTime = new Date(punch_out);
    if (punchOutTime < punchInTime)
        throw new serviceError_1.ServiceError("Punch-out must be after punch-in");
    const diffMs = punchOutTime.getTime() - punchInTime.getTime();
    const workingHours = diffMs / (1000 * 60 * 60);
    const workingHoursRounded = Number(workingHours.toFixed(2));
    const { shift, company } = yield resolveAttendanceContext(Number(finalUserId), callerCompanyId);
    // Overtime — only computed when the company has opted in; baseline from
    // the employee's shift working-hours, falling back to 8h.
    const overtimeAllowed = (_a = company === null || company === void 0 ? void 0 : company.overtimeAllowed) !== null && _a !== void 0 ? _a : false;
    const officeHours = (shift === null || shift === void 0 ? void 0 : shift.workingHours) && shift.workingHours > 0 ? shift.workingHours : 8;
    const overtime = overtimeAllowed && workingHoursRounded > officeHours
        ? Number((workingHoursRounded - officeHours).toFixed(2))
        : 0;
    attendance.punch_out = punchOutTime;
    attendance.working_hours = workingHoursRounded;
    attendance.overtime = overtime;
    attendance.latitude_out = latitude_out;
    attendance.longitude_out = longitude_out;
    attendance.status = "out";
    attendance.dayType = (0, exports.getDayTypeFromWorkingHours)(workingHoursRounded, shift, company);
    yield attendance.save();
    return attendance;
});
exports.attendancePunchOut = attendancePunchOut;
const getTodayAttendance = (finalUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = formatLocalDate(new Date());
    const record = yield AttendanceRepo.findLatestAttendanceForDate(finalUserId, today);
    if (!record)
        throw new serviceError_1.ServiceError("No attendance found for today");
    return record;
});
exports.getTodayAttendance = getTodayAttendance;
