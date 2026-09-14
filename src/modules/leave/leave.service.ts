import { User, CompanyLeave, Leave, Attendance, EmployeeLeaveTypeBalance, EmployeeLeaveBalance, sequelize } from "../../config/dbConnection";
import { Op } from "sequelize";
import { ServiceError } from "../shared/serviceError";
import { getCompanyScopedChildUserIds, getCompanyScopedChildUserIdsFast } from "../shared/userHierarchy";
import { hasCompanyAccess } from "../shared/companyAccess";
import { getISTDateString } from "../shared/dateUtils";
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
  if (leave.status === "approved") {
    const days = countLeaveDays(leave.from_date, leave.to_date);
    // FIX: was `new Date(leave.from_date).getFullYear()` — from_date is a
    // DATEONLY column (a plain "YYYY-MM-DD" string), so `new Date(...)`
    // parses it as UTC midnight, and the local `.getFullYear()` getter then
    // only reads back the intended calendar year if the server's OS
    // timezone happens to line up (the exact double-bug pattern: an
    // OS-timezone-dependent getter reintroduced one step after the value
    // looked "safe"). getISTDateString() reads the year via explicit +5:30
    // offset arithmetic instead, correct regardless of server OS timezone.
    const year = Number(getISTDateString(new Date(leave.from_date)).slice(0, 4));

    let leaveTypeRow: any = null;
    if (leave.companyLeaveId) {
      leaveTypeRow = await CompanyLeave.findByPk(leave.companyLeaveId);
    }
    // Unpaid leave never touched the paid balance at approval time (see
    // approveLeave below) — nothing to restore here, and doing so anyway
    // would hand the employee phantom extra paid days.
    if (!isUnpaidLeaveType(leaveTypeRow, leave.leave_type)) {
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
  }

  leave.status = "rejected";
  await leave.save();

  // "absent" is included here so an approved UNPAID leave's days (posted as
  // absent by approveLeave, not leaveApproved) get flipped back to
  // leaveReject on cancellation too — same restoration marker paid leave
  // already uses, just reachable from either starting status.
  await LeaveRepo.markAttendanceForLeaveRange(
    leave.employee_id,
    leave.from_date,
    leave.to_date,
    ["leave", "leaveApproved", "absent"],
    "leaveReject"
  );
};

// Best-effort mapping from a company's own configured leave-type name to the
// fixed Leave.leave_type ENUM column (sick/casual/paid/unpaid/short_leave/
// half_day) — that column is a real Postgres enum and can't grow a value per
// company, so it's kept only for record-keeping/half-day-detection while the
// actual balance math always runs off companyLeaveId instead (see below).
export const inferLegacyLeaveTypeEnum = (leaveName: string): string => {
  const n = (leaveName || "").toLowerCase();
  if (n.includes("half")) return "half_day";
  if (n.includes("short")) return "short_leave";
  if (n.includes("sick")) return "sick";
  if (n.includes("unpaid") || n.includes("loss of pay") || n.includes("lop")) return "unpaid";
  if (n.includes("paid") || n.includes("earned")) return "paid";
  return "casual";
};

