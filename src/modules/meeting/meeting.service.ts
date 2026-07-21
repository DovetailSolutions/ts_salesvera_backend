import { ServiceError } from "../shared/serviceError";
import { getAllChildUserIds, getDirectCreator } from "../shared/userHierarchy";
import * as MeetingRepo from "./meeting.repository";

// ============================================================
// Meeting service — new capabilities layered on top of the existing,
// untouched meeting workflow (CreateMeeting/EndMeeting/getMeeting/
// assignMeeting in admin.ts/user.ts stay exactly as they are):
//   - scheduleMeeting: manager/admin schedules a meeting for a subordinate,
//     for either an existing client (purpose/category copied from their
//     latest visit) or a brand-new client (purpose required explicitly).
//   - rescheduleMeeting: only while the meeting hasn't started yet.
//   - getMeetingDashboard: scheduled-today/week/month + more insights.
//
// Scoping mirrors the existing (non-frozen) getMeeting/assignMeeting
// convention exactly, not the newer tenant-companyId-based scoping used
// elsewhere (e.g. reports.service.ts). Two *different* scopes are needed —
// conflating them was a bug caught during testing (a manager could
// "schedule a meeting for" their own admin):
//   - Team scope ("who can I act on behalf of"): the caller's own
//     descendants only, exactly what assignMeeting's existing
//     `getAllChildUserIds(loggedInId)` check uses. A manager does NOT get
//     resolved up to their parent admin here.
//   - Client scope ("which clients can I use"): resolved up to the
//     caller's parent admin for a manager, exactly what getMeeting's
//     existing `ll` resolution does — clients (MeetingUser) are a shared
//     pool across every manager under the same admin, by original design.
// ============================================================

const NOT_STARTED_STATUSES = new Set(["scheduled", "pending"]);

export const resolveTeamScope = async (loggedInId: number): Promise<number[]> => {
  const childIds = await getAllChildUserIds(loggedInId);
  return [loggedInId, ...childIds];
};

export const resolveClientScope = async (loggedInId: number, role: string | undefined): Promise<number[]> => {
  let ll = loggedInId;
  if (role === "manager") {
    const creator = await getDirectCreator(loggedInId);
    if (creator) ll = creator.id;
  }
  const childIds = await getAllChildUserIds(ll);
  return [ll, ...childIds];
};

export const scheduleMeeting = async (
  loggedInId: number,
  role: string | undefined,
  params: {
    targetUserId: number;
    meetingUserId: number;
    meetingPurpose?: string;
    categoryId?: number | null;
    subCategoryId?: number | null;
    scheduledTime: string;
  }
) => {
  const { targetUserId, meetingUserId, scheduledTime } = params;
  if (!targetUserId || !meetingUserId || !scheduledTime) {
    throw new ServiceError("targetUserId, meetingUserId and scheduledTime are required");
  }
  const parsedTime = new Date(scheduledTime);
  if (isNaN(parsedTime.getTime())) throw new ServiceError("Invalid scheduledTime");

  const teamScope = await resolveTeamScope(loggedInId);
  if (role !== "super_admin" && !teamScope.includes(Number(targetUserId))) {
    throw new ServiceError("You can only schedule meetings for your own team members", 403);
  }

  const meetingUser = await MeetingRepo.findMeetingUserById(meetingUserId);
  if (!meetingUser) throw new ServiceError("Client not found");
  const clientScope = await resolveClientScope(loggedInId, role);
  if (role !== "super_admin" && !clientScope.includes(Number((meetingUser as any).userId))) {
    throw new ServiceError("You can only schedule meetings for your own clients", 403);
  }

  const latest = await MeetingRepo.findLatestMeetingForUser(meetingUserId);
  let meetingPurpose = params.meetingPurpose;
  let categoryId = params.categoryId;
  let subCategoryId = params.subCategoryId;

  if (latest) {
    meetingPurpose = meetingPurpose || (latest as any).meetingPurpose;
    categoryId = categoryId ?? (latest as any).categoryId;
    subCategoryId = subCategoryId ?? (latest as any).subCategoryId;
  } else if (!meetingPurpose) {
    throw new ServiceError("meetingPurpose is required when scheduling a first meeting for a new client");
  }

  const mu = meetingUser as any;
  const companyName = mu.companyName || mu.name;
  const mobileNumber = mu.mobile;
  if (!companyName || !mobileNumber) {
    throw new ServiceError("This client is missing a company name or mobile number required to schedule a meeting");
  }

  const conflict = await MeetingRepo.findConflictingMeeting(targetUserId, parsedTime);
  if (conflict) throw new ServiceError("This employee already has a meeting scheduled at this exact time");

  // Note: MeetingUser.customerType ("Business"/"Individual", free text) and
  // MeetingCompany.customerType ("new"/"existing"/"followup" enum) are
  // different value spaces — never pass one straight into the other.
  // MeetingCompany defaults to "new", which is correct for a first-time
  // site visit regardless of whether the overall client is new or existing.
  const company = await MeetingRepo.findOrCreateMeetingCompany(
    { companyName, personName: mu.name, mobileNumber, companyEmail: mu.email },
    meetingUser.id as number
  );

  return MeetingRepo.createMeetingForEmployee({
    userId: Number(targetUserId),
    meetingUserId: Number(meetingUserId),
    companyId: (company as any).id,
    meetingPurpose: meetingPurpose as string,
    categoryId: categoryId ?? null,
    subCategoryId: subCategoryId ?? null,
    scheduledTime: parsedTime,
  });
};

