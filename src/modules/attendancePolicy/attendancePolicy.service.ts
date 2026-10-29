import { Op } from "sequelize";
import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import { getISTDateString, parseISTTime, formatISTTime } from "../shared/dateUtils";
import { Shift, CompanyLeave } from "../../config/dbConnection";
import { AttendancePolicy } from "./attendancePolicy.model";
import { DEFAULT_POLICY_CONFIG, validatePolicy, isFlexibleTiming, AttendanceMode, AttendancePolicyConfig } from "./attendancePolicy.config";
import { classifyAttendanceDay, ClassifierShift } from "./attendancePolicy.classifier";

// ============================================================
// Attendance policy management (admin) + resolution (attendance flows).
// Every read/write is scoped to the caller's own company, re-verified with
// hasCompanyAccess — one company's policy can never be read or changed by,
// or applied to, another company.
// ============================================================

export interface PolicyActor {
  userId: number;
  role: string;
  companyId: number | null;
}

export interface ResolvedPolicy {
  id: number;
  mode: AttendanceMode;
  config: AttendancePolicyConfig;
  shiftId: number | null;
  effectiveFrom: string;
}

const WRITE_ROLES = ["admin", "user", "super_admin"]; // admin, company owner
// Managers don't manage attendance policies, so they can't read them here
// either; employees and managers still see their own rules through
// getMyPolicySummary below.
const READ_ROLES = WRITE_ROLES;

const requireCompany = async (actor: PolicyActor, write: boolean): Promise<number> => {
  const allowed = write ? WRITE_ROLES : READ_ROLES;
  if (!allowed.includes(actor.role)) {
    throw new ServiceError(write ? "Only an admin or the company owner can change attendance policies" : "You cannot view attendance policies", 403);
  }
  if (!actor.companyId) throw new ServiceError("No active company is associated with your account", 403);
  const companyId = Number(actor.companyId);
  if (!(await hasCompanyAccess(companyId, Number(actor.userId), actor.role))) {
    throw new ServiceError("You do not have access to this company", 403);
  }
  return companyId;
};

const toResolved = (row: any): ResolvedPolicy => ({
  id: row.id,
  mode: row.mode,
  // Stored configs are merged over the defaults so a field added in a later
  // release still has a value for older saved versions.
  config: validatePolicy(row.mode, { ...DEFAULT_POLICY_CONFIG, ...(row.config || {}) }).config,
  shiftId: row.shiftId ?? null,
  effectiveFrom: String(row.effectiveFrom).slice(0, 10),
});

// The policy that applies to one employee's attendance on `date`: the newest
// version effective on/before that date for their shift, else the newest
// company-wide one. null = no policy saved → callers keep the legacy rules.
export const resolvePolicy = async (
  companyId: number | null | undefined,
  shiftId: number | null | undefined,
  date: string
): Promise<ResolvedPolicy | null> => {
  if (!companyId) return null;
  const order: any = [["effectiveFrom", "DESC"], ["id", "DESC"]];
  if (shiftId) {
    const forShift = await AttendancePolicy.findOne({
      where: { companyId, shiftId, effectiveFrom: { [Op.lte]: date } },
      order,
    });
    if (forShift) return toResolved(forShift);
  }
  const companyWide = await AttendancePolicy.findOne({
    where: { companyId, shiftId: null, effectiveFrom: { [Op.lte]: date } },
    order,
  });
  return companyWide ? toResolved(companyWide) : null;
};

// Shift window on a given IST date, rolling the end to the next day for a
// night shift — the same construction attendance.service.ts uses.
export const shiftWindowOn = (shift: any, dateStr: string): ClassifierShift | null => {
  if (!shift?.startTime || !shift?.endTime) return null;
  const start = parseISTTime(dateStr, String(shift.startTime));
  let end = parseISTTime(dateStr, String(shift.endTime));
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, breakMinutes: shift.breakMinutes ?? null, workingHours: shift.workingHours ?? null };
};

const assertShiftInCompany = async (shiftId: unknown, companyId: number): Promise<number | null> => {
  if (shiftId === null || shiftId === undefined || shiftId === "") return null;
  const id = Number(shiftId);
  if (!Number.isInteger(id) || id <= 0) throw new ServiceError("The selected shift is invalid");
  const shift: any = await Shift.findByPk(id, { attributes: ["id", "companyId"] });
  if (!shift || Number(shift.companyId) !== companyId) {
    throw new ServiceError("This shift does not belong to your company", 403);
  }
  return id;
};

const isDateOnly = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());