// Authoritative paid/unpaid classification for a leave request. Prefers the
// leave type's own configured CompanyLeave.isPaid flag (set by the admin in
// Step5's leave-type form) — the real source of truth — and only falls back
// to the fixed legacy leave_type enum ("unpaid") for the rare request that
// has no companyLeaveId at all (an old mobile client that only ever sent the
// enum value, never a resolved company-configured type).
export const isUnpaidLeaveType = (
  leaveTypeRow?: { isPaid?: boolean } | null,
  legacyLeaveType?: string | null
): boolean => {
  if (leaveTypeRow && typeof leaveTypeRow.isPaid === "boolean") {
    return leaveTypeRow.isPaid === false;
  }
  return legacyLeaveType === "unpaid";
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
    // FIX: was getAllChildUserIds — a pure who-created-whom walk with no
    // notion of company, so an admin/manager assigned to two companies kept
    // authority over everyone they ever created even after switching into
    // the other company. Scoped to the caller's ACTIVE company now; the
    // helper still keeps anyone whose company membership is indeterminate.
    const childIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
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
  // FIX: was `from.getFullYear()` — same double-bug pattern as
  // rejectLeaveAndRestoreBalance above: `from` is a UTC-midnight instant
  // parsed from a caller-supplied "YYYY-MM-DD" date, and the local getter
  // only recovers the right calendar year if the server's OS timezone
  // happens to cooperate. getISTDateString() reads it via explicit +5:30
  // offset arithmetic instead.
  const year = Number(getISTDateString(from).slice(0, 4));

  // Unpaid leave has no paid balance to check against — it never deducts and
  // never gets reserved, so there's nothing here to enforce (see
  // approveLeave/rejectLeaveAndRestoreBalance for the matching no-deduction
  // behavior at approval/cancellation time).
  if (!isUnpaidLeaveType(leaveTypeRow, leave_type)) {
    const typeBalance: any = await resolveLeaveTypeBalance(targetEmployeeId, leaveTypeRow, year, loggedInId);
    const allocated = typeBalance.allocated || 0;
    const carriedForward = typeBalance.carriedForward || 0;
    const used = typeBalance.used || 0;
    const remaining = allocated + carriedForward - used;

    const pendingLeaves = await LeaveRepo.findPendingLeavesForEmployee(targetEmployeeId, leaveTypeRow.id);
    const pendingDays = pendingLeaves.reduce((sum: number, pl: any) => sum + countLeaveDays(pl.from_date, pl.to_date), 0);

    if (remaining - pendingDays < days) {
      throw new ServiceError(
        `Insufficient ${leaveTypeRow.leaveName} balance (requested ${days} day(s), available ${remaining - pendingDays})`
      );
    }
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

  return leave;
};

export const approveLeave = async (loggedInId: number, callerCompanyId: number | null, body: any) => {
  const { employee_id, leaveID, status } = body;

  if (!employee_id) throw new ServiceError("Employee id is missing");
  if (!leaveID) throw new ServiceError("leaveID id is missing");

  // Prevent self-approval: A manager (or non-admin user) cannot approve their own leave request.
  if (Number(employee_id) === loggedInId) {
    const callerUser = await User.findByPk(loggedInId);
    if (callerUser?.role !== "admin" && callerUser?.role !== "super_admin") {
      throw new ServiceError("You cannot approve your own leave request", 403);
    }
  }

  const childIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
  if (Number(employee_id) !== loggedInId && !childIds.includes(Number(employee_id))) {
    throw new ServiceError("You can only manage leave requests of your own team members", 403);
  }

  return await sequelize.transaction(async (t) => {
    const leave: any = await Leave.findOne({
      where: { id: leaveID, employee_id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!leave) throw new ServiceError("Leave not found", 404);

    if (status === "approved") {
      if (leave.status === "approved") {
        throw new ServiceError("Leave already approved", 400);
      }
      if (leave.status === "rejected") {
        throw new ServiceError("Leave is already rejected", 400);
      }
      if (leave.status !== "pending") {
        throw new ServiceError(`Cannot approve leave with status "${leave.status}"`, 400);
      }

      const days = countLeaveDays(leave.from_date, leave.to_date);
      const year = Number(getISTDateString(new Date(leave.from_date)).slice(0, 4));

      // Paid/unpaid classification is resolved once, off the leave type's
      // own configured CompanyLeave.isPaid flag (falls back to the legacy
      // leave_type enum only when there's no companyLeaveId at all) — the
      // single fork point for both the balance deduction below and the
      // Attendance status it results in.
      const leaveTypeRow: any = leave.companyLeaveId
        ? await CompanyLeave.findByPk(leave.companyLeaveId, { transaction: t })
        : null;
      const unpaid = isUnpaidLeaveType(leaveTypeRow, leave.leave_type);

      if (!unpaid) {
        if (leave.companyLeaveId) {
          let balance: any = await EmployeeLeaveTypeBalance.findOne({
            where: { employeeId: leave.employee_id, companyLeaveId: leave.companyLeaveId, year },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!balance && leaveTypeRow) {
            balance = await resolveLeaveTypeBalance(leave.employee_id, leaveTypeRow, year, loggedInId);
          }
          if (balance) {
            balance.used = (balance.used || 0) + days;
            await balance.save({ transaction: t });
          }
        } else {
          const balanceField = LEAVE_BALANCE_FIELDS[leave.leave_type];
          if (balanceField) {
            const balance: any = await LeaveRepo.findLeaveBalance(leave.employee_id, year);
            if (balance) {
              balance[balanceField.used] = (balance[balanceField.used] || 0) + days;
              await balance.save({ transaction: t });
            }
          }
        }
      }
      // Unpaid: no balance touched at all — no deduction, no reservation.

      leave.status = "approved";
      await leave.save({ transaction: t });

      // Mark / create Attendance for each day of approved leave. Unpaid
      // leave posts as the existing canonical "absent" status (never a new
      // status, never "leaveApproved") so it counts against attendance
      // exactly like a plain absence, per the unpaid-leave business rule;
      // paid leave keeps the existing "leaveApproved" behavior unchanged.
      const attendanceStatus = unpaid ? "absent" : "leaveApproved";
      const from = new Date(leave.from_date);
      const to = new Date(leave.to_date);
      for (let cur = new Date(from); cur <= to; cur.setUTCDate(cur.getUTCDate() + 1)) {
        const dateStr = cur.toISOString().slice(0, 10);
        const [attRecord, created] = await Attendance.findOrCreate({
          where: { employee_id: leave.employee_id, date: dateStr },
          defaults: {
            employee_id: leave.employee_id,
            date: dateStr,
            status: attendanceStatus,
            companyLeaveId: leave.companyLeaveId ?? null,
            dayType: leave.leave_type === "half_day" ? "half_day" : (leave.leave_type === "short_leave" ? "short_leave" : undefined),
          } as any,
          transaction: t,
        });
        if (!created && attRecord.status !== "present") {
          attRecord.status = attendanceStatus as any;
          if (leave.companyLeaveId) attRecord.companyLeaveId = leave.companyLeaveId;
          await attRecord.save({ transaction: t });
        }
      }
    } else if (status === "rejected") {
      if (leave.status === "rejected") {
        throw new ServiceError("Leave already rejected", 400);
      }
      if (leave.status === "approved") {
        throw new ServiceError("Leave is already approved", 400);
      }
      if (leave.status !== "pending") {
        throw new ServiceError(`Cannot reject leave with status "${leave.status}"`, 400);
      }

      leave.status = "rejected";
      await leave.save({ transaction: t });

      // Ensure any temporary attendance records are updated to leaveReject
      await Attendance.update(
        { status: "leaveReject" as any },
        {
          where: {
            employee_id: leave.employee_id,
            date: { [Op.between]: [leave.from_date, leave.to_date] },
            status: { [Op.in]: ["leave", "leaveApproved"] },
          },
          transaction: t,
        }
      );
    } else {
      throw new ServiceError("Invalid status. Expected 'approved' or 'rejected'", 400);
    }

    return leave;
  });
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
      isPaid: lt.isPaid !== false,
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

  // Company-scoped team: allocating balance is a write against another
  // user's record, so it must not reach staff of a company the caller
  // merely also belongs to (see getCompanyScopedChildUserIds).
  const childIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
  const unauthorizedIds = employeeIds.filter((id) => id !== loggedInId && !childIds.includes(id));
  if (unauthorizedIds.length > 0) {
    throw new ServiceError(
      `You can only assign leave balance to your own sale_persons. Unauthorized employeeId(s): ${unauthorizedIds.join(", ")}`
    );
  }

  // FIX: was new Date().getFullYear() (OS-local getter) — not guaranteed
  // to equal the IST calendar year on the production host. Derived from
  // getISTDateString() instead so a request in the Dec 31/Jan 1 IST-vs-UTC
  // gap can't default to the wrong year's leave balance allocation.
  const targetYear = Number(year) || Number(getISTDateString().slice(0, 4));

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
  // Company-scoped team — the balances below are read against this company's
  // leave types, so the "is this my team member" gate must use the same
  // company context rather than the company-blind hierarchy.
  const childIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
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
  callerCompanyId: number | null,
  role?: string
) => {
  let childIds: number[] = [];
  if (role === "super_admin" && !callerCompanyId) {
    const allUsers = await User.findAll({
      where: { id: { [Op.ne]: loggedInId }, status: { [Op.ne]: "delete" } },
      attributes: ["id"],
    });
    childIds = allUsers.map((u: any) => u.id);
  } else {
    childIds = await getCompanyScopedChildUserIdsFast(loggedInId, callerCompanyId);
  }

  let leaveTypes = callerCompanyId ? await LeaveRepo.findCompanyLeaveTypesForCompany(callerCompanyId) : [];
  if (leaveTypes.length === 0 && role === "super_admin") {
    // For super_admin without companyId filter, fetch all configured company leave types
    leaveTypes = await CompanyLeave.findAll({
      attributes: ["id", "leaveName", "leaveCode", "leavesPerYear", "companyId"],
    }) as any[];
  }

  const { rows, count } = await LeaveRepo.findTeamLeaveTypeBalances({ childIds, year, limit, offset });

  if (rows.length === 0) {
    return {
      totalRecords: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: page,
      data: [],
    };
  }

  const userIds = rows.map((u: any) => u.id);
  const existingBalances = leaveTypes.length > 0 ? await LeaveRepo.findBalancesForUserIds(userIds, year) : [];
  const balanceMap = new Map<string, any>();
  existingBalances.forEach((b: any) => {
    balanceMap.set(`${b.employeeId}_${b.companyLeaveId}`, b);
  });

  const missingResolutions: Promise<any>[] = [];
  rows.forEach((user: any) => {
    leaveTypes.forEach((lt: any) => {
      const key = `${user.id}_${lt.id}`;
      if (!balanceMap.has(key)) {
        missingResolutions.push(
          resolveLeaveTypeBalance(user.id, lt, year, loggedInId).then((b) => balanceMap.set(key, b))
        );
      }
    });
  });

  if (missingResolutions.length > 0) {
    await Promise.all(missingResolutions);
  }

  const data = rows.map((user: any) => {
    const userJson = user.toJSON();
    const userBalanceRows = leaveTypes.map((lt: any) => balanceMap.get(`${user.id}_${lt.id}`)).filter(Boolean);
    return {
      ...userJson,
      leaveBalances: formatDynamicBalances(leaveTypes, userBalanceRows),
    };
  });

  return {
    totalRecords: count,
    totalPages: Math.ceil(count / limit) || 1,
    currentPage: page,
    data,
  };
};

export const leaveList = async (
  loggedInId: number,
  status: any,
  page: number,
  limit: number,
  offset: number,
  callerCompanyId: number | null
) => {
  // Company-scoped team — otherwise a multi-company admin/manager sees the
  // other company's leave requests in this list after switching companies.
  // PERF: Fast variant (see userHierarchy.ts) — this list is called from the
  // dashboard alongside several other team-scoped calls, so the old one-DB-
  // round-trip-per-user walk compounded directly into dashboard load time.
  const childIds = await getCompanyScopedChildUserIdsFast(loggedInId, callerCompanyId);
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

export const getTodayLeaveRequests = async (loggedInId: number, callerCompanyId: number | null) => {
  // Company-scoped team — this feeds the dashboard's "on leave today" widget,
  // which otherwise counts the other company's employees for a caller
  // assigned to more than one company.
  // PERF: Fast variant (see userHierarchy.ts) — same reasoning as leaveList above.
  const childIds = await getCompanyScopedChildUserIdsFast(loggedInId, callerCompanyId);
  const [appliedToday, onLeaveToday] = await LeaveRepo.findTodayLeaveActivity(childIds);

  return {
    appliedToday,
    appliedTodayCount: appliedToday.length,
    onLeaveToday,
    onLeaveTodayCount: onLeaveToday.length,
  };
};

export const cancelLeaveAndMarkPresent = async (loggedInId: number, callerCompanyId: number | null, body: any) => {
  const { employeeId, leaveID, date, punchIn } = body || {};

  if (!employeeId) throw new ServiceError("employeeId is required");
  if (!leaveID) throw new ServiceError("leaveID is required");

  // Team members only — covers any sale_person/manager (or deeper) under this admin/manager.
  // Company-scoped: this cancels a leave and writes an attendance row for
  // someone else, so it must not reach staff of another company the caller
  // is also assigned to (the company-blind hierarchy used to allow that).
  const childIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
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
  // FIX: the no-`date` fallback used to be new Date().toISOString().slice(0,10),
  // which converts to UTC first and rolls the calendar day backward for any
  // real-world IST time before ~05:30 AM — e.g. cancelling a leave at 2 AM IST
  // with no explicit date would mark yesterday present instead of today.
  // getISTDateString() computes the IST calendar date via explicit +5:30
  // offset arithmetic, correct regardless of the server's OS timezone. (The
  // explicit-`date` branch above just reformats a caller-supplied date, not
  // "now", so it's left as-is.)
  const attendanceDate = date ? String(date).slice(0, 10) : getISTDateString();
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

export const userLeave = async (
  loggedInId: number,
  userId: string,
  page: number,
  limit: number,
  offset: number,
  callerCompanyId: number | null
) => {
  // Company-scoped team — gates reading another user's full leave history,
  // which the company-blind hierarchy exposed across companies.
  const childIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
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
      isPaid: leave.isPaid === undefined ? true : Boolean(leave.isPaid),
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
    managerApproval, compOffBalance, casualLeaveBalance, sickLeaveBalance, isPaid,
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
  if (isPaid !== undefined) l.isPaid = Boolean(isPaid);

  await leave.save();
  return leave;
};
