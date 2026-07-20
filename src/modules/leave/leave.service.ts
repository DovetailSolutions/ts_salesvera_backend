import { Op } from "sequelize";
import { ServiceError } from "../shared/serviceError";
import { getAllChildUserIds } from "../shared/userHierarchy";
import { hasCompanyAccess } from "../shared/companyAccess";
import * as LeaveRepo from "./leave.repository";

// ============================================================
// Leave service — validation + orchestration. Byte-for-byte port of the
// previous approveLeave/assignLeaveBalance/getEmployeeLeaveBalance/
// getTeamLeaveBalances/leaveList/getTodayLeaveRequests/
// cancelLeaveAndMarkPresent/userLeave/ownLeave/addLeave/getLeave/
// getLeaveById/updateLeave controller bodies in admin.ts.
// ============================================================

export const LEAVE_BALANCE_FIELDS: Record<string, { allocated: string; used: string }> = {
  casual: { allocated: "casualLeaveAllocated", used: "casualLeaveUsed" },
  sick: { allocated: "sickLeaveAllocated", used: "sickLeaveUsed" },
  paid: { allocated: "paidLeaveAllocated", used: "paidLeaveUsed" },
};

export const countLeaveDays = (from_date: string | Date, to_date: string | Date): number => {
  const from = new Date(from_date);
  const to = new Date(to_date);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};


// Shared by approveLeave (status: "rejected") and cancelLeaveAndMarkPresent —
// restores the balance consumed at request time and flips every Attendance
// row in the leave's date range from leave/leaveApproved to leaveReject.
const rejectLeaveAndRestoreBalance = async (leave: any): Promise<void> => {
  if (leave.status !== "rejected") {
    const days = countLeaveDays(leave.from_date, leave.to_date);
    const year = new Date(leave.from_date).getFullYear();

    if (leave.companyLeaveId) {
      // Dynamic per-type balance — this request was deducted against a
      // specific company-configured leave type.
      const balanceRows = await LeaveRepo.findEmployeeLeaveTypeBalances(leave.employee_id, year);
      const balance = balanceRows.find((b: any) => b.companyLeaveId === leave.companyLeaveId);
      if (balance) {
        (balance as any).used = Math.max(0, (balance as any).used - days);
        await (balance as any).save();
      }
    } else {
      // Legacy request with only the fixed leave_type enum, no companyLeaveId
      // (e.g. an older mobile client) — restore against the old 3-field table.
      const balanceField = LEAVE_BALANCE_FIELDS[leave.leave_type];
      if (balanceField) {
        const balance = await LeaveRepo.findLeaveBalance(leave.employee_id, year);
        if (balance) {
          const used = (balance as any)[balanceField.used] || 0;
          (balance as any)[balanceField.used] = Math.max(0, used - days);
          await balance.save();
        }
      }
    }
  }

  leave.status = "rejected";
  await leave.save();

  await LeaveRepo.markAttendanceForLeaveRange(
    leave.employee_id,
    leave.from_date,
    leave.to_date,
    ["leave", "leaveApproved"],
    "leaveReject"
  );
};

// Best-effort mapping from a company's own configured leave-type name to the
// fixed Leave.leave_type ENUM column (sick/casual/paid/unpaid/short_leave/
// half_day) — that column is a real Postgres enum and can't grow a value per
// company, so it's kept only for record-keeping/half-day-detection while the
// actual balance math always runs off companyLeaveId instead (see below).
const inferLegacyLeaveTypeEnum = (leaveName: string): string => {
  const n = (leaveName || "").toLowerCase();
  if (n.includes("half")) return "half_day";
  if (n.includes("short")) return "short_leave";
  if (n.includes("sick")) return "sick";
  if (n.includes("unpaid") || n.includes("loss of pay") || n.includes("lop")) return "unpaid";
  if (n.includes("paid") || n.includes("earned")) return "paid";
  return "casual";
};

