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
exports.getNewClientsDetails = exports.getMeetingDashboardDetails = exports.getMeetingDashboard = exports.rescheduleMeeting = exports.scheduleMeeting = exports.resolveClientScope = exports.resolveTeamScope = void 0;
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
const dateUtils_1 = require("../shared/dateUtils");
const MeetingRepo = __importStar(require("./meeting.repository"));
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
//     resolved up to their parent admin here. The descendants are further
//     narrowed to the company the caller's token is currently acting in —
//     a manager/admin can be assigned to more than one company, and the
//     raw who-created-whom walk has no notion of company, so without that
//     they kept acting on the other company's employees after switching.
//   - Client scope ("which clients can I use"): resolved up to the
//     caller's parent admin for a manager, exactly what getMeeting's
//     existing `ll` resolution does — clients (MeetingUser) are a shared
//     pool across every manager under the same admin, by original design.
// ============================================================
const NOT_STARTED_STATUSES = new Set(["scheduled", "pending"]);
const resolveTeamScope = (loggedInId, callerCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getCompanyScopedChildUserIds)(loggedInId, callerCompanyId);
    return [loggedInId, ...childIds];
});
exports.resolveTeamScope = resolveTeamScope;
// Client scope stays on the *unscoped* hierarchy on purpose: it is anchored
// on a DIFFERENT user (a manager is resolved up to their parent admin) and
// answers "which clients may I use", a pool deliberately shared across every
// manager under the same admin. Company-filtering that pool would change
// that shared-pool semantics rather than fix a scoping bug, so it is left
// exactly as the existing getMeeting/assignMeeting convention has it.
const resolveClientScope = (loggedInId, role) => __awaiter(void 0, void 0, void 0, function* () {
    let ll = loggedInId;
    if (role === "manager") {
        const creator = yield (0, userHierarchy_1.getDirectCreator)(loggedInId);
        if (creator)
            ll = creator.id;
    }
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(ll);
    return [ll, ...childIds];
});
exports.resolveClientScope = resolveClientScope;
const scheduleMeeting = (loggedInId, role, callerCompanyId, params) => __awaiter(void 0, void 0, void 0, function* () {
    const { targetUserId, meetingUserId, scheduledTime } = params;
    if (!targetUserId || !meetingUserId || !scheduledTime) {
        throw new serviceError_1.ServiceError("targetUserId, meetingUserId and scheduledTime are required");
    }
    const parsedTime = new Date(scheduledTime);
    if (isNaN(parsedTime.getTime()))
        throw new serviceError_1.ServiceError("Invalid scheduledTime");
    const teamScope = yield (0, exports.resolveTeamScope)(loggedInId, callerCompanyId);
    if (role !== "super_admin" && !teamScope.includes(Number(targetUserId))) {
        throw new serviceError_1.ServiceError("You can only schedule meetings for your own team members", 403);
    }
    const meetingUser = yield MeetingRepo.findMeetingUserById(meetingUserId);
    if (!meetingUser)
        throw new serviceError_1.ServiceError("Client not found");
    const clientScope = yield (0, exports.resolveClientScope)(loggedInId, role);
    if (role !== "super_admin" && !clientScope.includes(Number(meetingUser.userId))) {
        throw new serviceError_1.ServiceError("You can only schedule meetings for your own clients", 403);
    }
    const latest = yield MeetingRepo.findLatestMeetingForUser(meetingUserId);
    let meetingPurpose = params.meetingPurpose;
    let categoryId = params.categoryId;
    let subCategoryId = params.subCategoryId;
    if (latest) {
        meetingPurpose = meetingPurpose || latest.meetingPurpose;
        categoryId = categoryId !== null && categoryId !== void 0 ? categoryId : latest.categoryId;
        subCategoryId = subCategoryId !== null && subCategoryId !== void 0 ? subCategoryId : latest.subCategoryId;
    }
    else if (!meetingPurpose) {
        throw new serviceError_1.ServiceError("meetingPurpose is required when scheduling a first meeting for a new client");
    }
    const mu = meetingUser;
    const companyName = mu.companyName || mu.name;
    const mobileNumber = mu.mobile;
    if (!companyName || !mobileNumber) {
        throw new serviceError_1.ServiceError("This client is missing a company name or mobile number required to schedule a meeting");
    }
    const conflict = yield MeetingRepo.findConflictingMeeting(targetUserId, parsedTime);
    if (conflict)
        throw new serviceError_1.ServiceError("This employee already has a meeting scheduled at this exact time");
    // Note: MeetingUser.customerType ("Business"/"Individual", free text) and
    // MeetingCompany.customerType ("new"/"existing"/"followup" enum) are
    // different value spaces — never pass one straight into the other.
    // MeetingCompany defaults to "new", which is correct for a first-time
    // site visit regardless of whether the overall client is new or existing.
    const company = yield MeetingRepo.findOrCreateMeetingCompany({ companyName, personName: mu.name, mobileNumber, companyEmail: mu.email }, meetingUser.id);
    return MeetingRepo.createMeetingForEmployee({
        userId: Number(targetUserId),
        meetingUserId: Number(meetingUserId),
        companyId: company.id,
        meetingPurpose: meetingPurpose,
        categoryId: categoryId !== null && categoryId !== void 0 ? categoryId : null,
        subCategoryId: subCategoryId !== null && subCategoryId !== void 0 ? subCategoryId : null,
        scheduledTime: parsedTime,
    });
});
exports.scheduleMeeting = scheduleMeeting;
const rescheduleMeeting = (loggedInId, role, callerCompanyId, meetingId, newScheduledTime) => __awaiter(void 0, void 0, void 0, function* () {
    if (!meetingId || !newScheduledTime)
        throw new serviceError_1.ServiceError("meetingId and scheduledTime are required");
    const parsedTime = new Date(newScheduledTime);
    if (isNaN(parsedTime.getTime()))
        throw new serviceError_1.ServiceError("Invalid scheduledTime");
    const meeting = yield MeetingRepo.findMeetingById(meetingId);
    if (!meeting)
        throw new serviceError_1.ServiceError("Meeting not found");
    if (role !== "super_admin") {
        const teamScope = yield (0, exports.resolveTeamScope)(loggedInId, callerCompanyId);
        if (!teamScope.includes(Number(meeting.userId))) {
            throw new serviceError_1.ServiceError("You can only reschedule meetings for your own team members", 403);
        }
    }
    const status = meeting.status;
    if (!NOT_STARTED_STATUSES.has(status)) {
        if (status === "cancelled")
            throw new serviceError_1.ServiceError("This meeting was cancelled and cannot be rescheduled");
        throw new serviceError_1.ServiceError("This meeting has already started and can no longer be rescheduled");
    }
    yield MeetingRepo.updateMeetingSchedule(meetingId, parsedTime);
    return MeetingRepo.findMeetingById(meetingId);
});
exports.rescheduleMeeting = rescheduleMeeting;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// FIX: these used to call setUTCHours() directly on the given Date, i.e.
// UTC calendar-day boundaries. IST is a fixed UTC+5:30 offset (no DST), so
// a meeting at, say, 8 PM IST already falls on the next UTC day, and one
// before 5:30 AM IST still falls on the previous UTC day — both got bucketed
// into the wrong day by the today/this-week/month/14-day-trend windows
// below. Shifting by the fixed IST offset before truncating to a day (and
// shifting back after) anchors the boundary to the IST calendar day a
// manager/admin actually experiences, matching getISTDateString() in
// shared/dateUtils.ts.
const startOfDay = (d) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    ist.setUTCHours(0, 0, 0, 0);
    return new Date(ist.getTime() - IST_OFFSET_MS);
};
const endOfDay = (d) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    ist.setUTCHours(23, 59, 59, 999);
    return new Date(ist.getTime() - IST_OFFSET_MS);
};
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
// FIX: "This Week" was `[startOfDay(now - 6 days), endOfDay(now)]` — a
// trailing "last 7 days" window, not the current calendar week. That made it
// asymmetric with "This Month" (which already covers the whole calendar
// month, past AND future): a meeting scheduled a couple of days from now,
// but still inside the current Mon–Sun week, counted toward "This Month"
// while silently missing from "This Week" because the window never looked
// past today. Monday-start calendar week in IST, mirroring the same
// "Monday-start week containing now" convention already used for the
// meeting-trend/dashboard-summary range endpoint (user.ts's getSummaryTrend).
const getISTWeekRange = (now) => {
    const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
    const mondayOffset = (nowIST.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
    const weekStartIST = new Date(nowIST);
    weekStartIST.setUTCDate(nowIST.getUTCDate() - mondayOffset);
    weekStartIST.setUTCHours(0, 0, 0, 0);
    const from = new Date(weekStartIST.getTime() - IST_OFFSET_MS);
    const weekEndIST = new Date(weekStartIST);
    weekEndIST.setUTCDate(weekStartIST.getUTCDate() + 6);
    weekEndIST.setUTCHours(23, 59, 59, 999);
    const to = new Date(weekEndIST.getTime() - IST_OFFSET_MS);
    return { from, to };
};
const getMeetingDashboard = (loggedInId, role, callerCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    // FIX: this dashboard's visibility scope was reusing resolveTeamScope,
    // which answers a DIFFERENT question — "who can I act on behalf of"
    // (scheduleMeeting/rescheduleMeeting's authorization check) — and only
    // ever returns the caller's OWN creator-subtree. That's correct for a
    // manager's dashboard (their own team's activity, nothing more), but
    // wrong for admin: an admin's dashboard should reflect the WHOLE
    // company's meetings regardless of which manager a salesperson happens
    // to report to, including managers/salespersons the admin didn't
    // personally create (a second admin added via the CompanyAdmin junction,
    // staff created by the tenant owner, anyone reassigned after creation) —
    // resolveTeamScope silently dropped all of those from the admin's own
    // dashboard. Manager keeps the narrow, correct team scope; every other
    // role that can reach this endpoint (admin, super_admin, "user") gets the
    // whole company instead.
    const allowedIds = role === "manager"
        ? yield (0, exports.resolveTeamScope)(loggedInId, callerCompanyId)
        : yield (0, userHierarchy_1.getCompanyScopedOrgWideUserIds)(loggedInId, callerCompanyId);
    const now = new Date();
    const today0 = startOfDay(now);
    const today1 = endOfDay(now);
    // FIX: was `new Date(now.getFullYear(), now.getMonth(), 1)` — those
    // getters read the Node process's OS-local calendar date, which only
    // resolves to IST if the server's OS timezone happens to be set to
    // Asia/Kolkata (true on this dev machine, not guaranteed on the
    // production droplet). Deriving the IST year/month via the same +5:30
    // offset arithmetic keeps "this month" correct regardless of server OS
    // timezone, notably right around a month boundary in the early IST
    // morning (e.g. 00:15 IST on the 1st is still the last UTC day of the
    // previous month).
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const istYear = istNow.getUTCFullYear();
    const istMonth = istNow.getUTCMonth();
    const monthStart = new Date(Date.UTC(istYear, istMonth, 1) - IST_OFFSET_MS);
    const monthEnd = new Date(Date.UTC(istYear, istMonth + 1, 0, 23, 59, 59, 999) - IST_OFFSET_MS);
    const trendStart = startOfDay(addDays(now, -13));
    const upcomingEnd = endOfDay(addDays(now, 7));
    const { from: weekStart, to: weekEnd } = getISTWeekRange(now);
    // Single wide window covering: this month (past+future), the current
    // calendar week (past+future — can spill a few days into the adjacent
    // month near a month boundary), the 14-day trend, and the next-7-days
    // upcoming list — regardless of where "today" falls inside the current
    // month/week.
    const queryFrom = [trendStart, monthStart, weekStart].reduce((a, b) => (b < a ? b : a));
    const queryTo = [upcomingEnd, monthEnd, weekEnd].reduce((a, b) => (b > a ? b : a));
    const meetings = (yield MeetingRepo.findMeetingsInRange(allowedIds, queryFrom, queryTo));
    const inRange = (t, from, to) => t >= from && t <= to;
    let scheduledToday = 0;
    let scheduledThisWeek = 0;
    let scheduledThisMonth = 0;
    let upcoming = 0;
    const statusBreakdown = { scheduled: 0, pending: 0, in: 0, out: 0, completed: 0, cancelled: 0 };
    const trendByDay = new Map();
    // FIX: was `startOfDay(...).toISOString().slice(0, 10)` — startOfDay now
    // returns the UTC instant of IST midnight (e.g. 18:30 UTC the previous
    // day), so re-slicing that through toISOString() reports the UTC day,
    // one calendar day off from the IST trend-bucket key it's meant to be.
    // getISTDateString() derives the IST y-m-d string directly instead.
    for (let i = 0; i < 14; i++)
        trendByDay.set((0, dateUtils_1.getISTDateString)(addDays(now, -13 + i)), 0);
    const completedByEmployeeMonth = new Map();
    const completedByEmployeeWeek = new Map();
    for (const m of meetings) {
        const t = new Date(m.scheduledTime);
        if (isNaN(t.getTime()))
            continue;
        if (inRange(t, monthStart, monthEnd)) {
            scheduledThisMonth += 1;
            if (m.status in statusBreakdown)
                statusBreakdown[m.status] += 1;
            if (m.status === "completed") {
                completedByEmployeeMonth.set(m.userId, (completedByEmployeeMonth.get(m.userId) || 0) + 1);
            }
        }
        if (inRange(t, today0, today1))
            scheduledToday += 1;
        if (inRange(t, weekStart, weekEnd)) {
            scheduledThisWeek += 1;
            if (m.status === "completed") {
                completedByEmployeeWeek.set(m.userId, (completedByEmployeeWeek.get(m.userId) || 0) + 1);
            }
        }
        if (inRange(t, now, upcomingEnd) && m.status !== "cancelled")
            upcoming += 1;
        // FIX: was `startOfDay(t).toISOString().slice(0, 10)` — same UTC
        // re-slicing issue as the trendByDay initialization above; a meeting at
        // 8 PM IST landed one bucket early (or one bucket late for meetings
        // before 5:30 AM IST) once startOfDay itself became IST-aware.
        const dayKey = (0, dateUtils_1.getISTDateString)(t);
        if (trendByDay.has(dayKey))
            trendByDay.set(dayKey, (trendByDay.get(dayKey) || 0) + 1);
    }
    const completionRate = scheduledThisMonth > 0 ? Number(((statusBreakdown.completed / scheduledThisMonth) * 100).toFixed(1)) : null;
    // Both periods' winners can differ (and often need distinct employee
    // lookups), so resolve their employee info in a single batched call rather
    // than one query per period.
    const topEntryMonth = completedByEmployeeMonth.size > 0
        ? [...completedByEmployeeMonth.entries()].sort((a, b) => b[1] - a[1])[0]
        : null;
    const topEntryWeek = completedByEmployeeWeek.size > 0
        ? [...completedByEmployeeWeek.entries()].sort((a, b) => b[1] - a[1])[0]
        : null;
    const topUserIds = [...new Set([topEntryMonth === null || topEntryMonth === void 0 ? void 0 : topEntryMonth[0], topEntryWeek === null || topEntryWeek === void 0 ? void 0 : topEntryWeek[0]].filter((id) => id != null))];
    const topEmployees = topUserIds.length > 0 ? yield MeetingRepo.findEmployeesByIds(topUserIds) : [];
    const employeeById = new Map(topEmployees.map((e) => [e.id, e]));
    const buildTopPerformer = (entry) => {
        var _a, _b, _c;
        if (!entry)
            return null;
        const [topUserId, topCount] = entry;
        const emp = employeeById.get(topUserId);
        return {
            userId: topUserId,
            name: emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email : `#${topUserId}`,
            email: (_a = emp === null || emp === void 0 ? void 0 : emp.email) !== null && _a !== void 0 ? _a : null,
            phone: (_b = emp === null || emp === void 0 ? void 0 : emp.phone) !== null && _b !== void 0 ? _b : null,
            role: (_c = emp === null || emp === void 0 ? void 0 : emp.role) !== null && _c !== void 0 ? _c : null,
            completed: topCount,
        };
    };
    const topPerformerMonth = buildTopPerformer(topEntryMonth);
    const topPerformerWeek = buildTopPerformer(topEntryWeek);
    const newClientsThisMonth = yield MeetingRepo.countNewClients(allowedIds, monthStart, monthEnd);
    // The plain "how many meetings does my scope actually have" figure — every
    // other number here is windowed (today/week/month), so this was the one
    // thing missing that a manager or admin would look for first.
    const totalMeetings = yield MeetingRepo.countAllMeetings(allowedIds);
    return {
        totalMeetings,
        scheduledToday,
        scheduledThisWeek,
        scheduledThisMonth,
        upcoming,
        completionRate,
        statusBreakdown,
        trend: [...trendByDay.entries()].map(([date, count]) => ({ date, count })),
        // `topPerformer` kept as an alias for the monthly winner — back-compat
        // for the frontend's existing (pre-week/month-toggle) consumer.
        topPerformer: topPerformerMonth,
        topPerformerMonth,
        topPerformerWeek,
        newClientsThisMonth,
    };
});
exports.getMeetingDashboard = getMeetingDashboard;
const DASHBOARD_DETAIL_TYPES = new Set(["total", "today", "week", "month", "upcoming"]);
// Backs the meeting-management dashboard's stat tiles (Total Meeting /
// Scheduled Today / Scheduled This Week / Scheduled This Month / Upcoming
// (7 days)) — clicking a tile lists the actual meetings (with employee +
// client info) behind that tile's count. Scope resolution and date-window
// math are identical to getMeetingDashboard above, so a tile's count and its
// drill-down list always agree.
const getMeetingDashboardDetails = (loggedInId, role, callerCompanyId, type, page, limit, 
// Narrows the list to one specific employee within the caller's scope —
// backs the Top Performer tile's click-through ("show me everything this
// person did"), reusing the same scoped/paginated list this endpoint
// already builds for the today/week/month/total/upcoming tiles.
userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!DASHBOARD_DETAIL_TYPES.has(type)) {
        throw new serviceError_1.ServiceError("type must be one of: total, today, week, month, upcoming");
    }
    const allowedIds = role === "manager"
        ? yield (0, exports.resolveTeamScope)(loggedInId, callerCompanyId)
        : yield (0, userHierarchy_1.getCompanyScopedOrgWideUserIds)(loggedInId, callerCompanyId);
    let scopeIds = allowedIds;
    if (userId != null) {
        if (!allowedIds.includes(userId)) {
            throw new serviceError_1.ServiceError("You do not have access to this user's meetings", 403);
        }
        scopeIds = [userId];
    }
    const now = new Date();
    let range = null;
    if (type === "today") {
        range = { from: startOfDay(now), to: endOfDay(now) };
    }
    else if (type === "week") {
        range = getISTWeekRange(now);
    }
    else if (type === "month") {
        const istNow = new Date(now.getTime() + IST_OFFSET_MS);
        const istYear = istNow.getUTCFullYear();
        const istMonth = istNow.getUTCMonth();
        range = {
            from: new Date(Date.UTC(istYear, istMonth, 1) - IST_OFFSET_MS),
            to: new Date(Date.UTC(istYear, istMonth + 1, 0, 23, 59, 59, 999) - IST_OFFSET_MS),
        };
    }
    else if (type === "upcoming") {
        // Matches getMeetingDashboard's `upcoming` figure exactly: from "right
        // now" (not start-of-day) through 7 days out, cancelled meetings excluded.
        range = { from: now, to: endOfDay(addDays(now, 7)) };
    }
    // type === "total" -> range stays null (all-time, matches countAllMeetings)
    const offset = (page - 1) * limit;
    const { rows, count } = yield MeetingRepo.findMeetingsByScopePaginated(scopeIds, range, limit, offset, type === "upcoming");
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
exports.getMeetingDashboardDetails = getMeetingDashboardDetails;
// Backs the "New Clients This Month" dashboard tile's click-through — same
// scope + this-month window as countNewClients (used by getMeetingDashboard
// above), so the tile's count and this list always agree.
const getNewClientsDetails = (loggedInId, role, callerCompanyId, page, limit) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedIds = role === "manager"
        ? yield (0, exports.resolveTeamScope)(loggedInId, callerCompanyId)
        : yield (0, userHierarchy_1.getCompanyScopedOrgWideUserIds)(loggedInId, callerCompanyId);
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const istYear = istNow.getUTCFullYear();
    const istMonth = istNow.getUTCMonth();
    const monthStart = new Date(Date.UTC(istYear, istMonth, 1) - IST_OFFSET_MS);
    const monthEnd = new Date(Date.UTC(istYear, istMonth + 1, 0, 23, 59, 59, 999) - IST_OFFSET_MS);
    const offset = (page - 1) * limit;
    const { rows, count } = yield MeetingRepo.findNewClientsPaginated(allowedIds, monthStart, monthEnd, limit, offset);
    // Client rows only carry the owning salesperson's raw userId — resolve
    // names for whichever employees actually appear on this page in one
    // batched call, same approach as the Top Performer lookup above.
    const ownerIds = [...new Set(rows.map((r) => r.userId).filter((id) => id != null))];
    const owners = ownerIds.length > 0 ? yield MeetingRepo.findEmployeesByIds(ownerIds) : [];
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const data = rows.map((r) => {
        const plain = typeof r.get === "function" ? r.get({ plain: true }) : r;
        const owner = ownerById.get(plain.userId);
        return Object.assign(Object.assign({}, plain), { ownerName: owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email : null });
    });
    return {
        data,
        pagination: {
            totalRecords: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
        },
    };
});
exports.getNewClientsDetails = getNewClientsDetails;