// ── Admin API ────────────────────────────────────────────────────────────

export const getPolicies = async (actor: PolicyActor) => {
  const companyId = await requireCompany(actor, false);
  const today = getISTDateString();
  const rows: any[] = await AttendancePolicy.findAll({
    where: { companyId },
    order: [["effectiveFrom", "DESC"], ["id", "DESC"]],
    limit: 200,
  });
  const shifts: any[] = await Shift.findAll({
    where: { companyId },
    attributes: ["id", "shiftName", "startTime", "endTime", "breakMinutes", "workingHours"],
    order: [["shiftName", "ASC"]],
  });

  // Currently effective version per scope (company-wide + each shift) and
  // any not-yet-effective (scheduled) versions.
  const effective: Record<string, any> = {};
  for (const r of rows) {
    const key = r.shiftId == null ? "company" : String(r.shiftId);
    if (String(r.effectiveFrom) <= today && !effective[key]) effective[key] = r;
  }

  // The comp-off rule credits the company's "Comp Off" leave type (created
  // from company settings → Leave Types → "Comp Off Days Allowed Per Year");
  // the page warns while it's missing. Same name rule as modules/compOff.
  const leaveTypes: any[] = await CompanyLeave.findAll({ where: { companyId }, attributes: ["leaveName"] });
  const compOffLeaveTypeExists = leaveTypes.some((t) => String(t.leaveName || "").trim().toLowerCase() === "comp off");

  return {
    defaults: DEFAULT_POLICY_CONFIG,
    compOffLeaveTypeExists,
    shifts,
    effective: Object.fromEntries(Object.entries(effective).map(([k, r]) => [k, toResolved(r)])),
    history: rows.map((r) => ({
      ...toResolved(r),
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      status: String(r.effectiveFrom) > today ? "scheduled" : effective[r.shiftId == null ? "company" : String(r.shiftId)]?.id === r.id ? "active" : "superseded",
    })),
  };
};

export const savePolicy = async (actor: PolicyActor, body: any) => {
  const companyId = await requireCompany(actor, true);
  const shiftId = await assertShiftInCompany(body?.shiftId, companyId);
  const { mode, config } = validatePolicy(body?.mode, body?.config);

  const today = getISTDateString();
  const effectiveFrom = body?.effectiveFrom ?? today;
  if (!isDateOnly(effectiveFrom)) throw new ServiceError("Effective from must be a valid date (YYYY-MM-DD)");
  // A new rule may start today or later — never in the past, so saving a
  // policy can't be used to re-label attendance that already happened.
  if (effectiveFrom < today) throw new ServiceError("Effective from date cannot be in the past");

  const row = await AttendancePolicy.create({
    companyId,
    shiftId,
    mode,
    effectiveFrom,
    config,
    createdBy: Number(actor.userId),
  });
  return toResolved(row);
};