// Web-app counterpart to the mobile-only self-service requestLeave in
// user.ts (POST /api/leave, deliberately left untouched here to avoid any
// risk to existing mobile clients) — lets an admin/manager log a leave
// request on behalf of one of their own team members (or themselves), e.g.
// a phoned-in sick day. Reuses the same balance/attendance mechanics as the
// self-service path: balance is deducted immediately on request, and one
// Attendance "leave" row per day is created (skipped for half_day/
// short_leave, which are partial-day and would otherwise collide with a
// normal punch-in/out row).
export const createLeaveRequest = async (loggedInId: number, callerCompanyId: number | null, body: any) => {
  const { employeeId, from_date, to_date, reason, companyLeaveId } = body || {};

  const targetEmployeeId = employeeId ? Number(employeeId) : loggedInId;
  if (targetEmployeeId !== loggedInId) {
    const childIds = await getAllChildUserIds(loggedInId);
    if (!childIds.includes(targetEmployeeId)) {
      throw new ServiceError("You can only request leave on behalf of your own team members", 403);
    }
  }

  if (!from_date || !to_date || !reason) {
    throw new ServiceError("from_date, to_date & reason are required");
  }
  if (!companyLeaveId) {
    throw new ServiceError("companyLeaveId is required");
  }
  if (!callerCompanyId) {
    throw new ServiceError("No company context — cannot resolve this company's leave types");
  }

  const from = new Date(from_date);
  const to = new Date(to_date);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new ServiceError("Invalid date format");
  if (to < from) throw new ServiceError("to_date must be after from_date");

  const leaveTypeRow: any = await LeaveRepo.findCompanyLeaveByIdOnly(Number(companyLeaveId));
  if (!leaveTypeRow || Number(leaveTypeRow.companyId) !== Number(callerCompanyId)) {
    throw new ServiceError("companyLeaveId is not a leave type configured for your company");
  }
  const leave_type = inferLegacyLeaveTypeEnum(leaveTypeRow.leaveName);

  if (leave_type === "half_day" && from.getTime() !== to.getTime()) {
    throw new ServiceError("half_day leave must have from_date equal to to_date");
  }

  const existingLeave = await LeaveRepo.findOverlappingLeave(targetEmployeeId, from, to);
  if (existingLeave) {
    throw new ServiceError("This employee already has a leave request overlapping this date range");
  }

  const days = countLeaveDays(from, to);
  const year = from.getFullYear();

  const typeBalance: any = await resolveLeaveTypeBalance(targetEmployeeId, leaveTypeRow, year, loggedInId);
  const allocated = typeBalance.allocated || 0;
  const carriedForward = typeBalance.carriedForward || 0;
  const used = typeBalance.used || 0;
  const remaining = allocated + carriedForward - used;
  if (remaining < days) {
    throw new ServiceError(
      `Insufficient ${leaveTypeRow.leaveName} balance (requested ${days} day(s), remaining ${remaining})`
    );
  }

  const leave = await LeaveRepo.createLeaveRequest({
    employee_id: targetEmployeeId,
    from_date: from,
    to_date: to,
    reason,
    status: "pending",
    leave_type,
    companyLeaveId: leaveTypeRow.id,
  });

  typeBalance.used = used + days;
  await typeBalance.save();

  if (leave_type !== "half_day" && leave_type !== "short_leave") {
    const leaveDates: Date[] = [];
    for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      leaveDates.push(new Date(cursor));
    }
    await LeaveRepo.bulkCreateLeaveAttendance(
      leaveDates.map((date) => ({
        employee_id: targetEmployeeId,
        date,
        status: "leave",
        companyLeaveId: leaveTypeRow.id,
      }))
    );
  }

  return leave;
};

