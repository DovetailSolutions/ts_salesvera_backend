import { Op } from "sequelize";
import { Task, User } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getISTDateString } from "../shared/dateUtils";
import {
  getCompanyScopedChildUserIds,
  getCompanyScopedChildUserIdsFast,
  getCompanyScopedOrgWideUserIds,
  dropFellowAdmins,
} from "../shared/userHierarchy";

// ============================================================
// Task dashboard — read-only task KPIs for web and mobile.
//
//   GET .../task-dashboard/my              everyone: tasks assigned to me
//   GET .../task-dashboard/team            manager: my team · admin/owner: whole company
//   GET .../task-dashboard/member/:userId  one team member's tasks (same scope check)
//
// Visibility is the same rule as the task board (Notigication/task.ts):
// employee → own tasks only; manager → self + company-scoped team;
// admin / owner (user) / super_admin → the whole company.
//
// Definitions (cancelled tasks are ignored everywhere):
//   pending      status todo / in_progress / in_review (right now, any date)
//   overdue      pending and its due date (IST day) is before today
//   due today    pending and due today (IST)
//   completed    status completed with completedAt inside the date range
//   on time      completed on or before the due date's IST day (no due date → not counted)
//   time taken   completedAt − createdAt (hours)
//   assigned     tasks created inside the date range
//   done %       completed ÷ (completed + pending)
// ============================================================

export interface Actor {
  userId: number;
  role: string;
  companyId: number | null;
}

const PENDING = ["todo", "in_progress", "in_review"];
const MAX_DAYS = 366;
const LIST_LIMIT = 100;

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const ymd = (d: Date | string | null | undefined) => (d ? getISTDateString(new Date(d)) : null);
const nameOf = (u: any) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || `User #${u.id}` : null);

// ── date range ──────────────────────────────────────────────
const istStart = (s: string) => new Date(`${s}T00:00:00.000+05:30`);

export const parseRange = (query: any) => {
  const today = getISTDateString();
  const isYmd = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  let to = isYmd(query.to) ? query.to : today;
  let from: string;
  if (isYmd(query.from)) from = query.from;
  else {
    const days = Math.min(MAX_DAYS, Math.max(1, Number(query.days) || 30));
    const d = istStart(to);
    d.setUTCDate(d.getUTCDate() - (days - 1));
    from = getISTDateString(d);
  }
  if (from > to) throw new ServiceError("from must be on or before to");
  const days = Math.round((istStart(to).getTime() - istStart(from).getTime()) / 86400000) + 1;
  if (days > MAX_DAYS) throw new ServiceError(`The date range can be at most ${MAX_DAYS} days`);
  return { from, to, days, start: istStart(from), endExclusive: new Date(istStart(to).getTime() + 86400000) };
};

type Range = ReturnType<typeof parseRange>;

const daysBetween = (range: Range) => {
  const out: string[] = [];
  for (let t = range.start.getTime(); t < range.endExclusive.getTime(); t += 86400000) out.push(getISTDateString(new Date(t)));
  return out;
};

// ── scope ───────────────────────────────────────────────────
const isCompanyWide = (role: string) => role === "admin" || role === "user" || role === "super_admin";

// The users whose tasks the caller may see on the team view (caller excluded).
const teamMemberIds = async (actor: Actor): Promise<number[]> => {
  if (actor.role === "employee") throw new ServiceError("Only managers and admins can view team task performance", 403);
  if (actor.role === "manager") return getCompanyScopedChildUserIds(actor.userId, actor.companyId);
  if (isCompanyWide(actor.role)) {
    // An admin doesn't see other admins (dropFellowAdmins is a no-op for owner/super_admin).
    return dropFellowAdmins(
      actor.userId,
      await getCompanyScopedOrgWideUserIds(actor.userId, actor.companyId, getCompanyScopedChildUserIdsFast)
    );
  }
  throw new ServiceError("Not allowed", 403);
};

const companyFilter = (actor: Actor) =>
  actor.role !== "super_admin" && actor.companyId ? { companyId: Number(actor.companyId) } : {};