// Representative outcomes for the admin preview, run through the SAME
// classifier attendance uses — nothing is saved.
export const previewPolicy = async (actor: PolicyActor, body: any) => {
  const companyId = await requireCompany(actor, false);
  const { mode, config } = validatePolicy(body?.mode, body?.config);

  let shiftRow: any = null;
  if (body?.shiftId) {
    const id = await assertShiftInCompany(body.shiftId, companyId);
    shiftRow = await Shift.findByPk(id!);
  }
  const shiftDef = shiftRow ?? { startTime: "09:30:00", endTime: "18:30:00", breakMinutes: 0, workingHours: config.fullDayHours };
  const date = getISTDateString();
  const shift = shiftWindowOn(shiftDef, date)!;
  const startHHMM = String(shiftDef.startTime).slice(0, 5);
  const endHHMM = String(shiftDef.endTime).slice(0, 5);
  const halfEnd = new Date(shift.start!.getTime() + config.halfDayHours * 3600000 + 60000);
  // FIX: was a fixed 11:30 – 22:00, which on a shift starting after 11:30
  // (e.g. a night shift) was an EARLY arrival labelled "Late". Now always
  // 2 h after this shift's start, staying 3.5 h past its end (the same
  // 11:30 – 22:00 on the 09:30 – 18:30 sample shift).
  const lateIn = new Date(shift.start!.getTime() + 2 * 3600000);
  const lateOut = new Date(shift.end!.getTime() + 3.5 * 3600000);

  const scenario = (title: string, input: any) => ({
    title,
    // Lets the admin page leave out leave examples while its leave settings are hidden.
    involvesLeave: !!input.leave,
    ...classifyAttendanceDay({ mode, config, shift, sessions: [], ...input }),
  });

  return {
    mode,
    shift: { startTime: startHHMM, endTime: endHHMM, isDefault: !shiftRow },
    examples: [
      scenario(`On time ${startHHMM} – ${endHHMM}`, { sessions: [{ punchIn: shift.start, punchOut: shift.end }] }),
      scenario(`${isFlexibleTiming(mode, config) ? "Starts 2 h after shift start" : "Late arrival"}: ${formatISTTime(lateIn)} – ${formatISTTime(lateOut)}`, { sessions: [{ punchIn: lateIn, punchOut: lateOut }] }),
      ...(config.lateCount.enabled && !isFlexibleTiming(mode, config)
        ? [scenario(`Late arrival no. ${config.lateCount.every} this month: ${formatISTTime(lateIn)} – ${formatISTTime(lateOut)}`, {
            sessions: [{ punchIn: lateIn, punchOut: lateOut }],
            priorLateDaysThisMonth: config.lateCount.every - 1,
          })]
        : []),
      scenario(`Half-day hours only: ${startHHMM} – ${formatISTTime(halfEnd)}`, {
        sessions: [{ punchIn: shift.start, punchOut: halfEnd }],
      }),
      scenario("Two sessions with a lunch break", {
        sessions: [
          { punchIn: shift.start, punchOut: new Date(shift.start!.getTime() + 4 * 3600000) },
          { punchIn: new Date(shift.start!.getTime() + 4.75 * 3600000), punchOut: shift.end },
        ],
      }),
      // A system punch-out only ever counts up to the shift end — the same
      // cap applyDayClassification applies to real auto-closed sessions —
      // so with either cut-off the counted time ends at shift end.
      scenario("Missed punch-out", config.missedPunchOut.action === "mark_absent"
        ? { missedPunchOut: true }
        : { sessions: [{ punchIn: shift.start, punchOut: shift.end, autoPunchedOut: true }] }),
      // Only differs from the line above under "mark absent": the completed
      // morning session still counts; the unclosed afternoon one doesn't.
      ...(config.missedPunchOut.action === "mark_absent"
        ? [scenario("Missed punch-out after lunch (morning session completed)", {
            missedPunchOut: true,
            sessions: [{ punchIn: shift.start, punchOut: new Date(shift.start!.getTime() + 4.5 * 3600000) }],
          })]
        : []),
      scenario("Approved first-half leave, works second half", {
        leave: { kind: "half_day", session: "first_half" },
        sessions: [{ punchIn: new Date((shift.start!.getTime() + shift.end!.getTime()) / 2), punchOut: shift.end }],
      }),
      scenario(`Approved ${config.leave.shortLeaveMaxMinutes}-minute evening short leave`, {
        leave: { kind: "short_leave", session: "evening", durationMinutes: config.leave.shortLeaveMaxMinutes },
        sessions: [{ punchIn: shift.start, punchOut: new Date(shift.end!.getTime() - config.leave.shortLeaveMaxMinutes * 60000) }],
      }),
    ],
  };
};

// What an employee sees about their own rules (no admin-only controls).
export const getMyPolicySummary = async (companyId: number | null, shift: any, date: string) => {
  const policy = await resolvePolicy(companyId, shift?.id, date);
  if (!policy) return null;
  const c = policy.config;
  const flexibleTiming = isFlexibleTiming(policy.mode, c);
  return {
    mode: policy.mode,
    effectiveFrom: policy.effectiveFrom,
    fullDayHours: c.fullDayHours,
    halfDayHours: c.halfDayHours,
    shortDayHours: c.shortDayHours,
    flexibleTiming,
    lateGraceMinutes: c.lateGraceMinutes,
    lateCountEvery: c.lateCount.enabled && !flexibleTiming ? c.lateCount.every : null,
    punchInWindow: c.punchIn.restrictToWindow && !flexibleTiming ?{ earlyMinutes: c.punchIn.earlyMinutes, lateMinutes: c.punchIn.lateMinutes } : null,
    missedPunchOut: c.missedPunchOut.action,
    leave: {
      halfDayAllowed: c.leave.halfDayAllowed,
      shortLeaveAllowed: c.leave.shortLeaveAllowed,
      shortLeaveMaxMinutes: c.leave.shortLeaveMaxMinutes,
      shortLeaveMaxPerMonth: c.leave.shortLeaveMaxPerMonth,
      allowRequestAfterShiftStart: c.leave.allowRequestAfterShiftStart,
    },
  };
};
