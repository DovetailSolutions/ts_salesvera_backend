import { Op, QueryTypes, Transaction } from "sequelize";
import { sequelize, User, Task, TaskHistory, Meeting, MeetingUser } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getISTDateString } from "../shared/dateUtils";
import { hasCompanyAccess } from "../shared/companyAccess";
import {
  getCompanyAdminIds,
  getDirectCreator,
  getCompanyScopedChildUserIds,
  collectUserCompanyIds,
} from "../shared/userHierarchy";
import { loadOffDayChecker } from "../leave/leaveCharge";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { revokeAllSessionsForUser } from "../auth/refreshSession.service";

// ============================================================
// Separation Management (resignation → approval → notice → handover →
// clearance → completion). Tables: migrations/0046_separation_management.ts.
//
// Workflow
//   employee applies → their reporting manager (direct creator, if an active
//   manager) → company admin → notice period. No reporting manager, or the
//   applicant IS a manager → straight to the admin. Nobody can review their
//   own request.
//
// Who can do what (enforced here, not just in the UI)
//   employee / manager   apply for and view their OWN request, withdraw it
//                        while it's still pending.
//   manager              view requests of their team; approve / reject the
//                        ones routed to them; start handover and record
//                        handover for them.
//   admin / user (owner) everything for their ACTIVE company only.
//
// The account is never touched until "complete": that needs admin approval,
// the approved last working day reached, handover and clearance done (or
// waived by an admin). Completion deactivates the login (status deActive +
// every refresh session revoked); the user row and all history stay.
// ============================================================

export interface SeparationActor {
  userId: number;
  role: string;
  companyId: number | null;
}

const ADMIN_ROLES = ["admin", "user"];
const APPLICANT_ROLES = ["employee", "manager"];

export const STATUSES = [
  "pending_manager_approval",
  "pending_admin_approval",
  "approved",
  "rejected",
  "withdrawn",
  "notice_period",
  "handover_pending",
  "clearance_pending",
  "completed",
] as const;
type Status = (typeof STATUSES)[number];

const PENDING: Status[] = ["pending_manager_approval", "pending_admin_approval"];
const POST_APPROVAL: Status[] = ["approved", "notice_period", "handover_pending", "clearance_pending"];
const TERMINAL: Status[] = ["rejected", "withdrawn", "completed"];

// The only transitions that may ever happen. Every status change goes
// through transition() below, which refuses anything not listed here.
const TRANSITIONS: Record<Status, Status[]> = {
  pending_manager_approval: ["pending_admin_approval", "rejected", "withdrawn"],
  pending_admin_approval: ["approved", "rejected", "withdrawn"],
  approved: ["notice_period", "withdrawn"],
  notice_period: ["handover_pending", "withdrawn"],
  handover_pending: ["clearance_pending", "withdrawn"],
  clearance_pending: ["completed", "withdrawn"],
  rejected: [],
  withdrawn: [],
  completed: [],
};

export const REASONS: Record<string, string> = {
  better_opportunity: "Better career opportunity",
  higher_studies: "Higher studies",
  personal: "Personal reasons",
  relocation: "Relocation",
  health: "Health reasons",
  compensation: "Compensation",
  work_environment: "Work environment",
  career_change: "Career change",
  retirement: "Retirement",
  other: "Other",
};

// ── Small helpers ─────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (ymd: string, n: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const isDateOnly = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
// DATE columns may arrive as "YYYY-MM-DD" or as a JS Date at LOCAL midnight
// (node-pg) — read local parts so an IST server never shifts it a day back.
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (v: any): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v).slice(0, 10);
};

const query = <T = any>(sql: string, replacements: Record<string, unknown> = {}, transaction?: Transaction): Promise<T[]> =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction }) as Promise<T[]>;

const text = (v: unknown, label: string, max: number, required = false): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) {
    if (required) throw new ServiceError(`${label} is required`);
    return null;
  }
  if (s.length > max) throw new ServiceError(`${label} can be at most ${max} characters`);
  return s;
};

