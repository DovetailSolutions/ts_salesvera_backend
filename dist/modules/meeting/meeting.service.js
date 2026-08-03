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
exports.getMeetingDashboard = exports.rescheduleMeeting = exports.scheduleMeeting = exports.resolveClientScope = exports.resolveTeamScope = void 0;
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
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
//     resolved up to their parent admin here.
//   - Client scope ("which clients can I use"): resolved up to the
//     caller's parent admin for a manager, exactly what getMeeting's
//     existing `ll` resolution does — clients (MeetingUser) are a shared
//     pool across every manager under the same admin, by original design.
// ============================================================
const NOT_STARTED_STATUSES = new Set(["scheduled", "pending"]);
const resolveTeamScope = (loggedInId) => __awaiter(void 0, void 0, void 0, function* () {
    const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
    return [loggedInId, ...childIds];
});
exports.resolveTeamScope = resolveTeamScope;
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
const scheduleMeeting = (loggedInId, role, params) => __awaiter(void 0, void 0, void 0, function* () {
    const { targetUserId, meetingUserId, scheduledTime } = params;
    if (!targetUserId || !meetingUserId || !scheduledTime) {
        throw new serviceError_1.ServiceError("targetUserId, meetingUserId and scheduledTime are required");
    }
    const parsedTime = new Date(scheduledTime);
    if (isNaN(parsedTime.getTime()))
        throw new serviceError_1.ServiceError("Invalid scheduledTime");
    const teamScope = yield (0, exports.resolveTeamScope)(loggedInId);
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
const rescheduleMeeting = (loggedInId, role, meetingId, newScheduledTime) => __awaiter(void 0, void 0, void 0, function* () {
    if (!meetingId || !newScheduledTime)
        throw new serviceError_1.ServiceError("meetingId and scheduledTime are required");
    const parsedTime = new Date(newScheduledTime);
    if (isNaN(parsedTime.getTime()))
        throw new serviceError_1.ServiceError("Invalid scheduledTime");
    const meeting = yield MeetingRepo.findMeetingById(meetingId);
    if (!meeting)
        throw new serviceError_1.ServiceError("Meeting not found");
    if (role !== "super_admin") {
        const teamScope = yield (0, exports.resolveTeamScope)(loggedInId);
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
const startOfDay = (d) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
};
const endOfDay = (d) => {
    const x = new Date(d);
    x.setUTCHours(23, 59, 59, 999);
    return x;
};
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const getMeetingDashboard = (loggedInId, role) => __awaiter(void 0, void 0, void 0, function* () {
    // Team scope (not client scope) — a manager's dashboard reflects their
    // own team's activity, not their whole admin's org.
    const allowedIds = yield (0, exports.resolveTeamScope)(loggedInId);
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
    const meetings = (yield MeetingRepo.findMeetingsInRange(allowedIds, queryFrom, queryTo));
    const weekStart = startOfDay(addDays(now, -6));
    const inRange = (t, from, to) => t >= from && t <= to;
    let scheduledToday = 0;
    let scheduledThisWeek = 0;
    let scheduledThisMonth = 0;
    let upcoming = 0;
    const statusBreakdown = { scheduled: 0, pending: 0, in: 0, out: 0, completed: 0, cancelled: 0 };
    const trendByDay = new Map();
    for (let i = 0; i < 14; i++)
        trendByDay.set(startOfDay(addDays(now, -13 + i)).toISOString().slice(0, 10), 0);
    const completedByEmployee = new Map();
    for (const m of meetings) {
        const t = new Date(m.scheduledTime);
        if (isNaN(t.getTime()))
            continue;
        if (inRange(t, monthStart, monthEnd)) {
            scheduledThisMonth += 1;
            if (m.status in statusBreakdown)
                statusBreakdown[m.status] += 1;
            if (m.status === "completed") {
                completedByEmployee.set(m.userId, (completedByEmployee.get(m.userId) || 0) + 1);
            }
        }
        if (inRange(t, today0, today1))
            scheduledToday += 1;
        if (inRange(t, weekStart, today1))
            scheduledThisWeek += 1;
        if (inRange(t, now, upcomingEnd) && m.status !== "cancelled")
            upcoming += 1;
        const dayKey = startOfDay(t).toISOString().slice(0, 10);
        if (trendByDay.has(dayKey))
            trendByDay.set(dayKey, (trendByDay.get(dayKey) || 0) + 1);
    }
    const completionRate = scheduledThisMonth > 0 ? Number(((statusBreakdown.completed / scheduledThisMonth) * 100).toFixed(1)) : null;
    let topPerformer = null;
    if (completedByEmployee.size > 0) {
        const [topUserId, topCount] = [...completedByEmployee.entries()].sort((a, b) => b[1] - a[1])[0];
        const employees = yield MeetingRepo.findEmployeesByIds([topUserId]);
        const emp = employees[0];
        topPerformer = {
            userId: topUserId,
            name: emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email : `#${topUserId}`,
            completed: topCount,
        };
    }
    const newClientsThisMonth = yield MeetingRepo.countNewClients(allowedIds, monthStart, monthEnd);
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
});
exports.getMeetingDashboard = getMeetingDashboard;
