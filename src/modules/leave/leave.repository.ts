import { Op } from "sequelize";
import { Leave, CompanyLeave, EmployeeLeaveBalance, EmployeeLeaveTypeBalance, Attendance, User } from "../../config/dbConnection";

// ============================================================
// Leave repository — wraps all direct Sequelize access for this domain.
// Covers three sub-models: Leave (requests), EmployeeLeaveBalance
// (per-employee/year allocations), CompanyLeave (leave-type policies).
// ============================================================

// ---- Leave (requests) ----

export const findLeaveForEmployee = (employeeId: number | string, id: number | string) =>
  Leave.findOne({ where: { employee_id: employeeId, id } });

export const setLeaveStatus = async (leave: any, status: string) => {
  leave.status = status;
  await leave.save();
  return leave;
};

export const markAttendanceForLeaveRange = (
  employeeId: number | string,
  fromDate: string | Date,
  toDate: string | Date,
  fromStatus: string[],
  toStatus: string,
  companyLeaveId?: number | null
) =>
  Attendance.update(
    { status: toStatus as any, ...(companyLeaveId !== undefined ? { companyLeaveId } : {}) },
    {
      where: {
        employee_id: employeeId,
        date: { [Op.between]: [fromDate, toDate] },
        status: { [Op.in]: fromStatus },
      },
    }
  );