export const rescheduleMeeting = async (
  loggedInId: number,
  role: string | undefined,
  meetingId: number,
  newScheduledTime: string
) => {
  if (!meetingId || !newScheduledTime) throw new ServiceError("meetingId and scheduledTime are required");
  const parsedTime = new Date(newScheduledTime);
  if (isNaN(parsedTime.getTime())) throw new ServiceError("Invalid scheduledTime");

  const meeting = await MeetingRepo.findMeetingById(meetingId);
  if (!meeting) throw new ServiceError("Meeting not found");

  if (role !== "super_admin") {
    const teamScope = await resolveTeamScope(loggedInId);
    if (!teamScope.includes(Number((meeting as any).userId))) {
      throw new ServiceError("You can only reschedule meetings for your own team members", 403);
    }
  }

  const status = (meeting as any).status;
  if (!NOT_STARTED_STATUSES.has(status)) {
    if (status === "cancelled") throw new ServiceError("This meeting was cancelled and cannot be rescheduled");
    throw new ServiceError("This meeting has already started and can no longer be rescheduled");
  }

  await MeetingRepo.updateMeetingSchedule(meetingId, parsedTime);
  return MeetingRepo.findMeetingById(meetingId);
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export const getMeetingDashboard = async (loggedInId: number, role: string | undefined) => {
  // Team scope (not client scope) — a manager's dashboard reflects their
  // own team's activity, not their whole admin's org.
  const allowedIds = await resolveTeamScope(loggedInId);

  const now = new Date();
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const trendStart = startOfDay(addDays(now, -13));
  const upcomingEnd = endOfDay(addDays(now, 7));

  // Single wide window covering: this month (past+future), the rolling
  // week, the 14-day trend, and the next-7-days upcoming list — regardless
  // of where "today" falls inside the current month.
  const queryFrom = trendStart < monthStart ? trendStart : monthStart;
  const queryTo = upcomingEnd > monthEnd ? upcomingEnd : monthEnd;

  const meetings = (await MeetingRepo.findMeetingsInRange(allowedIds, queryFrom, queryTo)) as any[];

  const weekStart = startOfDay(addDays(now, -6));
  const inRange = (t: Date, from: Date, to: Date) => t >= from && t <= to;

  let scheduledToday = 0;
  let scheduledThisWeek = 0;
  let scheduledThisMonth = 0;
  let upcoming = 0;
  const statusBreakdown: Record<string, number> = { scheduled: 0, pending: 0, in: 0, out: 0, completed: 0, cancelled: 0 };
  const trendByDay = new Map<string, number>();
  for (let i = 0; i < 14; i++) trendByDay.set(startOfDay(addDays(now, -13 + i)).toISOString().slice(0, 10), 0);
  const completedByEmployee = new Map<number, number>();

  for (const m of meetings) {
    const t = new Date(m.scheduledTime);
    if (isNaN(t.getTime())) continue;

    if (inRange(t, monthStart, monthEnd)) {
      scheduledThisMonth += 1;
      if (m.status in statusBreakdown) statusBreakdown[m.status] += 1;
      if (m.status === "completed") {
        completedByEmployee.set(m.userId, (completedByEmployee.get(m.userId) || 0) + 1);
      }
    }
    if (inRange(t, today0, today1)) scheduledToday += 1;
    if (inRange(t, weekStart, today1)) scheduledThisWeek += 1;
    if (inRange(t, now, upcomingEnd) && m.status !== "cancelled") upcoming += 1;

    const dayKey = startOfDay(t).toISOString().slice(0, 10);
    if (trendByDay.has(dayKey)) trendByDay.set(dayKey, (trendByDay.get(dayKey) || 0) + 1);
  }

  const completionRate =
    scheduledThisMonth > 0 ? Number(((statusBreakdown.completed / scheduledThisMonth) * 100).toFixed(1)) : null;

  let topPerformer: { userId: number; name: string; completed: number } | null = null;
  if (completedByEmployee.size > 0) {
    const [topUserId, topCount] = [...completedByEmployee.entries()].sort((a, b) => b[1] - a[1])[0];
    const employees = await MeetingRepo.findEmployeesByIds([topUserId]);
    const emp = employees[0] as any;
    topPerformer = {
      userId: topUserId,
      name: emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email : `#${topUserId}`,
      completed: topCount,
    };
  }

  const newClientsThisMonth = await MeetingRepo.countNewClients(allowedIds, monthStart, monthEnd);

  return {
    scheduledToday,
    scheduledThisWeek,
    scheduledThisMonth,
    upcoming,
    completionRate,
    statusBreakdown,
    trend: [...trendByDay.entries()].map(([date, count]) => ({ date, count })),
    topPerformer,
    newClientsThisMonth,
  };
};
