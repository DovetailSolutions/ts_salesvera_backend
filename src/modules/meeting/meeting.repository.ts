import { Op } from "sequelize";
import { MeetingUser, MeetingCompany, Meeting, User } from "../../config/dbConnection";

// ============================================================
// Meeting repository — backs the new Meetings Dashboard + manager-initiated
// scheduling/reschedule endpoints (modules/meeting). Reads/writes only the
// non-frozen Meeting/MeetingCompany models, plus read-only lookups against
// MeetingUser (the frozen "Client" entity) — never creates/updates a
// MeetingUser row here; that stays exclusively behind the frozen
// createClient endpoint.
// ============================================================

export const findMeetingUserById = (id: number) => MeetingUser.findByPk(id);

// Most recent Meeting on file for a given client, regardless of status —
// used to copy purpose/category onto a new meeting for a repeat client,
// mirroring what the legacy (buggy) assignMeeting flow intended to do.
export const findLatestMeetingForUser = (meetingUserId: number) =>
  Meeting.findOne({
    where: { meetingUserId },
    order: [["createdAt", "DESC"]],
  });

// Mirrors CreateMeeting's existing find-or-create logic (user.ts) for the
// MeetingCompany model (not frozen) — kept as a near-identical copy so
// behavior matches the mobile self-service flow exactly.
export const findOrCreateMeetingCompany = async (
  fields: {
    companyName: string;
    personName: string;
    mobileNumber: string;
    companyEmail?: string | null;
    customerType?: string | null;
  },
  meetingUserId: number | null
) => {
  const { companyName, personName, mobileNumber, companyEmail, customerType } = fields;
  let company = await (MeetingCompany as any).findOne({
    where: { companyName, personName, mobileNumber, companyEmail: companyEmail ?? null },
  });
  if (!company) {
    company = await (MeetingCompany as any).create({
      companyName,
      personName,
      mobileNumber,
      companyEmail,
      customerType,
      meetingUserId,
    });
  }
  return company;
};

export const createMeetingForEmployee = (payload: {
  userId: number;
  meetingUserId: number;
  companyId: number;
  meetingPurpose: string;
  categoryId?: number | null;
  subCategoryId?: number | null;
  scheduledTime: Date;
}) => Meeting.create({ ...payload, status: "scheduled" } as any);

export const findConflictingMeeting = (targetUserId: number, scheduledTime: Date) =>
  Meeting.findOne({ where: { userId: targetUserId, scheduledTime } });

export const findMeetingById = (id: number) => Meeting.findByPk(id);

export const updateMeetingSchedule = (id: number, scheduledTime: Date) =>
  Meeting.update({ scheduledTime } as any, { where: { id } });

// ── Dashboard ──
export const findMeetingsInRange = (employeeIds: number[], fromDate: Date, toDate: Date) =>
  Meeting.findAll({
    where: { userId: { [Op.in]: employeeIds }, scheduledTime: { [Op.between]: [fromDate, toDate] } },
    attributes: ["id", "userId", "status", "scheduledTime", "meetingTimeIn", "meetingTimeOut"],
  });

export const countNewClients = (employeeIds: number[], fromDate: Date, toDate: Date) =>
  (MeetingUser as any).count({
    where: { userId: { [Op.in]: employeeIds }, createdAt: { [Op.between]: [fromDate, toDate] } },
  });

export const findEmployeesByIds = (employeeIds: number[]) =>
  User.findAll({
    where: { id: { [Op.in]: employeeIds } },
    attributes: ["id", "firstName", "lastName", "email"],
  });