export const findLeavesForUsersPaginated = (params: {
  allUserIds: number[];
  excludeUserId: number;
  status?: any;
  limit: number;
  offset: number;
}) =>
  User.findAndCountAll({
    where: {
      id: {
        [Op.in]: params.allUserIds,
        [Op.ne]: params.excludeUserId,
      },
    },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "createdAt"],
    include: [
      {
        model: Leave,
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

export const findTodayLeaveActivity = (childIds: number[]) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayDateOnly = new Date().toISOString().slice(0, 10);

  const userAttributes = ["id", "firstName", "lastName", "email", "phone", "role"];

  return Promise.all([
    Leave.findAll({
      where: {
        employee_id: { [Op.in]: childIds },
        createdAt: { [Op.between]: [todayStart, todayEnd] },
      } as any,
      include: [{ model: User, as: "user", attributes: userAttributes }],
      order: [["createdAt", "DESC"]],
    }),
    Leave.findAll({
      where: {
        employee_id: { [Op.in]: childIds },
        from_date: { [Op.lte]: todayDateOnly },
        to_date: { [Op.gte]: todayDateOnly },
      },
      include: [{ model: User, as: "user", attributes: userAttributes }],
      order: [["from_date", "ASC"]],
    }),
  ]);
};

export const findOrCreateAttendanceForDate = (employeeId: number | string, date: string) =>
  Attendance.findOne({ where: { employee_id: employeeId, date } });

export const createPresentAttendance = (employeeId: number | string, date: string, punchIn: Date) =>
  Attendance.create({
    employee_id: employeeId,
    date,
    punch_in: punchIn,
    status: "present",
  } as any);

export const findOverlappingLeave = (employeeId: number | string, from: Date, to: Date) =>
  Leave.findOne({
    where: {
      employee_id: employeeId,
      status: { [Op.in]: ["pending", "approved"] },
      from_date: { [Op.lte]: to },
      to_date: { [Op.gte]: from },
    },
  });

export const createLeaveRequest = (data: any) => Leave.create(data);

export const bulkCreateLeaveAttendance = (rows: any[]) => Attendance.bulkCreate(rows);

export const findEmployeeLeavesPaginated = (employeeId: number, limit: number, offset: number) =>
  Leave.findAndCountAll({
    where: { employee_id: employeeId },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

export const findOwnLeavesPaginated = (employeeId: number, limit: number, offset: number) =>
  Leave.findAndCountAll({
    where: { employee_id: employeeId },
    limit,
    offset,
    order: [["id", "DESC"]],
  });

// ---- EmployeeLeaveBalance ----

export const findOrCreateLeaveBalance = (params: {
  employeeId: number;
  year: number;
  companyId: number | null;
  branchId: number | null;
  assignedBy: number;
}) =>
  EmployeeLeaveBalance.findOrCreate({
    where: { employeeId: params.employeeId, year: params.year },
    defaults: {
      employeeId: params.employeeId,
      year: params.year,
      companyId: params.companyId,
      branchId: params.branchId,
      assignedBy: params.assignedBy,
    },
  });

export const findLeaveBalance = (employeeId: number, year: number) =>
  EmployeeLeaveBalance.findOne({ where: { employeeId, year } });

export const findTeamLeaveBalances = (params: {
  childIds: number[];
  year: number;
  limit: number;
  offset: number;
}) =>
  User.findAndCountAll({
    where: { id: { [Op.in]: params.childIds } },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "createdAt"],
    include: [
      {
        model: EmployeeLeaveBalance,
        as: "leaveBalances",
        required: false,
        where: { year: params.year },
      },
    ],
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });

// ---- CompanyLeave (leave-type policy) ----

export const bulkCreateCompanyLeaves = (rows: any[]) => CompanyLeave.bulkCreate(rows);

export const findCompanyLeavesPaginated = (where: any, limit: number, offset: number) =>
  CompanyLeave.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

export const findCompanyLeaveOwnedBy = (id: number, userId: number) =>
  CompanyLeave.findOne({ where: { id, userId } });

// Plain lookup with no ownership filter — used once the caller's access has
// already been verified via shared/companyAccess.ts's hasCompanyAccess (same
// pattern as company/branch/shift/department/holiday), so any admin/manager
// of the company can manage its leave types, not just whichever specific
// user originally created them.
export const findCompanyLeaveByIdOnly = (id: number) => CompanyLeave.findByPk(id);

// Every leave type configured for a company (+ optionally scoped to one
// branch), regardless of which specific admin/manager created each row —
// the source of truth for "which leave types exist here" everywhere dynamic
// dropdowns/templates need to read from.
export const findCompanyLeaveTypesForCompany = (companyId: number, branchId?: number) =>
  CompanyLeave.findAll({
    where: { companyId, ...(branchId ? { branchId } : {}) },
    order: [["leaveName", "ASC"]],
  });

// ---- EmployeeLeaveTypeBalance (dynamic per-configured-type balance) ----

export const findEmployeeLeaveTypeBalances = (employeeId: number, year: number) =>
  EmployeeLeaveTypeBalance.findAll({
    where: { employeeId, year },
    include: [{ model: CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear"] }],
  });

// The immediately preceding year's balance for this employee/type, if any —
// the source carry-forward is computed from. Carry-forward only ever rolls
// one year forward from whatever was actually recorded, never further back.
export const findLatestPriorYearBalance = (employeeId: number, companyLeaveId: number, year: number) =>
  EmployeeLeaveTypeBalance.findOne({ where: { employeeId, companyLeaveId, year: year - 1 } });

export const findOrCreateLeaveTypeBalance = (params: {
  employeeId: number;
  companyLeaveId: number;
  year: number;
  assignedBy: number;
  carriedForward?: number;
}) =>
  EmployeeLeaveTypeBalance.findOrCreate({
    where: { employeeId: params.employeeId, companyLeaveId: params.companyLeaveId, year: params.year },
    defaults: {
      employeeId: params.employeeId,
      companyLeaveId: params.companyLeaveId,
      year: params.year,
      assignedBy: params.assignedBy,
      carriedForward: params.carriedForward ?? 0,
    },
  });

export const findTeamLeaveTypeBalances = (params: { childIds: number[]; year: number; limit: number; offset: number }) =>
  User.findAndCountAll({
    where: { id: { [Op.in]: params.childIds } },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role", "createdAt"],
    include: [
      {
        model: EmployeeLeaveTypeBalance,
        as: "leaveTypeBalances",
        required: false,
        where: { year: params.year },
        include: [{ model: CompanyLeave, as: "leaveType", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear"] }],
      },
    ],
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
