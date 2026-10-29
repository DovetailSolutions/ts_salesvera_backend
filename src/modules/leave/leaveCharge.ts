import { Op } from "sequelize";
import { User, Company, Holiday, Leave } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { resolvePolicy } from "../attendancePolicy/attendancePolicy.service";

// ============================================================
// Days a full-day leave request takes from the balance under the attendance
// policy's weekly-off / holiday rule (leave.sandwich):
//   all_days     — every calendar day (the previous behaviour; returns null
//                  so callers keep using countLeaveRequestDays)
//   working_days — weekly offs and holidays are free
//   sandwich     — an off day is charged only when full-day leave is on both
//                  sides of it: the nearest working day before AND after is
//                  either in this request or in another pending/approved
//                  full-day leave. Off days just outside the request
//                  (Sat/Sun between an existing Friday leave and this
//                  Monday leave) are charged to this request.
// The result is stored on the request (leave_requests.chargedDays) so
// approval and cancellation use the same number later.
// ============================================================

export type SandwichMode = "all_days" | "sandwich" | "working_days";

const DAY_MS = 24 * 60 * 60 * 1000;
// Off days further than this from a working day are never charged.
const MAX_SCAN_DAYS = 31;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const addDays = (ymd: string, n: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const toYmd = (d: Date | string): string => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export const computeChargedDays = (p: {
  from: string;
  to: string;
  mode: SandwichMode;
  isOffDay: (ymd: string) => boolean;
  // Covered by another pending/approved full-day leave of the employee.
  isOtherLeaveDay: (ymd: string) => boolean;
}): { days: number; chargedOffDays: string[] } => {
  const range: string[] = [];
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) range.push(d);
  if (p.mode === "all_days") return { days: range.length, chargedOffDays: range.filter(p.isOffDay) };

  const workingInRange = range.filter((d) => !p.isOffDay(d)).length;
  if (p.mode === "working_days") return { days: workingInRange, chargedOffDays: [] };

  const inRange = (d: string) => d >= p.from && d <= p.to;
  const isLeave = (d: string) => inRange(d) || p.isOtherLeaveDay(d);
  const nearestWorking = (d: string, step: 1 | -1): string | null => {
    let cur = addDays(d, step);
    for (let i = 0; i < MAX_SCAN_DAYS; i++, cur = addDays(cur, step)) {
      if (!p.isOffDay(cur)) return cur;
    }
    return null;
  };

  // Off days next to the request that no other leave already covers.
  const outside: string[] = [];
  for (const step of [-1, 1] as const) {
    let cur = addDays(step === -1 ? p.from : p.to, step);
    for (let i = 0; i < MAX_SCAN_DAYS && p.isOffDay(cur) && !p.isOtherLeaveDay(cur); i++, cur = addDays(cur, step)) {
      outside.push(cur);
    }
  }

  const chargedOffDays = [...range.filter(p.isOffDay), ...outside]
    .filter((d) => {
      const before = nearestWorking(d, -1);
      const after = nearestWorking(d, 1);
      return !!before && !!after && isLeave(before) && isLeave(after);
    })
    .sort();
  return { days: workingInRange + chargedOffDays.length, chargedOffDays };
};

// Weekly offs (company working days; Sunday-only when none are configured)
// and holidays between `start` and `end`. A branch employee gets
// company-wide and their own branch's holidays; one with no branch gets
// every company holiday (as the attendance register shows them).
export const loadOffDayChecker = async (
  companyId: number,
  branchId: number | null | undefined,
  start: string,
  end: string
): Promise<(ymd: string) => boolean> => {
  const [company, holidays]: [any, any[]] = await Promise.all([
    Company.findByPk(companyId, { attributes: ["id", "companyWorkingDays"] }),
    Holiday.findAll({
      where: {
        companyId,
        holidayDate: { [Op.between]: [start, end] },
        ...(branchId ? { [Op.or]: [{ branchId: null }, { branchId }] } : {}),
      },
      attributes: ["holidayDate"],
    }),
  ]);
  const holidaySet = new Set(holidays.map((h) => String(h.holidayDate).slice(0, 10)));
  const workingDays: string[] | null = Array.isArray(company?.companyWorkingDays) && company.companyWorkingDays.length
    ? company.companyWorkingDays
    : null;
  return (d: string) => {
    if (holidaySet.has(d)) return true;
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    return workingDays ? !workingDays.includes(WEEKDAY_NAMES[weekday]) : weekday === 0;
  };
};

// null = the policy's rule is "all days" (or there is no policy / it's a
// half-day or short leave) → the caller keeps countLeaveRequestDays.
export const resolveChargedDays = async (p: {
  employeeId: number;
  companyId: number | null | undefined;
  leaveType: string;
  from: Date | string;
  to: Date | string;
}): Promise<number | null> => {
  if (!p.companyId || p.leaveType === "half_day" || p.leaveType === "short_leave") return null;
  const from = toYmd(p.from);
  const to = toYmd(p.to);

  const employee: any = await User.findByPk(p.employeeId, { attributes: ["id", "shiftId", "branchId"] });
  const policy = await resolvePolicy(Number(p.companyId), employee?.shiftId ?? null, from);
  const mode: SandwichMode = policy?.config.leave.sandwich ?? "all_days";
  if (mode === "all_days") return null;

  const windowStart = addDays(from, -(MAX_SCAN_DAYS + 1));
  const windowEnd = addDays(to, MAX_SCAN_DAYS + 1);
  const [isOffDay, otherLeaves]: [(ymd: string) => boolean, any[]] = await Promise.all([
    loadOffDayChecker(Number(p.companyId), employee?.branchId, windowStart, windowEnd),
    Leave.findAll({
      where: {
        employee_id: p.employeeId,
        status: { [Op.in]: ["pending", "approved"] },
        leave_type: { [Op.notIn]: ["half_day", "short_leave"] },
        from_date: { [Op.lte]: windowEnd },
        to_date: { [Op.gte]: windowStart },
      },
      attributes: ["from_date", "to_date"],
    }),
  ]);

  const isOtherLeaveDay = (d: string) =>
    otherLeaves.some((l) => String(l.from_date).slice(0, 10) <= d && d <= String(l.to_date).slice(0, 10));

  const { days } = computeChargedDays({ from, to, mode, isOffDay, isOtherLeaveDay });
  if (days === 0) {
    throw new ServiceError("The selected dates are all weekly offs or holidays — no leave is needed for them");
  }
  return days;
};