export const approveLeave = async (loggedInId: number, body: any) => {
  const { employee_id, leaveID, status } = body;

  if (!employee_id) throw new ServiceError("Employee id is missing");
  if (!leaveID) throw new ServiceError("leaveID id is missing");

  // FIX: previously trusted employee_id straight from the request body with
  // no check that the employee is on the caller's own team, letting any
  // admin approve/reject another company's leave requests by ID.
  const childIds = await getAllChildUserIds(loggedInId);
  if (Number(employee_id) !== loggedInId && !childIds.includes(Number(employee_id))) {
    throw new ServiceError("You can only manage leave requests of your own team members", 403);
  }

  const leave = await LeaveRepo.findLeaveForEmployee(employee_id, leaveID);
  if (!leave) throw new ServiceError("Leave not found");

  // Balance is deducted upfront when the employee requests leave (see
  // requestLeave in user.ts). Approval keeps it as-is; only a rejection
  // restores it below.
  if (status === "rejected") {
    await rejectLeaveAndRestoreBalance(leave);
  } else if (status) {
    await LeaveRepo.setLeaveStatus(leave, status);
  }

  if (status === "approved") {
    await LeaveRepo.markAttendanceForLeaveRange(
      employee_id,
      leave.from_date,
      leave.to_date,
      ["leave"],
      "leaveApproved",
      (leave as any).companyLeaveId ?? null
    );
  }

  return leave;
};

