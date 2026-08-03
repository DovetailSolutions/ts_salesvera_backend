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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeave = exports.getLeaveById = exports.getLeave = exports.addLeave = exports.ownLeave = exports.userLeave = exports.cancelLeaveAndMarkPresent = exports.getTodayLeaveRequests = exports.leaveList = exports.getTeamLeaveBalances = exports.getEmployeeLeaveBalance = exports.assignLeaveBalance = exports.resolveLeaveTypeBalance = exports.approveLeave = exports.createLeaveRequest = exports.inferLegacyLeaveTypeEnum = exports.countLeaveDays = exports.LEAVE_BALANCE_FIELDS = void 0;
const sequelize_1 = require("sequelize");
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
const companyAccess_1 = require("../shared/companyAccess");
const LeaveRepo = __importStar(require("./leave.repository"));
// ============================================================
// Leave service — validation + orchestration. Byte-for-byte port of the
// previous approveLeave/assignLeaveBalance/getEmployeeLeaveBalance/
// getTeamLeaveBalances/leaveList/getTodayLeaveRequests/
// cancelLeaveAndMarkPresent/userLeave/ownLeave/addLeave/getLeave/
// getLeaveById/updateLeave controller bodies in admin.ts.
// ============================================================
exports.LEAVE_BALANCE_FIELDS = {
    casual: { allocated: "casualLeaveAllocated", used: "casualLeaveUsed" },
    sick: { allocated: "sickLeaveAllocated", used: "sickLeaveUsed" },
    paid: { allocated: "paidLeaveAllocated", used: "paidLeaveUsed" },
};
const countLeaveDays = (from_date, to_date) => {
    const from = new Date(from_date);
    const to = new Date(to_date);
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};
exports.countLeaveDays = countLeaveDays;
// Shared by approveLeave (status: "rejected") and cancelLeaveAndMarkPresent —
// restores the balance consumed at request time and flips every Attendance
// row in the leave's date range from leave/leaveApproved to leaveReject.
const rejectLeaveAndRestoreBalance = (leave) => __awaiter(void 0, void 0, void 0, function* () {
    if (leave.status !== "rejected") {
        const days = (0, exports.countLeaveDays)(leave.from_date, leave.to_date);
        const year = new Date(leave.from_date).getFullYear();
        if (leave.companyLeaveId) {
            // Dynamic per-type balance — this request was deducted against a
            // specific company-configured leave type.
            const balanceRows = yield LeaveRepo.findEmployeeLeaveTypeBalances(leave.employee_id, year);
            const balance = balanceRows.find((b) => b.companyLeaveId === leave.companyLeaveId);
            if (balance) {
                balance.used = Math.max(0, balance.used - days);
                yield balance.save();
            }
        }
        else {
            // Legacy request with only the fixed leave_type enum, no companyLeaveId
            // (e.g. an older mobile client) — restore against the old 3-field table.
            const balanceField = exports.LEAVE_BALANCE_FIELDS[leave.leave_type];
            if (balanceField) {
                const balance = yield LeaveRepo.findLeaveBalance(leave.employee_id, year);
                if (balance) {
                    const used = balance[balanceField.used] || 0;
                    balance[balanceField.used] = Math.max(0, used - days);
                    yield balance.save();
                }
            }
        }
    }
    leave.status = "rejected";
    yield leave.save();
    yield LeaveRepo.markAttendanceForLeaveRange(leave.employee_id, leave.from_date, leave.to_date, ["leave", "leaveApproved"], "leaveReject");
});
// Best-effort mapping from a company's own configured leave-type name to the
// fixed Leave.leave_type ENUM column (sick/casual/paid/unpaid/short_leave/
// half_day) — that column is a real Postgres enum and can't grow a value per
// company, so it's kept only for record-keeping/half-day-detection while the
// actual balance math always runs off companyLeaveId instead (see below).
const inferLegacyLeaveTypeEnum = (leaveName) => {
    const n = (leaveName || "").toLowerCase();
    if (n.includes("half"))
        return "half_day";
    if (n.includes("short"))
        return "short_leave";
    if (n.includes("sick"))
        return "sick";
    if (n.includes("unpaid") || n.includes("loss of pay") || n.includes("lop"))
        return "unpaid";
    if (n.includes("paid") || n.includes("earned"))
        return "paid";
    return "casual";
};
exports.inferLegacyLeaveTypeEnum = inferLegacyLeaveTypeEnum;
// Web-app counterpart to the mobile-only self-service requestLeave in
// user.ts (POST /api/leave, deliberately left untouched here to avoid any
// risk to existing mobile clients) — lets an admin/manager log a leave
// request on behalf of one of their own team members (or themselves), e.g.
// a phoned-in sick day. Reuses the same balance/attendance mechanics as the
// self-service path: balance is deducted immediately on request, and one
// Attendance "leave" row per day is created (skipped for half_day/
// short_leave, which are partial-day and would otherwise collide with a
// normal punch-in/out row).
const createLeaveRequest = (loggedInId, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, from_date, to_date, reason, companyLeaveId } = body || {};
    const targetEmployeeId = employeeId ? Number(employeeId) : loggedInId;
    if (targetEmployeeId !== loggedInId) {
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        if (!childIds.includes(targetEmployeeId)) {
            throw new serviceError_1.ServiceError("You can only request leave on behalf of your own team members", 403);
        }
    }
    if (!from_date || !to_date || !reason) {
        throw new serviceError_1.ServiceError("from_date, to_date & reason are required");
    }
    if (!companyLeaveId) {
        throw new serviceError_1.ServiceError("companyLeaveId is required");
    }
    if (!callerCompanyId) {
        throw new serviceError_1.ServiceError("No company context — cannot resolve this company's leave types");
    }
    const from = new Date(from_date);
    const to = new Date(to_date);
    if (isNaN(from.getTime()) || isNaN(to.getTime()))
        throw new serviceError_1.ServiceError("Invalid date format");
    if (to < from)
        throw new serviceError_1.ServiceError("to_date must be after from_date");
    const leaveTypeRow = yield LeaveRepo.findCompanyLeaveByIdOnly(Number(companyLeaveId));
    if (!leaveTypeRow || Number(leaveTypeRow.companyId) !== Number(callerCompanyId)) {
        throw new serviceError_1.ServiceError("companyLeaveId is not a leave type configured for your company");
    }
    const leave_type = (0, exports.inferLegacyLeaveTypeEnum)(leaveTypeRow.leaveName);
    if (leave_type === "half_day" && from.getTime() !== to.getTime()) {
        throw new serviceError_1.ServiceError("half_day leave must have from_date equal to to_date");
    }
    const existingLeave = yield LeaveRepo.findOverlappingLeave(targetEmployeeId, from, to);
    if (existingLeave) {
        throw new serviceError_1.ServiceError("This employee already has a leave request overlapping this date range");
    }
    const days = (0, exports.countLeaveDays)(from, to);
    const year = from.getFullYear();
    const typeBalance = yield (0, exports.resolveLeaveTypeBalance)(targetEmployeeId, leaveTypeRow, year, loggedInId);
    const allocated = typeBalance.allocated || 0;
    const carriedForward = typeBalance.carriedForward || 0;
    const used = typeBalance.used || 0;
    const remaining = allocated + carriedForward - used;
    if (remaining < days) {
        throw new serviceError_1.ServiceError(`Insufficient ${leaveTypeRow.leaveName} balance (requested ${days} day(s), remaining ${remaining})`);
    }
    const leave = yield LeaveRepo.createLeaveRequest({
        employee_id: targetEmployeeId,
        from_date: from,
        to_date: to,
        reason,
        status: "pending",
        leave_type,
        companyLeaveId: leaveTypeRow.id,
    });
    typeBalance.used = used + days;
    yield typeBalance.save();
    if (leave_type !== "half_day" && leave_type !== "short_leave") {
        const leaveDates = [];
        for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
            leaveDates.push(new Date(cursor));
        }
        yield LeaveRepo.bulkCreateLeaveAttendance(leaveDates.map((date) => ({
            employee_id: targetEmployeeId,
            date,
            status: "leave",
            companyLeaveId: leaveTypeRow.id,
        })));
    }
    return leave;
});
exports.createLeaveRequest = createLeaveRequest;
const approveLeave = (loggedInId, body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { employee_id, leaveID, status } = body;
    if (!employee_id)
        throw new serviceError_1.ServiceError("Employee id is missing");
    if (!leaveID)
        throw new serviceError_1.ServiceError("leaveID id is missing");
    // FIX: previously trusted employee_id straight from the request body with
    // no check that the employee is on the caller's own team, letting any
    // admin approve/reject another company's leave requests by ID.
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    if (Number(employee_id) !== loggedInId && !childIds.includes(Number(employee_id))) {
        throw new serviceError_1.ServiceError("You can only manage leave requests of your own team members", 403);
    }
    const leave = yield LeaveRepo.findLeaveForEmployee(employee_id, leaveID);
    if (!leave)
        throw new serviceError_1.ServiceError("Leave not found");
    // Balance is deducted upfront when the employee requests leave (see
    // requestLeave in user.ts). Approval keeps it as-is; only a rejection
    // restores it below.
    if (status === "rejected") {
        yield rejectLeaveAndRestoreBalance(leave);
    }
    else if (status) {
        yield LeaveRepo.setLeaveStatus(leave, status);
    }
    if (status === "approved") {
        yield LeaveRepo.markAttendanceForLeaveRange(employee_id, leave.from_date, leave.to_date, ["leave"], "leaveApproved", (_a = leave.companyLeaveId) !== null && _a !== void 0 ? _a : null);
    }
    return leave;
});
exports.approveLeave = approveLeave;
// Formats one employee's dynamic per-type balances against the FULL list of
// the company's configured leave types — so a type that's never been
// explicitly assigned still shows up (as 0/0), instead of just silently
// missing from the response.
const formatDynamicBalances = (leaveTypes, balanceRows) => {
    const balanceByType = new Map(balanceRows.map((b) => [b.companyLeaveId, b]));
    return leaveTypes.map((lt) => {
        var _a, _b, _c, _d;
        const b = balanceByType.get(lt.id);
        const allocated = (_a = b === null || b === void 0 ? void 0 : b.allocated) !== null && _a !== void 0 ? _a : 0;
        const used = (_b = b === null || b === void 0 ? void 0 : b.used) !== null && _b !== void 0 ? _b : 0;
        const carriedForward = (_c = b === null || b === void 0 ? void 0 : b.carriedForward) !== null && _c !== void 0 ? _c : 0;
        return {
            companyLeaveId: lt.id,
            leaveName: lt.leaveName,
            leaveCode: lt.leaveCode,
            leavesPerYear: lt.leavesPerYear,
            carryForwardAllowed: !!lt.carryForward,
            carryForwardLimit: (_d = lt.carryForwardLimit) !== null && _d !== void 0 ? _d : 0,
            allocated,
            carriedForward,
            used,
            remaining: allocated + carriedForward - used,
        };
    });
};
// Finds this employee's balance row for (companyLeaveId, year), creating one
// if it doesn't exist yet — and on that FIRST creation only, computes how
// many days roll over from the immediately preceding year's unused balance
// (allocated + carriedForward - used), capped at that leave type's own
// CompanyLeave.carryForwardLimit, and only when CompanyLeave.carryForward is
// enabled. Once a row exists, its carriedForward is a normal persisted
// value — later edits to `allocated` (via assignLeaveBalance) never touch
// or recompute it, so it stays visibly distinct from this year's own grant.
const resolveLeaveTypeBalance = (employeeId, leaveType, year, assignedBy) => __awaiter(void 0, void 0, void 0, function* () {
    const priorYear = yield LeaveRepo.findLatestPriorYearBalance(employeeId, leaveType.id, year);
    let carriedForward = 0;
    if (priorYear && leaveType.carryForward) {
        const priorAvailable = Math.max(0, priorYear.allocated + priorYear.carriedForward - priorYear.used);
        carriedForward = Math.min(priorAvailable, Number(leaveType.carryForwardLimit) || 0);
    }
    const [balance] = yield LeaveRepo.findOrCreateLeaveTypeBalance({
        employeeId,
        companyLeaveId: leaveType.id,
        year,
        assignedBy,
        carriedForward,
    });
    return balance;
});
exports.resolveLeaveTypeBalance = resolveLeaveTypeBalance;
// balances: [{ companyLeaveId, allocated }] — one entry per company-configured
// leave type being set. Each allocated value is capped at that type's own
// CompanyLeave.leavesPerYear (the "rules defined at registration"), so an
// admin can't hand out more days than the company's own policy allows.
const assignLeaveBalance = (loggedInId, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, year, balances } = body || {};
    if (!employeeId || (Array.isArray(employeeId) && employeeId.length === 0)) {
        throw new serviceError_1.ServiceError("employeeId is required");
    }
    if (!Array.isArray(balances) || balances.length === 0) {
        throw new serviceError_1.ServiceError("balances array (companyLeaveId + allocated per type) is required");
    }
    if (!callerCompanyId) {
        throw new serviceError_1.ServiceError("No company context — cannot resolve this company's leave types");
    }
    const employeeIds = Array.isArray(employeeId)
        ? employeeId.map((id) => Number(id))
        : [Number(employeeId)];
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const unauthorizedIds = employeeIds.filter((id) => id !== loggedInId && !childIds.includes(id));
    if (unauthorizedIds.length > 0) {
        throw new serviceError_1.ServiceError(`You can only assign leave balance to your own sale_persons. Unauthorized employeeId(s): ${unauthorizedIds.join(", ")}`);
    }
    const targetYear = Number(year) || new Date().getFullYear();
    // Validate every requested companyLeaveId belongs to this company and cap
    // each allocation at that type's own configured leavesPerYear.
    const leaveTypes = yield LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId);
    const leaveTypeById = new Map(leaveTypes.map((lt) => [lt.id, lt]));
    const requested = balances.map((entry) => {
        const companyLeaveId = Number(entry.companyLeaveId);
        const leaveType = leaveTypeById.get(companyLeaveId);
        if (!leaveType) {
            throw new serviceError_1.ServiceError(`companyLeaveId ${companyLeaveId} is not a leave type configured for this company`);
        }
        const allocated = Math.max(0, Number(entry.allocated) || 0);
        if (allocated > leaveType.leavesPerYear) {
            throw new serviceError_1.ServiceError(`${leaveType.leaveName} is capped at ${leaveType.leavesPerYear} day(s)/year by this company's leave policy — cannot allocate ${allocated}`);
        }
        return { companyLeaveId, allocated };
    });
    const results = [];
    for (const empId of employeeIds) {
        for (const { companyLeaveId, allocated } of requested) {
            const leaveType = leaveTypeById.get(companyLeaveId);
            const balance = yield (0, exports.resolveLeaveTypeBalance)(empId, leaveType, targetYear, loggedInId);
            balance.allocated = allocated;
            balance.assignedBy = loggedInId;
            yield balance.save();
        }
        // Re-read the employee's full balance set (not just the types touched in
        // this call) — otherwise the response looks like every other configured
        // type just got reset to 0/0, even though only the requested ones were
        // actually written.
        const allBalances = yield LeaveRepo.findEmployeeLeaveTypeBalances(empId, targetYear);
        results.push({ employeeId: empId, year: targetYear, balances: formatDynamicBalances(leaveTypes, allBalances) });
    }
    return Array.isArray(employeeId) ? results : results[0];
});
exports.assignLeaveBalance = assignLeaveBalance;
const getEmployeeLeaveBalance = (loggedInId, employeeId, year, callerCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    if (Number(employeeId) !== loggedInId && !childIds.includes(Number(employeeId))) {
        throw new serviceError_1.ServiceError("You can only view leave balance of your own sale_persons");
    }
    if (!callerCompanyId) {
        throw new serviceError_1.ServiceError("No company context — cannot resolve this company's leave types");
    }
    const leaveTypes = yield LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId);
    // Materializes each type's balance row for this year on first view (not
    // only on explicit assignment), so a carried-forward amount is visible
    // immediately instead of only appearing after an admin happens to re-save
    // an allocation for the new year.
    if (leaveTypes.length > 0) {
        yield Promise.all(leaveTypes.map((lt) => (0, exports.resolveLeaveTypeBalance)(Number(employeeId), lt, year, loggedInId)));
    }
    const balanceRows = yield LeaveRepo.findEmployeeLeaveTypeBalances(Number(employeeId), year);
    return {
        employeeId: Number(employeeId),
        year,
        balances: formatDynamicBalances(leaveTypes, balanceRows),
    };
});
exports.getEmployeeLeaveBalance = getEmployeeLeaveBalance;
const getTeamLeaveBalances = (loggedInId, year, page, limit, offset, callerCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const leaveTypes = callerCompanyId ? yield LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId) : [];
    const { rows, count } = yield LeaveRepo.findTeamLeaveTypeBalances({ childIds, year, limit, offset });
    // Materialize this page's employees × configured types so a carried-
    // forward amount is visible the moment the list is viewed, not only after
    // someone explicitly re-assigns an allocation for the new year.
    if (leaveTypes.length > 0 && rows.length > 0) {
        yield Promise.all(rows.flatMap((user) => leaveTypes.map((lt) => (0, exports.resolveLeaveTypeBalance)(user.id, lt, year, loggedInId))));
    }
    const data = yield Promise.all(rows.map((user) => __awaiter(void 0, void 0, void 0, function* () {
        const userJson = user.toJSON();
        const balanceRows = leaveTypes.length > 0
            ? yield LeaveRepo.findEmployeeLeaveTypeBalances(user.id, year)
            : userJson.leaveTypeBalances || [];
        return Object.assign(Object.assign({}, userJson), { leaveBalances: formatDynamicBalances(leaveTypes, balanceRows) });
    })));
    return {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        data,
    };
});
exports.getTeamLeaveBalances = getTeamLeaveBalances;
const leaveList = (loggedInId, status, page, limit, offset) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const allUserIds = [loggedInId, ...childIds];
    const { rows, count } = yield LeaveRepo.findLeavesForUsersPaginated({
        allUserIds,
        excludeUserId: loggedInId,
        status,
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
exports.leaveList = leaveList;
const getTodayLeaveRequests = (loggedInId) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const [appliedToday, onLeaveToday] = yield LeaveRepo.findTodayLeaveActivity(childIds);
    return {
        appliedToday,
        appliedTodayCount: appliedToday.length,
        onLeaveToday,
        onLeaveTodayCount: onLeaveToday.length,
    };
});
exports.getTodayLeaveRequests = getTodayLeaveRequests;
const cancelLeaveAndMarkPresent = (loggedInId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, leaveID, date, punchIn } = body || {};
    if (!employeeId)
        throw new serviceError_1.ServiceError("employeeId is required");
    if (!leaveID)
        throw new serviceError_1.ServiceError("leaveID is required");
    // Team members only — covers any sale_person/manager (or deeper) under this admin/manager.
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    if (!childIds.includes(Number(employeeId))) {
        throw new serviceError_1.ServiceError("You can only manage attendance/leave for your own team members");
    }
    const leave = yield LeaveRepo.findLeaveForEmployee(employeeId, leaveID);
    if (!leave)
        throw new serviceError_1.ServiceError("Leave not found");
    // Cancel the leave: restores the balance consumed at request time and
    // flips every Attendance row in the leave's range to leaveReject.
    yield rejectLeaveAndRestoreBalance(leave);
    // Then mark the requested day present, overwriting whatever the
    // leave-cancellation step just set it to.
    const attendanceDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const punchInTime = punchIn ? new Date(punchIn) : new Date();
    const existing = yield LeaveRepo.findOrCreateAttendanceForDate(employeeId, attendanceDate);
    let record;
    if (existing) {
        existing.status = "present";
        existing.punch_in = punchInTime;
        yield existing.save();
        record = existing;
    }
    else {
        record = yield LeaveRepo.createPresentAttendance(employeeId, attendanceDate, punchInTime);
    }
    return { leave, attendance: record };
});
exports.cancelLeaveAndMarkPresent = cancelLeaveAndMarkPresent;
const userLeave = (loggedInId, userId, page, limit, offset) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    const requestedUserId = Number(userId);
    if (requestedUserId !== loggedInId && !childIds.includes(requestedUserId)) {
        throw new serviceError_1.ServiceError("You can only view leave records of your own team members", 403);
    }
    const { rows, count } = yield LeaveRepo.findEmployeeLeavesPaginated(requestedUserId, limit, offset);
    return {
        leave: rows,
        pagination: {
            totalRecords: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
        },
    };
});
exports.userLeave = userLeave;
const ownLeave = (employeeId, page, limit, offset) => __awaiter(void 0, void 0, void 0, function* () {
    const { rows, count } = yield LeaveRepo.findOwnLeavesPaginated(employeeId, limit, offset);
    return {
        isEmpty: rows.length === 0,
        leave: rows,
        pagination: {
            totalRecords: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
        },
    };
});
exports.ownLeave = ownLeave;
// ---- CompanyLeave (leave-type policy) ----
const addLeave = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { leaveTypes, companyId, branchId } = body;
    if (!Array.isArray(leaveTypes) || leaveTypes.length === 0) {
        throw new serviceError_1.ServiceError("leaveTypes array is required");
    }
    if (!companyId)
        throw new serviceError_1.ServiceError("Company ID is required");
    if (!branchId)
        throw new serviceError_1.ServiceError("Branch ID is required");
    const leaveData = leaveTypes.map((leave) => {
        if (!leave.leaveName || !leave.leaveCode || !leave.leavesPerYear) {
            throw new serviceError_1.ServiceError("leaveName, leaveCode, leavesPerYear are required in each item");
        }
        return {
            leaveName: String(leave.leaveName),
            leaveCode: String(leave.leaveCode),
            leavesPerYear: Number(leave.leavesPerYear),
            carryForward: Boolean(leave.carryForward),
            carryForwardLimit: Number(leave.carryForwardLimit || 0),
            managerApproval: Boolean(leave.managerApproval),
            companyId: Number(companyId),
            branchId: Number(branchId),
            userId: Number(userId),
            compOffBalance: Number(leave.compOffBalance || 0),
            casualLeaveBalance: Number(leave.casualLeaveBalance || 0),
            sickLeaveBalance: Number(leave.sickLeaveBalance || 0),
        };
    });
    return LeaveRepo.bulkCreateCompanyLeaves(leaveData);
});
exports.addLeave = addLeave;
const getLeave = (userId, role, query) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = "1", limit = "10", search = "", leaveCode, companyId, branchId, managerApproval } = query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;
    // Scoping by companyId (with an access check) shows every leave type
    // configured for that company regardless of which specific admin/manager
    // created each row — matches the branch/shift/department/holiday pattern.
    // Falling back to userId-only scoping when no companyId is given keeps the
    // old "browse leave types I personally created" behavior intact for any
    // caller that doesn't specify one.
    const whereCondition = {};
    if (companyId) {
        const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(companyId), userId, role);
        if (!allowed)
            throw new serviceError_1.ServiceError("You do not have access to this company", 403);
        whereCondition.companyId = Number(companyId);
    }
    else {
        whereCondition.userId = Number(userId);
    }
    if (search) {
        whereCondition[sequelize_1.Op.or] = [
            { leaveName: { [sequelize_1.Op.like]: `%${search}%` } },
            { leaveCode: { [sequelize_1.Op.like]: `%${search}%` } },
        ];
    }
    if (leaveCode)
        whereCondition.leaveCode = leaveCode;
    if (branchId)
        whereCondition.branchId = Number(branchId);
    if (managerApproval !== undefined)
        whereCondition.managerApproval = managerApproval === "true";
    const { rows, count } = yield LeaveRepo.findCompanyLeavesPaginated(whereCondition, pageSize, offset);
    return {
        total: count,
        currentPage: pageNumber,
        totalPages: Math.ceil(count / pageSize),
        data: rows,
    };
});
exports.getLeave = getLeave;
const getLeaveById = (id, userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (!id)
        throw new serviceError_1.ServiceError("Leave ID is required");
    const leave = yield LeaveRepo.findCompanyLeaveByIdOnly(Number(id));
    if (!leave)
        throw new serviceError_1.ServiceError("Leave not found");
    const allowed = yield (0, companyAccess_1.hasCompanyAccess)(leave.companyId, userId, role);
    if (!allowed)
        throw new serviceError_1.ServiceError("You do not have access to this leave type", 403);
    return leave;
});
exports.getLeaveById = getLeaveById;
const updateLeave = (id, userId, role, body) => __awaiter(void 0, void 0, void 0, function* () {
    if (!id)
        throw new serviceError_1.ServiceError("Leave ID is required");
    const leave = yield LeaveRepo.findCompanyLeaveByIdOnly(Number(id));
    if (!leave)
        throw new serviceError_1.ServiceError("Leave not found");
    const allowed = yield (0, companyAccess_1.hasCompanyAccess)(leave.companyId, userId, role);
    if (!allowed)
        throw new serviceError_1.ServiceError("You do not have access to this leave type", 403);
    const { leaveName, leaveCode, leavesPerYear, carryForward, carryForwardLimit, managerApproval, compOffBalance, casualLeaveBalance, sickLeaveBalance, } = body;
    const l = leave;
    if (leaveName !== undefined)
        l.leaveName = String(leaveName);
    if (leaveCode !== undefined)
        l.leaveCode = String(leaveCode);
    if (leavesPerYear !== undefined)
        l.leavesPerYear = Number(leavesPerYear);
    if (carryForward !== undefined)
        l.carryForward = Boolean(carryForward);
    if (carryForwardLimit !== undefined)
        l.carryForwardLimit = Number(carryForwardLimit);
    if (managerApproval !== undefined)
        l.managerApproval = Boolean(managerApproval);
    if (compOffBalance !== undefined)
        l.compOffBalance = Number(compOffBalance);
    if (casualLeaveBalance !== undefined)
        l.casualLeaveBalance = Number(casualLeaveBalance);
    if (sickLeaveBalance !== undefined)
        l.sickLeaveBalance = Number(sickLeaveBalance);
    yield leave.save();
    return leave;
});
exports.updateLeave = updateLeave;