// ── task loading ────────────────────────────────────────────
// Everything one assignee set needs: open tasks now + tasks created or
// completed inside the range.
const loadTasks = async (assigneeIds: number[], actor: Actor, range: Range) => {
  if (!assigneeIds.length) return [];
  return (Task as any).findAll({
    where: {
      ...companyFilter(actor),
      assignedTo: { [Op.in]: assigneeIds },
      status: { [Op.ne]: "cancelled" },
      [Op.or]: [
        { status: { [Op.in]: PENDING } },
        { createdAt: { [Op.gte]: range.start, [Op.lt]: range.endExclusive } },
        { completedAt: { [Op.gte]: range.start, [Op.lt]: range.endExclusive } },
      ],
    },
    attributes: ["id", "title", "description", "status", "priority", "dueDate", "assignedTo", "assignedBy", "createdAt", "completedAt"],
    order: [["dueDate", "ASC"], ["id", "DESC"]],
  });
};

const inRange = (d: any, range: Range) => {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= range.start.getTime() && t < range.endExclusive.getTime();
};

// Per-task facts, computed once.
const describe = (t: any, today: string) => {
  const dueYmd = ymd(t.dueDate);
  const pending = PENDING.includes(t.status);
  const completed = t.status === "completed" && !!t.completedAt;
  const doneYmd = completed ? ymd(t.completedAt) : null;
  return {
    t,
    pending,
    completed,
    overdue: pending && !!dueYmd && dueYmd < today,
    dueToday: pending && dueYmd === today,
    onTime: completed && dueYmd ? (doneYmd as string) <= dueYmd : null,
    hours: completed ? Math.max(0, (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000) : null,
    dueYmd,
  };
};

type Fact = ReturnType<typeof describe>;

const statsOf = (facts: Fact[], range: Range) => {
  const done = facts.filter((f) => f.completed && inRange(f.t.completedAt, range));
  const pending = facts.filter((f) => f.pending);
  const onTime = done.filter((f) => f.onTime === true).length;
  const late = done.filter((f) => f.onTime === false).length;
  const hours = done.map((f) => f.hours as number);
  return {
    assigned: facts.filter((f) => inRange(f.t.createdAt, range)).length,
    completed: done.length,
    completedOnTime: onTime,
    completedLate: late,
    pending: pending.length,
    todo: pending.filter((f) => f.t.status === "todo").length,
    inProgress: pending.filter((f) => f.t.status === "in_progress").length,
    inReview: pending.filter((f) => f.t.status === "in_review").length,
    overdue: pending.filter((f) => f.overdue).length,
    dueToday: pending.filter((f) => f.dueToday).length,
    onTimeRate: pct(onTime, onTime + late),
    completionRate: pct(done.length, done.length + pending.length),
    avgCompletionHours: hours.length ? round1(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
  };
};

const trendOf = (facts: Fact[], range: Range) => {
  const days = daysBetween(range);
  const map = new Map(days.map((d) => [d, { date: d, assigned: 0, completed: 0 }]));
  for (const f of facts) {
    const a = ymd(f.t.createdAt);
    if (a && map.has(a)) map.get(a)!.assigned++;
    if (f.completed) {
      const c = ymd(f.t.completedAt);
      if (c && map.has(c)) map.get(c)!.completed++;
    }
  }
  return days.map((d) => map.get(d)!);
};

const userMap = async (ids: number[]) => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<number, any>();
  const users = await (User as any).findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ["id", "firstName", "lastName", "email", "role", "employeeCode", "status"],
  });
  return new Map<number, any>(users.map((u: any) => [Number(u.id), u]));
};