const parseId = (v: unknown, label = "request"): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ServiceError(`Invalid ${label}`);
  return n;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d: string | null) => (d ? `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : "—");

const personName = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || `User #${u.id}` : "Someone");

const requireCompany = (actor: SeparationActor): number => {
  if (!actor.companyId) throw new ServiceError("No active company is associated with your account", 403);
  return Number(actor.companyId);
};

const isAdmin = (actor: SeparationActor) => ADMIN_ROLES.includes(actor.role);

const requireAdmin = async (actor: SeparationActor): Promise<number> => {
  if (!isAdmin(actor)) throw new ServiceError("Only an admin can do this", 403);
  const companyId = requireCompany(actor);
  if (!(await hasCompanyAccess(companyId, Number(actor.userId), actor.role))) {
    throw new ServiceError("You do not have access to this company", 403);
  }
  return companyId;
};

// ── Policy ────────────────────────────────────────────────────────────────

export interface SeparationPolicy {
  defaultNoticeDays: number;
  employeeNoticeDays: number | null;
  managerNoticeDays: number | null;
  noticeStartsFrom: "submission" | "approval";
  dayCountMode: "calendar" | "working";
  allowProposedLastDay: boolean;
  allowEarlyRelease: boolean;
  allowWaiver: boolean;
  allowAdminOverride: boolean;
  configured: boolean;
  updatedAt?: string | null;
}

const DEFAULT_POLICY: SeparationPolicy = {
  defaultNoticeDays: 30,
  employeeNoticeDays: null,
  managerNoticeDays: null,
  noticeStartsFrom: "submission",
  dayCountMode: "calendar",
  allowProposedLastDay: true,
  allowEarlyRelease: true,
  allowWaiver: false,
  allowAdminOverride: true,
  configured: false,
};

const POLICY_COLUMNS = [
  "defaultNoticeDays", "employeeNoticeDays", "managerNoticeDays", "noticeStartsFrom", "dayCountMode",
  "allowProposedLastDay", "allowEarlyRelease", "allowWaiver", "allowAdminOverride",
] as const;

export const loadPolicy = async (companyId: number, transaction?: Transaction): Promise<SeparationPolicy> => {
  const [row] = await query(`SELECT * FROM separation_policies WHERE "companyId" = :companyId`, { companyId }, transaction);
  if (!row) return { ...DEFAULT_POLICY };
  return {
    defaultNoticeDays: Number(row.defaultNoticeDays),
    employeeNoticeDays: row.employeeNoticeDays == null ? null : Number(row.employeeNoticeDays),
    managerNoticeDays: row.managerNoticeDays == null ? null : Number(row.managerNoticeDays),
    noticeStartsFrom: row.noticeStartsFrom,
    dayCountMode: row.dayCountMode,
    allowProposedLastDay: !!row.allowProposedLastDay,
    allowEarlyRelease: !!row.allowEarlyRelease,
    allowWaiver: !!row.allowWaiver,
    allowAdminOverride: !!row.allowAdminOverride,
    configured: true,
    updatedAt: row.updatedAt,
  };
};

export const noticeDaysFor = (policy: SeparationPolicy, role: string): number => {
  if (role === "manager" && policy.managerNoticeDays != null) return policy.managerNoticeDays;
  if (role === "employee" && policy.employeeNoticeDays != null) return policy.employeeNoticeDays;
  return policy.defaultNoticeDays;
};

// Notice day 1 is the start date itself. Calendar mode: last day = start +
// (N - 1). Working mode: the Nth day that isn't a weekly off / holiday of
// the employee's company (and branch) — the same off-day rules leave uses.
// 0 days → the start date.
export const calculateLastWorkingDay = async (p: {
  companyId: number;
  branchId: number | null | undefined;
  start: string;
  noticeDays: number;
  mode: "calendar" | "working";
}): Promise<string> => {
  const n = Math.max(0, Math.floor(p.noticeDays));
  if (n === 0) return p.start;
  if (p.mode !== "working") return addDays(p.start, n - 1);
  const end = addDays(p.start, n * 3 + 60);
  const isOff = await loadOffDayChecker(p.companyId, p.branchId, p.start, end);
  let counted = 0;
  let day = p.start;
  for (let i = 0; i < n * 3 + 60; i++) {
    if (!isOff(day)) {
      counted++;
      if (counted === n) return day;
    }
    day = addDays(day, 1);
  }
  return addDays(p.start, n - 1); // no working days configured at all → calendar fallback
};

const policySnapshot = (policy: SeparationPolicy, extra: Record<string, unknown>) => ({
  defaultNoticeDays: policy.defaultNoticeDays,
  employeeNoticeDays: policy.employeeNoticeDays,
  managerNoticeDays: policy.managerNoticeDays,
  noticeStartsFrom: policy.noticeStartsFrom,
  dayCountMode: policy.dayCountMode,
  allowProposedLastDay: policy.allowProposedLastDay,
  allowEarlyRelease: policy.allowEarlyRelease,
  allowWaiver: policy.allowWaiver,
  allowAdminOverride: policy.allowAdminOverride,
  ...extra,
});

export const getPolicy = async (actor: SeparationActor) => {
  const companyId = await requireAdmin(actor);
  return loadPolicy(companyId);
};

const parseNoticeDays = (v: unknown, label: string, nullable: boolean): number | null => {
  if (v === null || v === undefined || v === "") {
    if (nullable) return null;
    throw new ServiceError(`${label} is required`);
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 365) throw new ServiceError(`${label} must be a whole number of days between 0 and 365`);
  return n;
};

export const updatePolicy = async (actor: SeparationActor, body: any) => {
  const companyId = await requireAdmin(actor);
  const bool = (v: unknown, label: string) => {
    if (typeof v !== "boolean") throw new ServiceError(`${label} must be true or false`);
    return v;
  };
  const next = {
    defaultNoticeDays: parseNoticeDays(body?.defaultNoticeDays, "Default notice period", false),
    employeeNoticeDays: parseNoticeDays(body?.employeeNoticeDays, "Employee notice period", true),
    managerNoticeDays: parseNoticeDays(body?.managerNoticeDays, "Manager notice period", true),
    noticeStartsFrom: body?.noticeStartsFrom,
    dayCountMode: body?.dayCountMode,
    allowProposedLastDay: bool(body?.allowProposedLastDay, "Allow proposed last working day"),
    allowEarlyRelease: bool(body?.allowEarlyRelease, "Allow early release"),
    allowWaiver: bool(body?.allowWaiver, "Allow notice-period waiver"),
    allowAdminOverride: bool(body?.allowAdminOverride, "Allow admin override"),
  };
  if (!["submission", "approval"].includes(next.noticeStartsFrom)) throw new ServiceError("Notice period must start from submission or approval");
  if (!["calendar", "working"].includes(next.dayCountMode)) throw new ServiceError("Day count must be calendar or working days");

  const cols = POLICY_COLUMNS.map((c) => `"${c}"`).join(", ");
  const vals = POLICY_COLUMNS.map((c) => `:${c}`).join(", ");
  const sets = POLICY_COLUMNS.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
  await sequelize.query(
    `INSERT INTO separation_policies ("companyId", ${cols}, "updatedBy", "createdAt", "updatedAt")
     VALUES (:companyId, ${vals}, :by, NOW(), NOW())
     ON CONFLICT ("companyId") DO UPDATE SET ${sets}, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
    { replacements: { companyId, by: Number(actor.userId), ...next } }
  );
  return loadPolicy(companyId);
};

// ── Audit + transitions ───────────────────────────────────────────────────

const audit = async (
  t: Transaction,
  r: { id: number; companyId: number },
  actor: { userId: number | null; role: string | null },
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  comment: string | null = null,
  meta: Record<string, unknown> | null = null
) => {
  await sequelize.query(
    `INSERT INTO separation_audit_logs ("requestId","companyId","actorId","actorRole","action","fromStatus","toStatus","comment","meta","createdAt")
     VALUES (:requestId, :companyId, :actorId, :actorRole, :action, :fromStatus, :toStatus, :comment, :meta, NOW())`,
    {
      replacements: {
        requestId: r.id,
        companyId: r.companyId,
        actorId: actor.userId,
        actorRole: actor.role,
        action,
        fromStatus,
        toStatus,
        comment,
        meta: meta ? JSON.stringify(meta) : null,
      },
      transaction: t,
    }
  );
};

// Moves a request from `from` to `to` (only if it is still `from` — a
// concurrent reviewer gets a 409 instead of a double decision) and writes
// the audit row. `set` holds the other columns to update alongside.
const transition = async (
  t: Transaction,
  r: any,
  to: Status,
  actor: { userId: number | null; role: string | null },
  action: string,
  comment: string | null = null,
  set: Record<string, unknown> = {},
  meta: Record<string, unknown> | null = null
): Promise<any> => {
  const from = r.status as Status;
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new ServiceError(`A request that is "${from.replace(/_/g, " ")}" cannot become "${to.replace(/_/g, " ")}"`, 409);
  }
  const keys = Object.keys(set);
  const sql = `UPDATE separation_requests SET "status" = :to${keys.map((k) => `, "${k}" = :s_${k}`).join("")}, "updatedAt" = NOW()
                WHERE id = :id AND "status" = :from RETURNING *`;
  const replacements: Record<string, unknown> = { to, from, id: r.id };
  keys.forEach((k) => (replacements[`s_${k}`] = set[k] instanceof Object && !(set[k] instanceof Date) ? JSON.stringify(set[k]) : set[k]));
  const [rows]: any = await sequelize.query(sql, { replacements, transaction: t });
  const updated = rows?.[0];
  if (!updated) throw new ServiceError("This request was just changed by someone else. Refresh and try again.", 409);
  await audit(t, r, actor, action, from, to, comment, meta);
  return updated;
};

// Updates non-status columns (with an audit row) on a request that must
// still be in one of `allowed` statuses.
const updateFields = async (
  t: Transaction,
  r: any,
  allowed: Status[],
  set: Record<string, unknown>,
  actor: { userId: number | null; role: string | null },
  action: string,
  comment: string | null,
  meta: Record<string, unknown> | null
) => {
  const keys = Object.keys(set);
  const [rows]: any = await sequelize.query(
    `UPDATE separation_requests SET ${keys.map((k) => `"${k}" = :s_${k}`).join(", ")}, "updatedAt" = NOW()
      WHERE id = :id AND "status" IN (:allowed) RETURNING *`,
    { replacements: { id: r.id, allowed, ...Object.fromEntries(keys.map((k) => [`s_${k}`, set[k]])) }, transaction: t }
  );
  const updated = rows?.[0];
  if (!updated) throw new ServiceError("This request was just changed by someone else. Refresh and try again.", 409);
  await audit(t, r, actor, action, r.status, r.status, comment, meta);
  return updated;
};

const actorRef = (actor: SeparationActor) => ({ userId: Number(actor.userId), role: actor.role });

// ── Notifications (existing pipeline: bell + Socket.IO + push) ────────────
// Fire-and-forget: a notification failure never undoes a decision.

const notify = (receiverIds: Array<number | null | undefined>, senderId: number | null, title: string, body: string, r: any, kind: string) => {
  const ids = [...new Set(receiverIds.filter((id): id is number => id != null).map(Number))].filter((id) => id !== senderId);
  Promise.all(
    ids.map((receiverId) =>
      sendNotification({
        receiverId,
        senderId,
        type: NotificationType.SYSTEM,
        title,
        body,
        data: { kind, separationId: r.id, status: r.status },
      })
    )
  ).catch((err) => console.error("separation: notification failed:", err));
};

const loadNames = async (ids: Array<number | null | undefined>, transaction?: Transaction) => {
  const list = [...new Set(ids.filter((x): x is number => x != null).map(Number))];
  const rows: any[] = list.length
    ? await User.findAll({ where: { id: { [Op.in]: list } }, attributes: ["id", "firstName", "lastName", "email"], transaction })
    : [];
  return new Map<number, string>(rows.map((u) => [Number(u.id), personName(u)]));
};

// ── Loading a request the caller may see ──────────────────────────────────

type Access = "own" | "manager" | "team" | "admin";

const loadForActor = async (actor: SeparationActor, idParam: unknown, t?: Transaction): Promise<{ r: any; access: Access }> => {
  const companyId = requireCompany(actor);
  const id = parseId(idParam);
  const [r] = await query(
    `SELECT * FROM separation_requests WHERE id = :id AND "companyId" = :companyId ${t ? "FOR UPDATE" : ""}`,
    { id, companyId },
    t
  );
  if (!r) throw new ServiceError("Separation request not found", 404);
  const me = Number(actor.userId);
  if (Number(r.employeeId) === me) return { r, access: "own" };
  if (isAdmin(actor)) {
    if (!(await hasCompanyAccess(companyId, me, actor.role))) throw new ServiceError("You do not have access to this company", 403);
    return { r, access: "admin" };
  }
  if (actor.role === "manager") {
    if (Number(r.managerId) === me) return { r, access: "manager" };
    const team = await getCompanyScopedChildUserIds(me, companyId);
    if (team.map(Number).includes(Number(r.employeeId))) return { r, access: "team" };
  }
  throw new ServiceError("Separation request not found", 404);
};

// ── Employee / manager self-service ───────────────────────────────────────

const ensureApplicant = (actor: SeparationActor) => {
  if (!APPLICANT_ROLES.includes(actor.role)) {
    throw new ServiceError("Only employees and managers can submit a separation request", 403);
  }
  return requireCompany(actor);
};

// Reporting manager = the active manager who created this employee. A
// manager applicant always goes to the admin.
const resolveReportingManager = async (employeeId: number, role: string, companyId: number): Promise<number | null> => {
  if (role !== "employee") return null;
  const creator = await getDirectCreator(employeeId);
  if (!creator || creator.role !== "manager") return null;
  const mgr: any = await User.findOne({ where: { id: creator.id, status: "active", role: "manager" }, attributes: ["id"] });
  if (!mgr) return null;
  const companies = (await collectUserCompanyIds([Number(mgr.id)])).get(Number(mgr.id));
  if (companies && companies.size > 0 && !companies.has(companyId)) return null;
  return Number(mgr.id);
};

const SELECT_REQUEST = `
  SELECT s.*, s."resignationDate"::text AS "resignationDate",
         s."requestedLastWorkingDay"::text AS "requestedLastWorkingDay",
         s."noticeStartDate"::text AS "noticeStartDate",
         s."expectedLastWorkingDay"::text AS "expectedLastWorkingDay",
         s."approvedLastWorkingDay"::text AS "approvedLastWorkingDay",
         TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS "employeeName", u.email AS "employeeEmail",
         u."departmentId" AS "departmentId", d."deptName" AS "departmentName",
         TRIM(CONCAT(m."firstName", ' ', m."lastName")) AS "managerName",
         TRIM(CONCAT(md."firstName", ' ', md."lastName")) AS "managerDecisionByName",
         TRIM(CONCAT(ad."firstName", ' ', ad."lastName")) AS "adminDecisionByName"
    FROM separation_requests s
    JOIN users u ON u.id = s."employeeId"
    LEFT JOIN departments d ON d.id = u."departmentId"
    LEFT JOIN users m ON m.id = s."managerId"
    LEFT JOIN users md ON md.id = s."managerDecisionBy"
    LEFT JOIN users ad ON ad.id = s."adminDecisionBy"`;

const auditTrail = async (requestId: number) =>
  query(
    `SELECT l.id, l.action, l."fromStatus", l."toStatus", l.comment, l.meta, l."actorRole", l."createdAt",
            TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS "actorName"
       FROM separation_audit_logs l LEFT JOIN users u ON u.id = l."actorId"
      WHERE l."requestId" = :requestId ORDER BY l."createdAt", l.id`,
    { requestId }
  );

// GET /separation/my — the caller's requests, the active one's timeline,
// and the policy figures they'd get if they applied now.
export const getMySeparation = async (actor: SeparationActor) => {
  const companyId = requireCompany(actor);
  const canApplyRole = APPLICANT_ROLES.includes(actor.role);
  const me = Number(actor.userId);
  const rows = await query(`${SELECT_REQUEST} WHERE s."employeeId" = :me AND s."companyId" = :companyId ORDER BY s.id DESC`, {
    me,
    companyId,
  });
  const active = rows.find((r) => !TERMINAL.includes(r.status)) ?? null;
  const latest = active ?? rows[0] ?? null;
  const policy = await loadPolicy(companyId);
  const managerId = canApplyRole ? await resolveReportingManager(me, actor.role, companyId) : null;
  const names = await loadNames([managerId]);
  return {
    canApply: canApplyRole && !active,
    reasons: Object.entries(REASONS).map(([value, label]) => ({ value, label })),
    policy: {
      noticeDays: noticeDaysFor(policy, actor.role),
      noticeStartsFrom: policy.noticeStartsFrom,
      dayCountMode: policy.dayCountMode,
      allowProposedLastDay: policy.allowProposedLastDay,
    },
    approvalRoute: managerId ? ["manager", "admin"] : ["admin"],
    reportingManagerName: managerId ? names.get(managerId) ?? null : null,
    today: getISTDateString(),
    current: latest,
    timeline: latest ? await auditTrail(Number(latest.id)) : [],
    history: rows,
  };
};

const MAX_FUTURE_DAYS = 90;

// POST /separation/my — submit a resignation.
export const submitSeparation = async (actor: SeparationActor, body: any) => {
  const companyId = ensureApplicant(actor);
  const me = Number(actor.userId);
  const today = getISTDateString();

  const reason = body?.reason;
  if (typeof reason !== "string" || !REASONS[reason]) throw new ServiceError("Please choose a valid reason for leaving");
  const comments = text(body?.comments, "Comments", 2000, reason === "other");

  const resignationDate = body?.resignationDate;
  if (!isDateOnly(resignationDate)) throw new ServiceError("Resignation date must be a valid date (YYYY-MM-DD)");
  if (resignationDate < today) throw new ServiceError("Resignation date cannot be in the past");
  if (resignationDate > addDays(today, MAX_FUTURE_DAYS)) throw new ServiceError(`Resignation date can be at most ${MAX_FUTURE_DAYS} days from today`);

  const policy = await loadPolicy(companyId);
  let requestedLwd: string | null = null;
  if (body?.requestedLastWorkingDay != null && body.requestedLastWorkingDay !== "") {
    if (!policy.allowProposedLastDay) throw new ServiceError("Your company's policy does not allow proposing a last working day");
    if (!isDateOnly(body.requestedLastWorkingDay)) throw new ServiceError("Proposed last working day must be a valid date (YYYY-MM-DD)");
    requestedLwd = body.requestedLastWorkingDay;
    if (requestedLwd! < resignationDate) throw new ServiceError("Proposed last working day cannot be before the resignation date");
    if (requestedLwd! > addDays(resignationDate, 365)) throw new ServiceError("Proposed last working day must be within a year of the resignation date");
  }

  const employee: any = await User.findOne({ where: { id: me, status: "active" }, attributes: ["id", "branchId", "firstName", "lastName", "email", "role"] });
  if (!employee) throw new ServiceError("Your account is not active", 403);

  const managerId = await resolveReportingManager(me, actor.role, companyId);
  const status: Status = managerId ? "pending_manager_approval" : "pending_admin_approval";
  const noticeDays = noticeDaysFor(policy, actor.role);
  // Estimate only — recalculated with the policy in force at approval.
  const expected = await calculateLastWorkingDay({
    companyId,
    branchId: employee.branchId,
    start: resignationDate,
    noticeDays,
    mode: policy.dayCountMode,
  });

  let created: any;
  try {
    created = await sequelize.transaction(async (t) => {
      const [rows]: any = await sequelize.query(
        `INSERT INTO separation_requests ("companyId","employeeId","applicantRole","managerId","reason","comments","resignationDate",
            "requestedLastWorkingDay","status","noticeDays","expectedLastWorkingDay","policySnapshot","createdAt","updatedAt")
         VALUES (:companyId,:me,:role,:managerId,:reason,:comments,:resignationDate,:requestedLwd,:status,:noticeDays,:expected,:snapshot,NOW(),NOW())
         RETURNING *`,
        {
          replacements: {
            companyId, me, role: actor.role, managerId, reason, comments, resignationDate, requestedLwd, status, noticeDays, expected,
            snapshot: JSON.stringify(policySnapshot(policy, { stage: "estimate", noticeDays, calculatedLastWorkingDay: expected })),
          },
          transaction: t,
        }
      );
      const r = rows[0];
      await audit(t, r, actorRef(actor), "submitted", null, status, comments, {
        reason, resignationDate, requestedLastWorkingDay: requestedLwd, estimatedLastWorkingDay: expected, noticeDays,
        routedTo: managerId ? "manager" : "admin",
      });
      return r;
    });
  } catch (err: any) {
    if (err?.original?.code === "23505" || err?.parent?.code === "23505") {
      throw new ServiceError("You already have an active separation request", 409);
    }
    throw err;
  }

  const name = personName(employee);
  const adminIds = await getCompanyAdminIds(companyId);
  if (managerId) {
    notify([managerId], me, "Separation Request", `${name} submitted a resignation (${REASONS[reason]}) — waiting for your review.`, created, "separation_submitted");
    notify(adminIds, me, "Separation Request", `${name} submitted a resignation. It is with their manager for review first.`, created, "separation_submitted");
  } else {
    notify(adminIds, me, "Separation Request", `${name} (${actor.role}) submitted a resignation (${REASONS[reason]}) — waiting for your approval.`, created, "separation_submitted");
  }
  return created;
};

// POST /separation/my/:id/withdraw — the applicant withdraws while pending.
export const withdrawOwn = async (actor: SeparationActor, idParam: unknown, body: any) => {
  const reason = text(body?.reason, "Reason", 1000);
  const updated = await sequelize.transaction(async (t) => {
    const { r, access } = await loadForActor(actor, idParam, t);
    if (access !== "own") throw new ServiceError("You can only withdraw your own request", 403);
    if (!PENDING.includes(r.status)) {
      throw new ServiceError("Only a pending request can be withdrawn. After approval, ask your admin.", 409);
    }
    return transition(t, r, "withdrawn", actorRef(actor), "withdrawn", reason, {
      withdrawnBy: Number(actor.userId), withdrawnAt: new Date(), withdrawReason: reason,
    });
  });
  const names = await loadNames([updated.employeeId]);
  const adminIds = await getCompanyAdminIds(Number(updated.companyId));
  notify([updated.managerId, ...adminIds], Number(actor.userId), "Separation Withdrawn", `${names.get(Number(updated.employeeId))} withdrew their resignation.`, updated, "separation_withdrawn");
  return updated;
};

// ── Review lists ──────────────────────────────────────────────────────────

const visibleScope = async (actor: SeparationActor): Promise<{ companyId: number; where: string; repl: Record<string, unknown> }> => {
  const companyId = requireCompany(actor);
  const me = Number(actor.userId);
  if (isAdmin(actor)) {
    if (!(await hasCompanyAccess(companyId, me, actor.role))) throw new ServiceError("You do not have access to this company", 403);
    return { companyId, where: `s."companyId" = :companyId`, repl: { companyId } };
  }
  if (actor.role === "manager") {
    const team = (await getCompanyScopedChildUserIds(me, companyId)).map(Number).filter((id) => id !== me);
    return {
      companyId,
      where: `s."companyId" = :companyId AND s."employeeId" <> :me AND (s."managerId" = :me ${team.length ? `OR s."employeeId" IN (:team)` : ""})`,
      repl: { companyId, me, team },
    };
  }
  throw new ServiceError("You cannot view separation requests of others", 403);
};

export const listRequests = async (actor: SeparationActor, q: any) => {
  const scope = await visibleScope(actor);
  const filters: string[] = [scope.where];
  const repl: Record<string, unknown> = { ...scope.repl };

  if (typeof q?.status === "string" && q.status) {
    if (q.status === "active") filters.push(`s.status NOT IN ('rejected','withdrawn','completed')`);
    else if (q.status === "approved_active") filters.push(`s.status IN ('approved','notice_period','handover_pending','clearance_pending')`);
    else if (q.status === "action_required") {
      filters.push(isAdmin(actor) ? `s.status = 'pending_admin_approval'` : `s.status = 'pending_manager_approval' AND s."managerId" = :me`);
      repl.me = Number(actor.userId);
    } else if ((STATUSES as readonly string[]).includes(q.status)) {
      filters.push(`s.status = :status`);
      repl.status = q.status;
    }
  }
  if (typeof q?.search === "string" && q.search.trim()) {
    filters.push(`(CONCAT(u."firstName", ' ', u."lastName") ILIKE :search OR u.email ILIKE :search)`);
    repl.search = `%${q.search.trim().slice(0, 100)}%`;
  }
  if (q?.role === "employee" || q?.role === "manager") {
    filters.push(`s."applicantRole" = :role`);
    repl.role = q.role;
  }
  if (q?.departmentId && Number.isInteger(Number(q.departmentId))) {
    filters.push(`u."departmentId" = :departmentId`);
    repl.departmentId = Number(q.departmentId);
  }
  if (isDateOnly(q?.from)) { filters.push(`s."createdAt" >= (:from)::date`); repl.from = q.from; }
  if (isDateOnly(q?.to)) { filters.push(`s."createdAt" < (:to)::date + 1`); repl.to = q.to; }
  const lwd = `COALESCE(s."approvedLastWorkingDay", s."expectedLastWorkingDay")`;
  if (isDateOnly(q?.lwdFrom)) { filters.push(`${lwd} >= :lwdFrom`); repl.lwdFrom = q.lwdFrom; }
  if (isDateOnly(q?.lwdTo)) { filters.push(`${lwd} <= :lwdTo`); repl.lwdTo = q.lwdTo; }

  const limit = Math.min(Math.max(Number(q?.limit) || 200, 1), 500);
  const rows = await query(
    `${SELECT_REQUEST} WHERE ${filters.join(" AND ")}
      ORDER BY (s.status IN ('pending_manager_approval','pending_admin_approval')) DESC, s."createdAt" DESC, s.id DESC
      LIMIT ${limit}`,
    repl
  );

  const [summary] = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE s.status = 'pending_manager_approval')::int AS "pendingManager",
            COUNT(*) FILTER (WHERE s.status = 'pending_admin_approval')::int AS "pendingAdmin",
            COUNT(*) FILTER (WHERE s.status IN ('approved','notice_period','handover_pending','clearance_pending'))::int AS approved,
            COUNT(*) FILTER (WHERE s.status = 'rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE s.status = 'withdrawn')::int AS withdrawn,
            COUNT(*) FILTER (WHERE s.status = 'notice_period')::int AS "servingNotice",
            COUNT(*) FILTER (WHERE s.status IN ('handover_pending','clearance_pending'))::int AS offboarding,
            COUNT(*) FILTER (WHERE s.status = 'completed')::int AS completed
       FROM separation_requests s JOIN users u ON u.id = s."employeeId"
      WHERE ${scope.where}`,
    scope.repl
  );

  const departments = await query(
    `SELECT DISTINCT d.id, d."deptName" AS name FROM separation_requests s
       JOIN users u ON u.id = s."employeeId" JOIN departments d ON d.id = u."departmentId"
      WHERE ${scope.where} ORDER BY name`,
    scope.repl
  );
  return { rows, summary, departments, isAdmin: isAdmin(actor) };
};

// ── Detail ────────────────────────────────────────────────────────────────

const capabilitiesFor = (actor: SeparationActor, r: any, access: Access, today: string) => {
  const me = Number(actor.userId);
  const ownRequest = Number(r.employeeId) === me;
  const admin = access === "admin";
  const reviewingManager = access === "manager" && Number(r.managerId) === me && !ownRequest;
  const lwd = ymd(r.approvedLastWorkingDay);
  return {
    canWithdraw: ownRequest && PENDING.includes(r.status),
    canManagerReview: reviewingManager && r.status === "pending_manager_approval",
    canAdminReview: admin && !ownRequest && r.status === "pending_admin_approval",
    canAdjustLastDay: admin && ["notice_period", "handover_pending", "clearance_pending"].includes(r.status),
    canAdminWithdraw: admin && !TERMINAL.includes(r.status),
    canViewHandover: !ownRequest && (admin || access === "manager" || access === "team") && [...POST_APPROVAL, "completed"].includes(r.status),
    canStartHandover: (admin || reviewingManager) && r.status === "notice_period",
    canUpdateHandover: (admin || reviewingManager) && r.status === "handover_pending",
    canWaiveHandover: admin && r.status === "handover_pending",
    canReassign: admin && ["notice_period", "handover_pending", "clearance_pending"].includes(r.status),
    canUpdateClearance: admin && r.status === "clearance_pending",
    canComplete:
      admin && r.status === "clearance_pending" && ["completed", "waived"].includes(r.clearanceStatus) &&
      ["completed", "waived"].includes(r.handoverStatus) && !!lwd && today >= lwd,
  };
};

export const getRequest = async (actor: SeparationActor, idParam: unknown) => {
  const { r, access } = await loadForActor(actor, idParam);
  const [row] = await query(`${SELECT_REQUEST} WHERE s.id = :id`, { id: r.id });
  const today = getISTDateString();
  const caps = capabilitiesFor(actor, r, access, today);
  let approvalPreview = null;
  let policy = null;
  if (caps.canAdminReview || caps.canAdjustLastDay) {
    policy = await loadPolicy(Number(r.companyId));
    const employee: any = await User.findByPk(Number(r.employeeId), { attributes: ["id", "branchId"] });
    const start = policy.noticeStartsFrom === "approval" ? today : ymd(r.resignationDate)!;
    const noticeDays = noticeDaysFor(policy, r.applicantRole);
    approvalPreview = {
      noticeDays,
      noticeStartDate: start,
      calculatedLastWorkingDay: await calculateLastWorkingDay({
        companyId: Number(r.companyId), branchId: employee?.branchId, start, noticeDays, mode: policy.dayCountMode,
      }),
    };
  }
  return { request: row, access, capabilities: caps, timeline: await auditTrail(Number(r.id)), policy, approvalPreview, today };
};

// ── Manager review ────────────────────────────────────────────────────────

export const managerReview = async (actor: SeparationActor, idParam: unknown, body: any) => {
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") throw new ServiceError("Decision must be approve or reject");
  const comment = text(body?.comment, "Comment", 2000, decision === "reject");
  if (actor.role !== "manager") throw new ServiceError("Only the reporting manager can do this review", 403);
  const me = Number(actor.userId);

  const updated = await sequelize.transaction(async (t) => {
    const { r } = await loadForActor(actor, idParam, t);
    if (Number(r.employeeId) === me) throw new ServiceError("You cannot review your own separation request", 403);
    if (Number(r.managerId) !== me) throw new ServiceError("This request is not assigned to you for review", 403);
    if (r.status !== "pending_manager_approval") throw new ServiceError("This request is not waiting for manager review", 409);
    const set = { managerDecisionBy: me, managerDecisionAt: new Date(), managerComment: comment };
    return decision === "approve"
      ? transition(t, r, "pending_admin_approval", actorRef(actor), "manager_approved", comment, set)
      : transition(t, r, "rejected", actorRef(actor), "manager_rejected", comment, set);
  });

  const names = await loadNames([me, updated.employeeId]);
  const mgr = names.get(me);
  if (decision === "approve") {
    notify([updated.employeeId], me, "Resignation Approved by Manager", `${mgr} approved your resignation. It is now with the admin for final approval.`, updated, "separation_manager_approved");
    notify(await getCompanyAdminIds(Number(updated.companyId)), me, "Separation Request", `${mgr} approved ${names.get(Number(updated.employeeId))}'s resignation — waiting for your final approval.`, updated, "separation_manager_approved");
  } else {
    notify([updated.employeeId], me, "Resignation Rejected", `${mgr} rejected your resignation.${comment ? ` Comment: ${comment}` : ""}`, updated, "separation_rejected");
  }
  return updated;
};

// ── Admin review / last working day ───────────────────────────────────────

type Adjustment = "none" | "override" | "early_release" | "waiver";

// Validates an admin's chosen last working day against the policy flags.
const validateLastDay = (p: {
  policy: SeparationPolicy;
  adjustment: Adjustment;
  lastDay: string;
  calculated: string;
  resignationDate: string;
  today: string;
  reason: string | null;
  noticeChanged: boolean;
}) => {
  const { policy, adjustment, lastDay, calculated, resignationDate, today, reason } = p;
  if (lastDay < resignationDate) throw new ServiceError("Last working day cannot be before the resignation date");
  if (lastDay < today) throw new ServiceError("Last working day cannot be in the past");
  if (lastDay > addDays(resignationDate, 400)) throw new ServiceError("Last working day is too far after the resignation date");
  if (adjustment === "none") {
    if (lastDay !== calculated || p.noticeChanged) {
      throw new ServiceError("The chosen notice period / last working day differs from the policy — choose override, early release or waiver and give a reason");
    }
    return;
  }
  if (!reason) throw new ServiceError("A reason is required when changing the notice period or last working day");
  if (adjustment === "override" && !policy.allowAdminOverride) throw new ServiceError("Your separation policy does not allow overriding the last working day");
  if (adjustment === "early_release") {
    if (!policy.allowEarlyRelease) throw new ServiceError("Your separation policy does not allow early release");
    if (lastDay >= calculated) throw new ServiceError(`Early release must end before the calculated last working day (${calculated})`);
  }
  if (adjustment === "waiver" && !policy.allowWaiver) throw new ServiceError("Your separation policy does not allow waiving the notice period");
};

const parseAdjustment = (v: unknown): Adjustment => {
  if (v == null || v === "" || v === "none") return "none";
  if (v === "override" || v === "early_release" || v === "waiver") return v;
  throw new ServiceError("Adjustment must be none, override, early_release or waiver");
};

export const adminReview = async (actor: SeparationActor, idParam: unknown, body: any) => {
  await requireAdmin(actor);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") throw new ServiceError("Decision must be approve or reject");
  const comment = text(body?.comment, "Comment", 2000, decision === "reject");
  const me = Number(actor.userId);
  const today = getISTDateString();

  const updated = await sequelize.transaction(async (t) => {
    const { r } = await loadForActor(actor, idParam, t);
    if (Number(r.employeeId) === me) throw new ServiceError("You cannot review your own separation request", 403);
    if (r.status !== "pending_admin_approval") {
      throw new ServiceError(
        r.status === "pending_manager_approval" ? "This request is still waiting for the reporting manager's review" : "This request is not waiting for admin approval",
        409
      );
    }
    const decisionSet = { adminDecisionBy: me, adminDecisionAt: new Date(), adminComment: comment };
    if (decision === "reject") return transition(t, r, "rejected", actorRef(actor), "admin_rejected", comment, decisionSet);

    // Approve: calculate with the policy in force NOW and freeze it.
    const policy = await loadPolicy(Number(r.companyId), t);
    const employee: any = await User.findByPk(Number(r.employeeId), { attributes: ["id", "branchId"], transaction: t });
    const resignationDate = ymd(r.resignationDate)!;
    const start = policy.noticeStartsFrom === "approval" ? today : resignationDate;
    const policyDays = noticeDaysFor(policy, r.applicantRole);
    const adjustment = parseAdjustment(body?.adjustment);
    const reason = text(body?.adjustmentReason, "Adjustment reason", 1000);

    let noticeDays = body?.noticeDays === undefined || body?.noticeDays === null || body?.noticeDays === ""
      ? policyDays
      : (parseNoticeDays(body.noticeDays, "Notice period", false) as number);
    if (adjustment === "waiver") noticeDays = 0;
    const calcArgs = { companyId: Number(r.companyId), branchId: employee?.branchId, start, mode: policy.dayCountMode };
    const policyLastDay = await calculateLastWorkingDay({ ...calcArgs, noticeDays: policyDays });
    const calculated = noticeDays === policyDays ? policyLastDay : await calculateLastWorkingDay({ ...calcArgs, noticeDays });

    let lastDay: string;
    if (body?.approvedLastWorkingDay != null && body.approvedLastWorkingDay !== "") {
      if (!isDateOnly(body.approvedLastWorkingDay)) throw new ServiceError("Approved last working day must be a valid date (YYYY-MM-DD)");
      lastDay = body.approvedLastWorkingDay;
    } else {
      lastDay = adjustment === "waiver" ? (today > resignationDate ? today : resignationDate) : calculated;
    }
    if (noticeDays !== policyDays && adjustment === "none") {
      throw new ServiceError("Changing the notice period from the policy needs an override and a reason");
    }
    if (noticeDays !== policyDays && adjustment === "override" && !policy.allowAdminOverride) {
      throw new ServiceError("Your separation policy does not allow overriding the notice period");
    }
    validateLastDay({
      policy, adjustment, lastDay, calculated: policyLastDay, resignationDate, today, reason,
      noticeChanged: noticeDays !== policyDays,
    });

    const snapshot = policySnapshot(policy, {
      stage: "applied",
      appliedAt: new Date().toISOString(),
      appliedBy: me,
      policyNoticeDays: policyDays,
      noticeDays,
      noticeStartDate: start,
      calculatedLastWorkingDay: policyLastDay,
      approvedLastWorkingDay: lastDay,
      adjustment,
    });
    const approved = await transition(t, r, "approved", actorRef(actor), "admin_approved", comment, {
      ...decisionSet,
      noticeDays,
      noticeStartDate: start,
      expectedLastWorkingDay: policyLastDay,
      approvedLastWorkingDay: lastDay,
      policySnapshot: snapshot,
      lwdAdjustment: adjustment === "none" ? null : adjustment,
      lwdAdjustmentReason: adjustment === "none" ? null : reason,
      lwdAdjustedBy: adjustment === "none" ? null : me,
      lwdAdjustedAt: adjustment === "none" ? null : new Date(),
    }, {
      noticeDays, policyNoticeDays: policyDays, noticeStartDate: start, calculatedLastWorkingDay: policyLastDay,
      approvedLastWorkingDay: lastDay, requestedLastWorkingDay: ymd(r.requestedLastWorkingDay), adjustment, adjustmentReason: reason,
    });
    // Notice always starts on or before approval (submission or approval
    // date), so it is running from this moment.
    return transition(t, approved, "notice_period", { userId: null, role: "system" }, "notice_started", null);
  });

  const names = await loadNames([me, updated.employeeId]);
  const emp = names.get(Number(updated.employeeId));
  if (decision === "approve") {
    const lwd = ymd(updated.approvedLastWorkingDay);
    notify([updated.employeeId], me, "Resignation Approved", `Your resignation was approved. Notice period: ${updated.noticeDays} day(s). Last working day: ${fmtDate(lwd)}.`, updated, "separation_approved");
    notify([updated.managerId], me, "Resignation Approved", `${emp}'s resignation was approved. Last working day: ${fmtDate(lwd)}.`, updated, "separation_approved");
  } else {
    notify([updated.employeeId], me, "Resignation Rejected", `Your resignation was rejected by the admin.${comment ? ` Comment: ${comment}` : ""}`, updated, "separation_rejected");
    notify([updated.managerId], me, "Resignation Rejected", `${emp}'s resignation was rejected by the admin.`, updated, "separation_rejected");
  }
  return updated;
};

// PATCH /separation/requests/:id/last-working-day — change the approved
// last working day during notice (override, early release or waiver).
export const adjustLastWorkingDay = async (actor: SeparationActor, idParam: unknown, body: any) => {
  await requireAdmin(actor);
  const adjustment = parseAdjustment(body?.adjustment);
  if (adjustment === "none") throw new ServiceError("Choose override, early release or waiver");
  const reason = text(body?.reason, "Reason", 1000, true);
  if (!isDateOnly(body?.lastWorkingDay)) throw new ServiceError("Last working day must be a valid date (YYYY-MM-DD)");
  const lastDay: string = body.lastWorkingDay;
  const me = Number(actor.userId);
  const today = getISTDateString();
  let previous: string | null = null;

  const updated = await sequelize.transaction(async (t) => {
    const { r } = await loadForActor(actor, idParam, t);
    if (Number(r.employeeId) === me) throw new ServiceError("You cannot change your own separation", 403);
    const allowed: Status[] = ["notice_period", "handover_pending", "clearance_pending"];
    if (!allowed.includes(r.status)) throw new ServiceError("The last working day can only be changed while the notice period / offboarding is in progress", 409);
    previous = ymd(r.approvedLastWorkingDay);
    if (lastDay === previous) throw new ServiceError("That is already the approved last working day");
    // Policy flags are those of the CURRENT policy (they govern what an
    // admin may do now); the frozen snapshot keeps the original calculation.
    const policy = await loadPolicy(Number(r.companyId), t);
    validateLastDay({
      policy, adjustment, lastDay, calculated: ymd(r.expectedLastWorkingDay)!, resignationDate: ymd(r.resignationDate)!, today, reason,
      noticeChanged: false,
    });
    return updateFields(t, r, allowed, {
      approvedLastWorkingDay: lastDay, lwdAdjustment: adjustment, lwdAdjustmentReason: reason, lwdAdjustedBy: me, lwdAdjustedAt: new Date(),
    }, actorRef(actor), "last_working_day_changed", reason, { from: previous, to: lastDay, adjustment });
  });

  const names = await loadNames([updated.employeeId]);
  const label = adjustment === "early_release" ? "Early release approved" : adjustment === "waiver" ? "Notice period waived" : "Last working day changed";
  notify([updated.employeeId], me, label, `Your last working day is now ${fmtDate(lastDay)} (was ${fmtDate(previous)}). Reason: ${reason}`, updated, "separation_lwd_changed");
  notify([updated.managerId], me, label, `${names.get(Number(updated.employeeId))}'s last working day is now ${fmtDate(lastDay)} (was ${fmtDate(previous)}).`, updated, "separation_lwd_changed");
  return updated;
};

// POST /separation/requests/:id/withdraw — admin withdraws any active
// request (e.g. the employee changed their mind after approval).
export const adminWithdraw = async (actor: SeparationActor, idParam: unknown, body: any) => {
  await requireAdmin(actor);
  const reason = text(body?.reason, "Reason", 1000, true);
  const me = Number(actor.userId);
  const updated = await sequelize.transaction(async (t) => {
    const { r } = await loadForActor(actor, idParam, t);
    if (Number(r.employeeId) === me) throw new ServiceError("You cannot act on your own separation", 403);
    if (TERMINAL.includes(r.status)) throw new ServiceError(`This request is already ${r.status}`, 409);
    return transition(t, r, "withdrawn", actorRef(actor), "withdrawn_by_admin", reason, {
      withdrawnBy: me, withdrawnAt: new Date(), withdrawReason: reason,
    });
  });
  const names = await loadNames([updated.employeeId]);
  notify([updated.employeeId], me, "Separation Withdrawn", `Your separation request was withdrawn by the admin. Reason: ${reason}`, updated, "separation_withdrawn");
  notify([updated.managerId], me, "Separation Withdrawn", `${names.get(Number(updated.employeeId))}'s separation was withdrawn by the admin.`, updated, "separation_withdrawn");
  return updated;
};

// ── Handover ──────────────────────────────────────────────────────────────

const OPEN_TASK_STATUSES = ["todo", "in_progress", "in_review"];
const OPEN_MEETING_STATUSES = ["pending", "scheduled", "in"];

// GET /separation/requests/:id/handover — what the person still holds.
// Read-only: nothing is moved without an explicit, audited action.
export const getHandover = async (actor: SeparationActor, idParam: unknown) => {
  const { r, access } = await loadForActor(actor, idParam);
  const caps = capabilitiesFor(actor, r, access, getISTDateString());
  if (!caps.canViewHandover) throw new ServiceError("Handover details are not available for this request", 403);
  const employeeId = Number(r.employeeId);
  const companyId = Number(r.companyId);

  const [clients, tasks, meetings]: [any[], any[], any[]] = await Promise.all([
    MeetingUser.findAll({
      where: { userId: employeeId },
      attributes: ["id", "name", "companyName", "mobile", "email"],
      order: [["name", "ASC"]],
      limit: 500,
    }),
    Task.findAll({
      where: { assignedTo: employeeId, companyId, status: { [Op.in]: OPEN_TASK_STATUSES } },
      attributes: ["id", "title", "status", "priority", "dueDate"],
      order: [["dueDate", "ASC"], ["id", "ASC"]],
      limit: 500,
    }),
    Meeting.findAll({
      where: { userId: employeeId, status: { [Op.in]: OPEN_MEETING_STATUSES } },
      attributes: ["id", "status", "scheduledTime", "meetingUserId", "companyId"],
      order: [["scheduledTime", "ASC"]],
      limit: 200,
    }),
  ]);
  const clientNames = new Map<number, string>();
  const meetingClientIds = [...new Set(meetings.map((m: any) => Number(m.meetingUserId)).filter(Boolean))];
  if (meetingClientIds.length) {
    const mc: any[] = await MeetingUser.findAll({ where: { id: { [Op.in]: meetingClientIds } }, attributes: ["id", "name"] });
    mc.forEach((c) => clientNames.set(Number(c.id), c.name));
  }
  return {
    capabilities: caps,
    handoverStatus: r.handoverStatus,
    handoverNotes: r.handoverNotes,
    clearanceStatus: r.clearanceStatus,
    clearanceNotes: r.clearanceNotes,
    clients: clients.map((c: any) => ({ id: Number(c.id), name: c.name, companyName: c.companyName, mobile: c.mobile, email: c.email })),
    tasks: tasks.map((tk: any) => ({ id: Number(tk.id), title: tk.title, status: tk.status, priority: tk.priority, dueDate: tk.dueDate })),
    meetings: meetings.map((m: any) => ({
      id: Number(m.id), status: m.status, scheduledTime: m.scheduledTime, clientName: clientNames.get(Number(m.meetingUserId)) ?? null,
    })),
  };
};

// POST /separation/requests/:id/handover/tasks — move the person's open
// tasks to another active employee/manager of the company. Recorded in
// task_history (as the task module does) and the separation audit log.
export const reassignTasks = async (actor: SeparationActor, idParam: unknown, body: any) => {
  await requireAdmin(actor);
  const toUserId = parseId(body?.toUserId, "replacement employee");
  const taskIds: number[] | null = Array.isArray(body?.taskIds) ? body.taskIds.map((x: unknown) => parseId(x, "task")) : null;
  if (taskIds && taskIds.length === 0) throw new ServiceError("Select at least one task");
  const me = Number(actor.userId);

  const result = await sequelize.transaction(async (t) => {
    const { r } = await loadForActor(actor, idParam, t);
    if (!["notice_period", "handover_pending", "clearance_pending"].includes(r.status)) {
      throw new ServiceError("Tasks can only be reassigned during the notice period / handover", 409);
    }
    const employeeId = Number(r.employeeId);
    const companyId = Number(r.companyId);
    if (toUserId === employeeId) throw new ServiceError("The replacement must be a different person");
    const to: any = await User.findOne({
      where: { id: toUserId, status: "active", role: { [Op.in]: ["employee", "manager"] } },
      attributes: ["id", "firstName", "lastName", "email"],
      transaction: t,
    });
    const toCompanies = to ? (await collectUserCompanyIds([toUserId])).get(toUserId) : null;
    if (!to || !toCompanies || !toCompanies.has(companyId)) {
      throw new ServiceError("The replacement must be an active employee or manager of this company");
    }
    const [activeSep] = await query(
      `SELECT id FROM separation_requests WHERE "employeeId" = :toUserId AND status IN ('notice_period','handover_pending','clearance_pending') LIMIT 1`,
      { toUserId },
      t
    );
    if (activeSep) throw new ServiceError("The replacement is serving their own notice period — choose someone else");

    const tasks: any[] = await Task.findAll({
      where: {
        assignedTo: employeeId, companyId, status: { [Op.in]: OPEN_TASK_STATUSES },
        ...(taskIds ? { id: { [Op.in]: taskIds } } : {}),
      },
      attributes: ["id", "title", "assignedTo"],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (taskIds && tasks.length !== taskIds.length) throw new ServiceError("Some selected tasks are no longer open or assigned to this person. Refresh and try again.", 409);
    if (tasks.length === 0) throw new ServiceError("There are no open tasks to reassign", 409);
    const ids = tasks.map((x) => Number(x.id));
    await Task.update({ assignedTo: toUserId } as any, { where: { id: { [Op.in]: ids }, assignedTo: employeeId }, transaction: t });
    await TaskHistory.bulkCreate(
      ids.map((taskId) => ({ taskId, changedBy: me, field: "assignedTo", oldValue: String(employeeId), newValue: String(toUserId) })) as any,
      { transaction: t }
    );
    await audit(t, r, actorRef(actor), "tasks_reassigned", r.status, r.status, null, { taskIds: ids, fromUserId: employeeId, toUserId });
    return { reassigned: ids.length, to: { id: toUserId, name: personName(to) }, r };
  });

  sendNotification({
    receiverId: toUserId,
    senderId: me,
    type: NotificationType.TASK,
    title: "Tasks Assigned",
    body: `${result.reassigned} open task(s) were handed over to you.`,
    data: { kind: "separation_tasks_reassigned", separationId: result.r.id },
  }).catch((err) => console.error("separation: task handover notification failed:", err));
  return { reassigned: result.reassigned, to: result.to };
};

// POST /separation/requests/:id/start-handover — notice_period → handover_pending.
export const startHandover = async (actor: SeparationActor, idParam: unknown) => {
  const me = Number(actor.userId);
  const updated = await sequelize.transaction(async (t) => {
    const { r, access } = await loadForActor(actor, idParam, t);
    const caps = capabilitiesFor(actor, r, access, getISTDateString());
    if (!caps.canStartHandover) throw new ServiceError("You cannot start the handover for this request", 403);
    return transition(t, r, "handover_pending", actorRef(actor), "handover_started");
  });
  notify([updated.employeeId], me, "Handover Started", "The handover of your clients, tasks and responsibilities has started.", updated, "separation_handover_started");
  return updated;
};

const parseStepStatus = (v: unknown) => {
  if (v !== "pending" && v !== "completed" && v !== "waived") throw new ServiceError("Status must be pending, completed or waived");
  return v as "pending" | "completed" | "waived";
};

// PATCH /separation/requests/:id/handover — save notes, or mark the
// handover completed / waived (admin only), which moves it to clearance.
export const updateHandover = async (actor: SeparationActor, idParam: unknown, body: any) => {
  const step = parseStepStatus(body?.status);
  const notes = text(body?.notes, "Notes", 4000, step === "waived");
  const me = Number(actor.userId);
  const updated = await sequelize.transaction(async (t) => {
    const { r, access } = await loadForActor(actor, idParam, t);
    const caps = capabilitiesFor(actor, r, access, getISTDateString());
    if (!caps.canUpdateHandover) throw new ServiceError("You cannot update the handover for this request", 403);
    if (step === "waived" && !caps.canWaiveHandover) throw new ServiceError("Only an admin can waive the handover", 403);
    const set = { handoverStatus: step, handoverNotes: notes, handoverBy: me, handoverAt: new Date() };
    if (step === "pending") return updateFields(t, r, ["handover_pending"], set, actorRef(actor), "handover_notes_updated", notes, null);
    return transition(t, r, "clearance_pending", actorRef(actor), step === "waived" ? "handover_waived" : "handover_completed", notes, set);
  });
  if (step !== "pending") {
    const names = await loadNames([updated.employeeId]);
    const adminIds = await getCompanyAdminIds(Number(updated.companyId));
    notify([...adminIds, updated.managerId], me, "Handover " + (step === "waived" ? "Waived" : "Completed"), `Handover for ${names.get(Number(updated.employeeId))} is ${step}. Clearance is next.`, updated, "separation_handover_done");
  }
  return updated;
};

// PATCH /separation/requests/:id/clearance — admin records clearance.
export const updateClearance = async (actor: SeparationActor, idParam: unknown, body: any) => {
  await requireAdmin(actor);
  const step = parseStepStatus(body?.status);
  const notes = text(body?.notes, "Notes", 4000, step === "waived");
  const me = Number(actor.userId);
  const updated = await sequelize.transaction(async (t) => {
    const { r } = await loadForActor(actor, idParam, t);
    if (Number(r.employeeId) === me) throw new ServiceError("You cannot act on your own separation", 403);
    if (r.status !== "clearance_pending") throw new ServiceError("Clearance can only be recorded after the handover", 409);
    return updateFields(t, r, ["clearance_pending"], { clearanceStatus: step, clearanceNotes: notes, clearanceBy: me, clearanceAt: new Date() },
      actorRef(actor), step === "pending" ? "clearance_notes_updated" : `clearance_${step}`, notes, null);
  });
  if (step !== "pending") {
    const names = await loadNames([updated.employeeId]);
    const adminIds = await getCompanyAdminIds(Number(updated.companyId));
    notify([...adminIds, updated.managerId], me, "Clearance " + (step === "waived" ? "Waived" : "Completed"), `Clearance for ${names.get(Number(updated.employeeId))} is ${step}.`, updated, "separation_clearance_done");
  }
  return updated;
};

// POST /separation/requests/:id/complete — final offboarding. Deactivates
// the login (status deActive, sessions revoked). Never deletes anything.
export const completeSeparation = async (actor: SeparationActor, idParam: unknown, body: any) => {
  await requireAdmin(actor);
  const comment = text(body?.comment, "Comment", 2000);
  const me = Number(actor.userId);
  const today = getISTDateString();
  const updated = await sequelize.transaction(async (t) => {
    const { r, access } = await loadForActor(actor, idParam, t);
    if (Number(r.employeeId) === me) throw new ServiceError("You cannot complete your own separation", 403);
    if (r.status !== "clearance_pending") throw new ServiceError("Only a request in clearance can be completed", 409);
    if (!["completed", "waived"].includes(r.handoverStatus)) throw new ServiceError("Handover must be completed or waived first", 409);
    if (!["completed", "waived"].includes(r.clearanceStatus)) throw new ServiceError("Clearance must be completed or waived first", 409);
    const lwd = ymd(r.approvedLastWorkingDay);
    if (!lwd || today < lwd) throw new ServiceError(`The separation can only be completed on or after the last working day (${fmtDate(lwd)})`, 409);
    if (!capabilitiesFor(actor, r, access, today).canComplete) throw new ServiceError("You cannot complete this separation", 403);

    const done = await transition(t, r, "completed", actorRef(actor), "completed", comment, {
      completedBy: me, completedAt: new Date(), accountDeactivatedAt: new Date(),
    });
    const [count] = await User.update({ status: "deActive" } as any, { where: { id: Number(r.employeeId), status: "active" }, transaction: t });
    await audit(t, r, actorRef(actor), "account_deactivated", "completed", "completed", null, { userId: Number(r.employeeId), wasActive: count > 0 });
    return done;
  });
  // After commit: drop every refresh session so no new access token can be
  // minted. tokenCheck already refuses deActive users on every request.
  await revokeAllSessionsForUser(Number(updated.employeeId)).catch((err) => console.error("separation: session revoke failed:", err));
  const names = await loadNames([updated.employeeId]);
  const adminIds = await getCompanyAdminIds(Number(updated.companyId));
  notify([...adminIds, updated.managerId], me, "Separation Completed", `${names.get(Number(updated.employeeId))}'s separation is complete and their login has been deactivated.`, updated, "separation_completed");
  return updated;
};

// ── Daily job (config/cronJobs.ts) ────────────────────────────────────────
// Once the approved last working day arrives, a request still in notice
// moves to handover so the admin/manager are prompted to finish
// offboarding. Never deactivates anyone — that stays an admin action.
export const startDueHandovers = async (today: string = getISTDateString()) => {
  const due = await query(
    `SELECT * FROM separation_requests WHERE status = 'notice_period' AND "approvedLastWorkingDay" <= :today ORDER BY id`,
    { today }
  );
  let moved = 0;
  for (const r of due) {
    try {
      const updated = await sequelize.transaction((t) =>
        transition(t, r, "handover_pending", { userId: null, role: "system" }, "handover_started", "Last working day reached")
      );
      moved++;
      const names = await loadNames([updated.employeeId]);
      const adminIds = await getCompanyAdminIds(Number(updated.companyId));
      notify([...adminIds, updated.managerId], null, "Last Working Day Reached", `${names.get(Number(updated.employeeId))} has reached their last working day. Complete the handover and clearance.`, updated, "separation_lwd_reached");
    } catch (err) {
      if (!(err instanceof ServiceError)) console.error(`separation: handover start failed for #${r.id}:`, err);
    }
  }
  return { checked: due.length, moved };
};
