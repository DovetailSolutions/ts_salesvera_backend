"use strict";
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
exports.findMeetingsByScopePaginated = exports.findEmployeesByIds = exports.countAllMeetings = exports.countNewClients = exports.findMeetingsInRange = exports.updateMeetingSchedule = exports.findMeetingById = exports.findConflictingMeeting = exports.createMeetingForEmployee = exports.findOrCreateMeetingCompany = exports.findLatestMeetingForUser = exports.findMeetingUserById = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
// ============================================================
// Meeting repository — backs the new Meetings Dashboard + manager-initiated
// scheduling/reschedule endpoints (modules/meeting). Reads/writes only the
// non-frozen Meeting/MeetingCompany models, plus read-only lookups against
// MeetingUser (the frozen "Client" entity) — never creates/updates a
// MeetingUser row here; that stays exclusively behind the frozen
// createClient endpoint.
// ============================================================
const findMeetingUserById = (id) => dbConnection_1.MeetingUser.findByPk(id);
exports.findMeetingUserById = findMeetingUserById;
// Most recent Meeting on file for a given client, regardless of status —
// used to copy purpose/category onto a new meeting for a repeat client,
// mirroring what the legacy (buggy) assignMeeting flow intended to do.
const findLatestMeetingForUser = (meetingUserId) => dbConnection_1.Meeting.findOne({
    where: { meetingUserId },
    order: [["createdAt", "DESC"]],
});
exports.findLatestMeetingForUser = findLatestMeetingForUser;
// Mirrors CreateMeeting's existing find-or-create logic (user.ts) for the
// MeetingCompany model (not frozen) — kept as a near-identical copy so
// behavior matches the mobile self-service flow exactly.
const findOrCreateMeetingCompany = (fields, meetingUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const { companyName, personName, mobileNumber, companyEmail, customerType } = fields;
    let company = yield dbConnection_1.MeetingCompany.findOne({
        where: { companyName, personName, mobileNumber, companyEmail: companyEmail !== null && companyEmail !== void 0 ? companyEmail : null },
    });
    if (!company) {
        company = yield dbConnection_1.MeetingCompany.create({
            companyName,
            personName,
            mobileNumber,
            companyEmail,
            customerType,
            meetingUserId,
        });
    }
    return company;
});
exports.findOrCreateMeetingCompany = findOrCreateMeetingCompany;
const createMeetingForEmployee = (payload) => dbConnection_1.Meeting.create(Object.assign(Object.assign({}, payload), { status: "scheduled" }));
exports.createMeetingForEmployee = createMeetingForEmployee;
const findConflictingMeeting = (targetUserId, scheduledTime) => dbConnection_1.Meeting.findOne({ where: { userId: targetUserId, scheduledTime } });
exports.findConflictingMeeting = findConflictingMeeting;
const findMeetingById = (id) => dbConnection_1.Meeting.findByPk(id);
exports.findMeetingById = findMeetingById;
const updateMeetingSchedule = (id, scheduledTime) => dbConnection_1.Meeting.update({ scheduledTime }, { where: { id } });
exports.updateMeetingSchedule = updateMeetingSchedule;
// ── Dashboard ──
const findMeetingsInRange = (employeeIds, fromDate, toDate) => dbConnection_1.Meeting.findAll({
    where: { userId: { [sequelize_1.Op.in]: employeeIds }, scheduledTime: { [sequelize_1.Op.between]: [fromDate, toDate] } },
    attributes: ["id", "userId", "status", "scheduledTime", "meetingTimeIn", "meetingTimeOut"],
});
exports.findMeetingsInRange = findMeetingsInRange;
const countNewClients = (employeeIds, fromDate, toDate) => dbConnection_1.MeetingUser.count({
    where: { userId: { [sequelize_1.Op.in]: employeeIds }, createdAt: { [sequelize_1.Op.between]: [fromDate, toDate] } },
});
exports.countNewClients = countNewClients;
// All-time count, not windowed to any date range — the dashboard's other
// numbers are all today/week/month, so there was previously no single
// figure that just answered "how many meetings total" for the caller's
// resolved scope (a manager's own team, or the whole company for admin).
const countAllMeetings = (employeeIds) => dbConnection_1.Meeting.count({ where: { userId: { [sequelize_1.Op.in]: employeeIds } } });
exports.countAllMeetings = countAllMeetings;
const findEmployeesByIds = (employeeIds) => dbConnection_1.User.findAll({
    where: { id: { [sequelize_1.Op.in]: employeeIds } },
    attributes: ["id", "firstName", "lastName", "email"],
});
exports.findEmployeesByIds = findEmployeesByIds;
// ── Dashboard drill-down (click a stat tile -> list the meetings behind it) ──
const findMeetingsByScopePaginated = (employeeIds, range, limit, offset) => {
    const where = { userId: { [sequelize_1.Op.in]: employeeIds } };
    if (range) {
        where.scheduledTime = { [sequelize_1.Op.between]: [range.from, range.to] };
    }
    return dbConnection_1.Meeting.findAndCountAll({
        where,
        limit,
        offset,
        order: [["scheduledTime", "DESC"]],
        include: [
            { model: dbConnection_1.User, attributes: ["id", "firstName", "lastName", "email"] },
            { model: dbConnection_1.MeetingUser, attributes: ["id", "name", "companyName", "mobile", "email", "city", "state"] },
            {
                model: dbConnection_1.MeetingCompany,
                attributes: ["id", "companyName", "personName", "mobileNumber", "companyEmail", "customerType"],
            },
        ],
        distinct: true,
    });
};
exports.findMeetingsByScopePaginated = findMeetingsByScopePaginated;