// Full personal view (lists + KPIs + trend) for one assignee.
const personalView = async (userId: number, actor: Actor, range: Range) => {
  const today = getISTDateString();
  const tasks = await loadTasks([userId], actor, range);
  const facts: Fact[] = tasks.map((t: any) => describe(t, today));
  const users = await userMap([userId, ...tasks.map((t: any) => Number(t.assignedBy))]);
  const me = users.get(userId);

  const pending = facts
    .filter((f) => f.pending)
    .sort((a, b) => (a.dueYmd || "9999").localeCompare(b.dueYmd || "9999"))
    .slice(0, LIST_LIMIT)
    .map((f) => ({
      id: f.t.id,
      title: f.t.title,
      description: f.t.description,
      priority: f.t.priority,
      status: f.t.status,
      dueDate: f.t.dueDate,
      assignedAt: f.t.createdAt,
      assignedBy: f.t.assignedBy ? { id: Number(f.t.assignedBy), name: nameOf(users.get(Number(f.t.assignedBy))) } : null,
      isOverdue: f.overdue,
      isDueToday: f.dueToday,
      daysLeft: f.dueYmd ? Math.round((istStart(f.dueYmd).getTime() - istStart(today).getTime()) / 86400000) : null,
    }));

  const completed = facts
    .filter((f) => f.completed && inRange(f.t.completedAt, range))
    .sort((a, b) => new Date(b.t.completedAt).getTime() - new Date(a.t.completedAt).getTime())
    .slice(0, LIST_LIMIT)
    .map((f) => ({
      id: f.t.id,
      title: f.t.title,
      priority: f.t.priority,
      dueDate: f.t.dueDate,
      assignedAt: f.t.createdAt,
      completedAt: f.t.completedAt,
      timeTakenHours: f.hours == null ? null : round1(f.hours),
      onTime: f.onTime,
      assignedBy: f.t.assignedBy ? { id: Number(f.t.assignedBy), name: nameOf(users.get(Number(f.t.assignedBy))) } : null,
    }));

  return {
    user: me ? { id: Number(me.id), name: nameOf(me), role: me.role, employeeCode: me.employeeCode ?? null } : { id: userId },
    range: { from: range.from, to: range.to, days: range.days },
    summary: statsOf(facts, range),
    pending,
    completed,
    trend: trendOf(facts, range),
  };
};

// ── public ──────────────────────────────────────────────────
export const getMyDashboard = async (actor: Actor, query: any) => {
  if (!actor.userId) throw new ServiceError("Unauthorized request", 401);
  return personalView(actor.userId, actor, parseRange(query));
};

export const getMemberDashboard = async (actor: Actor, memberId: number, query: any) => {
  if (!Number.isInteger(memberId) || memberId <= 0) throw new ServiceError("A valid userId is required");
  if (memberId !== actor.userId) {
    const team = await teamMemberIds(actor);
    if (!team.includes(memberId)) throw new ServiceError("This user is not in your team", 403);
  }
  return personalView(memberId, actor, parseRange(query));
};

export const getTeamDashboard = async (actor: Actor, query: any) => {
  const range = parseRange(query);
  const today = getISTDateString();
  const ids = await teamMemberIds(actor);
  const users = await userMap(ids);
  // Field staff only: managers and employees, active accounts.
  const memberIds = ids.filter((id) => {
    const u = users.get(id);
    return u && (u.role === "manager" || u.role === "employee") && u.status !== "inactive";
  });

  const tasks = await loadTasks(memberIds, actor, range);
  const facts: Fact[] = tasks.map((t: any) => describe(t, today));
  const byUser = new Map<number, Fact[]>();
  for (const f of facts) {
    const k = Number(f.t.assignedTo);
    if (!byUser.has(k)) byUser.set(k, []);
    byUser.get(k)!.push(f);
  }

  const members = memberIds
    .map((id) => {
      const u = users.get(id);
      const s = statsOf(byUser.get(id) || [], range);
      return { userId: id, name: nameOf(u), role: u?.role, employeeCode: u?.employeeCode ?? null, ...s };
    })
    .sort((a, b) => b.completed - a.completed || b.pending - a.pending || String(a.name).localeCompare(String(b.name)));

  const totals = statsOf(facts, range);
  return {
    scope: actor.role === "manager" ? "team" : "company",
    range: { from: range.from, to: range.to, days: range.days },
    totals: { members: members.length, ...totals },
    members,
    trend: trendOf(facts, range),
  };
};