// Formats one employee's dynamic per-type balances against the FULL list of
// the company's configured leave types — so a type that's never been
// explicitly assigned still shows up (as 0/0), instead of just silently
// missing from the response.
const formatDynamicBalances = (leaveTypes: any[], balanceRows: any[]) => {
  const balanceByType = new Map(balanceRows.map((b: any) => [b.companyLeaveId, b]));
  return leaveTypes.map((lt: any) => {
    const b = balanceByType.get(lt.id);
    const allocated = b?.allocated ?? 0;
    const used = b?.used ?? 0;
    const carriedForward = b?.carriedForward ?? 0;
    return {
      companyLeaveId: lt.id,
      leaveName: lt.leaveName,
      leaveCode: lt.leaveCode,
      leavesPerYear: lt.leavesPerYear,
      carryForwardAllowed: !!lt.carryForward,
      carryForwardLimit: lt.carryForwardLimit ?? 0,
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
export const resolveLeaveTypeBalance = async (
  employeeId: number,
  leaveType: { id: number; carryForward?: boolean; carryForwardLimit?: number },
  year: number,
  assignedBy: number
) => {
  const priorYear = await LeaveRepo.findLatestPriorYearBalance(employeeId, leaveType.id, year);
  let carriedForward = 0;
  if (priorYear && leaveType.carryForward) {
    const priorAvailable = Math.max(
      0,
      (priorYear as any).allocated + (priorYear as any).carriedForward - (priorYear as any).used
    );
    carriedForward = Math.min(priorAvailable, Number(leaveType.carryForwardLimit) || 0);
  }
  const [balance] = await LeaveRepo.findOrCreateLeaveTypeBalance({
    employeeId,
    companyLeaveId: leaveType.id,
    year,
    assignedBy,
    carriedForward,
  });
  return balance;
};

// balances: [{ companyLeaveId, allocated }] — one entry per company-configured
// leave type being set. Each allocated value is capped at that type's own
// CompanyLeave.leavesPerYear (the "rules defined at registration"), so an
// admin can't hand out more days than the company's own policy allows.
export const assignLeaveBalance = async (loggedInId: number, callerCompanyId: number | null, body: any) => {
  const { employeeId, year, balances } = body || {};

  if (!employeeId || (Array.isArray(employeeId) && employeeId.length === 0)) {
    throw new ServiceError("employeeId is required");
  }
  if (!Array.isArray(balances) || balances.length === 0) {
    throw new ServiceError("balances array (companyLeaveId + allocated per type) is required");
  }
  if (!callerCompanyId) {
    throw new ServiceError("No company context — cannot resolve this company's leave types");
  }

  const employeeIds: number[] = Array.isArray(employeeId)
    ? employeeId.map((id: any) => Number(id))
    : [Number(employeeId)];

  const childIds = await getAllChildUserIds(loggedInId);
  const unauthorizedIds = employeeIds.filter((id) => id !== loggedInId && !childIds.includes(id));
  if (unauthorizedIds.length > 0) {
    throw new ServiceError(
      `You can only assign leave balance to your own sale_persons. Unauthorized employeeId(s): ${unauthorizedIds.join(", ")}`
    );
  }

  const targetYear = Number(year) || new Date().getFullYear();

  // Validate every requested companyLeaveId belongs to this company and cap
  // each allocation at that type's own configured leavesPerYear.
  const leaveTypes = await LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId);
  const leaveTypeById = new Map(leaveTypes.map((lt: any) => [lt.id, lt]));

  const requested: { companyLeaveId: number; allocated: number }[] = balances.map((entry: any) => {
    const companyLeaveId = Number(entry.companyLeaveId);
    const leaveType = leaveTypeById.get(companyLeaveId);
    if (!leaveType) {
      throw new ServiceError(`companyLeaveId ${companyLeaveId} is not a leave type configured for this company`);
    }
    const allocated = Math.max(0, Number(entry.allocated) || 0);
    if (allocated > (leaveType as any).leavesPerYear) {
      throw new ServiceError(
        `${(leaveType as any).leaveName} is capped at ${(leaveType as any).leavesPerYear} day(s)/year by this company's leave policy — cannot allocate ${allocated}`
      );
    }
    return { companyLeaveId, allocated };
  });

  const results = [];
  for (const empId of employeeIds) {
    for (const { companyLeaveId, allocated } of requested) {
      const leaveType = leaveTypeById.get(companyLeaveId);
      const balance = await resolveLeaveTypeBalance(empId, leaveType as any, targetYear, loggedInId);
      balance.allocated = allocated;
      balance.assignedBy = loggedInId;
      await balance.save();
    }
    // Re-read the employee's full balance set (not just the types touched in
    // this call) — otherwise the response looks like every other configured
    // type just got reset to 0/0, even though only the requested ones were
    // actually written.
    const allBalances = await LeaveRepo.findEmployeeLeaveTypeBalances(empId, targetYear);
    results.push({ employeeId: empId, year: targetYear, balances: formatDynamicBalances(leaveTypes, allBalances) });
  }

  return Array.isArray(employeeId) ? results : results[0];
};

export const getEmployeeLeaveBalance = async (
  loggedInId: number,
  employeeId: string,
  year: number,
  callerCompanyId: number | null
) => {
  const childIds = await getAllChildUserIds(loggedInId);
  if (Number(employeeId) !== loggedInId && !childIds.includes(Number(employeeId))) {
    throw new ServiceError("You can only view leave balance of your own sale_persons");
  }
  if (!callerCompanyId) {
    throw new ServiceError("No company context — cannot resolve this company's leave types");
  }

  const leaveTypes = await LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId);

  // Materializes each type's balance row for this year on first view (not
  // only on explicit assignment), so a carried-forward amount is visible
  // immediately instead of only appearing after an admin happens to re-save
  // an allocation for the new year.
  if (leaveTypes.length > 0) {
    await Promise.all(leaveTypes.map((lt: any) => resolveLeaveTypeBalance(Number(employeeId), lt, year, loggedInId)));
  }

  const balanceRows = await LeaveRepo.findEmployeeLeaveTypeBalances(Number(employeeId), year);

  return {
    employeeId: Number(employeeId),
    year,
    balances: formatDynamicBalances(leaveTypes, balanceRows),
  };
};

export const getTeamLeaveBalances = async (
  loggedInId: number,
  year: number,
  page: number,
  limit: number,
  offset: number,
  callerCompanyId: number | null
) => {
  const childIds = await getAllChildUserIds(loggedInId);

  const leaveTypes = callerCompanyId ? await LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId) : [];
  const { rows, count } = await LeaveRepo.findTeamLeaveTypeBalances({ childIds, year, limit, offset });

  // Materialize this page's employees × configured types so a carried-
  // forward amount is visible the moment the list is viewed, not only after
  // someone explicitly re-assigns an allocation for the new year.
  if (leaveTypes.length > 0 && rows.length > 0) {
    await Promise.all(
      rows.flatMap((user: any) => leaveTypes.map((lt: any) => resolveLeaveTypeBalance(user.id, lt, year, loggedInId)))
    );
  }

  const data = await Promise.all(
    rows.map(async (user: any) => {
      const userJson = user.toJSON();
      const balanceRows =
        leaveTypes.length > 0
          ? await LeaveRepo.findEmployeeLeaveTypeBalances(user.id, year)
          : userJson.leaveTypeBalances || [];
      return {
        ...userJson,
        leaveBalances: formatDynamicBalances(leaveTypes, balanceRows),
      };
    })
  );

  return {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    data,
  };
};

export const leaveList = async (loggedInId: number, status: any, page: number, limit: number, offset: number) => {
  const childIds = await getAllChildUserIds(loggedInId);
  const allUserIds = [loggedInId, ...childIds];

  const { rows, count } = await LeaveRepo.findLeavesForUsersPaginated({
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
};

export const getTodayLeaveRequests = async (loggedInId: number) => {
  const childIds = await getAllChildUserIds(loggedInId);
  const [appliedToday, onLeaveToday] = await LeaveRepo.findTodayLeaveActivity(childIds);

  return {
    appliedToday,
    appliedTodayCount: appliedToday.length,
    onLeaveToday,
    onLeaveTodayCount: onLeaveToday.length,
  };
};

export const cancelLeaveAndMarkPresent = async (loggedInId: number, body: any) => {
  const { employeeId, leaveID, date, punchIn } = body || {};

  if (!employeeId) throw new ServiceError("employeeId is required");
  if (!leaveID) throw new ServiceError("leaveID is required");

  // Team members only — covers any sale_person/manager (or deeper) under this admin/manager.
  const childIds = await getAllChildUserIds(loggedInId);
  if (!childIds.includes(Number(employeeId))) {
    throw new ServiceError("You can only manage attendance/leave for your own team members");
  }

  const leave = await LeaveRepo.findLeaveForEmployee(employeeId, leaveID);
  if (!leave) throw new ServiceError("Leave not found");

  // Cancel the leave: restores the balance consumed at request time and
  // flips every Attendance row in the leave's range to leaveReject.
  await rejectLeaveAndRestoreBalance(leave);

  // Then mark the requested day present, overwriting whatever the
  // leave-cancellation step just set it to.
  const attendanceDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const punchInTime = punchIn ? new Date(punchIn) : new Date();

  const existing = await LeaveRepo.findOrCreateAttendanceForDate(employeeId, attendanceDate);

  let record;
  if (existing) {
    existing.status = "present";
    existing.punch_in = punchInTime;
    await existing.save();
    record = existing;
  } else {
    record = await LeaveRepo.createPresentAttendance(employeeId, attendanceDate, punchInTime);
  }

  return { leave, attendance: record };
};

export const userLeave = async (loggedInId: number, userId: string, page: number, limit: number, offset: number) => {
  const childIds = await getAllChildUserIds(loggedInId);
  const requestedUserId = Number(userId);
  if (requestedUserId !== loggedInId && !childIds.includes(requestedUserId)) {
    throw new ServiceError("You can only view leave records of your own team members", 403);
  }

  const { rows, count } = await LeaveRepo.findEmployeeLeavesPaginated(requestedUserId, limit, offset);

  return {
    leave: rows,
    pagination: {
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      limit,
    },
  };
};

export const ownLeave = async (employeeId: number, page: number, limit: number, offset: number) => {
  const { rows, count } = await LeaveRepo.findOwnLeavesPaginated(employeeId, limit, offset);

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
};

// ---- CompanyLeave (leave-type policy) ----

export const addLeave = async (userId: number, body: any) => {
  const { leaveTypes, companyId, branchId } = body;

  if (!Array.isArray(leaveTypes) || leaveTypes.length === 0) {
    throw new ServiceError("leaveTypes array is required");
  }
  if (!companyId) throw new ServiceError("Company ID is required");
  if (!branchId) throw new ServiceError("Branch ID is required");

  const leaveData = leaveTypes.map((leave: any) => {
    if (!leave.leaveName || !leave.leaveCode || !leave.leavesPerYear) {
      throw new ServiceError("leaveName, leaveCode, leavesPerYear are required in each item");
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
};

export const getLeave = async (userId: number, role: string | undefined, query: any) => {
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
  const whereCondition: any = {};
  if (companyId) {
    const allowed = await hasCompanyAccess(Number(companyId), userId, role);
    if (!allowed) throw new ServiceError("You do not have access to this company", 403);
    whereCondition.companyId = Number(companyId);
  } else {
    whereCondition.userId = Number(userId);
  }

  if (search) {
    whereCondition[Op.or] = [
      { leaveName: { [Op.like]: `%${search}%` } },
      { leaveCode: { [Op.like]: `%${search}%` } },
    ];
  }
  if (leaveCode) whereCondition.leaveCode = leaveCode;
  if (branchId) whereCondition.branchId = Number(branchId);
  if (managerApproval !== undefined) whereCondition.managerApproval = managerApproval === "true";

  const { rows, count } = await LeaveRepo.findCompanyLeavesPaginated(whereCondition, pageSize, offset);

  return {
    total: count,
    currentPage: pageNumber,
    totalPages: Math.ceil(count / pageSize),
    data: rows,
  };
};

export const getLeaveById = async (id: string, userId: number, role: string | undefined) => {
  if (!id) throw new ServiceError("Leave ID is required");

  const leave = await LeaveRepo.findCompanyLeaveByIdOnly(Number(id));
  if (!leave) throw new ServiceError("Leave not found");

  const allowed = await hasCompanyAccess((leave as any).companyId, userId, role);
  if (!allowed) throw new ServiceError("You do not have access to this leave type", 403);

  return leave;
};

export const updateLeave = async (id: string, userId: number, role: string | undefined, body: any) => {
  if (!id) throw new ServiceError("Leave ID is required");

  const leave = await LeaveRepo.findCompanyLeaveByIdOnly(Number(id));
  if (!leave) throw new ServiceError("Leave not found");

  const allowed = await hasCompanyAccess((leave as any).companyId, userId, role);
  if (!allowed) throw new ServiceError("You do not have access to this leave type", 403);

  const {
    leaveName, leaveCode, leavesPerYear, carryForward, carryForwardLimit,
    managerApproval, compOffBalance, casualLeaveBalance, sickLeaveBalance,
  } = body;

  const l = leave as any;
  if (leaveName !== undefined) l.leaveName = String(leaveName);
  if (leaveCode !== undefined) l.leaveCode = String(leaveCode);
  if (leavesPerYear !== undefined) l.leavesPerYear = Number(leavesPerYear);
  if (carryForward !== undefined) l.carryForward = Boolean(carryForward);
  if (carryForwardLimit !== undefined) l.carryForwardLimit = Number(carryForwardLimit);
  if (managerApproval !== undefined) l.managerApproval = Boolean(managerApproval);
  if (compOffBalance !== undefined) l.compOffBalance = Number(compOffBalance);
  if (casualLeaveBalance !== undefined) l.casualLeaveBalance = Number(casualLeaveBalance);
  if (sickLeaveBalance !== undefined) l.sickLeaveBalance = Number(sickLeaveBalance);

  await leave.save();
  return leave;
};
