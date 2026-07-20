import { Op } from "sequelize";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import * as XLSX from "xlsx";
import { ServiceError } from "../shared/serviceError";
import { getAllChildUserIds } from "../shared/userHierarchy";
import * as AttendanceRepo from "./attendance.repository";

// ============================================================
// Attendance service — validation + orchestration. Byte-for-byte port of the
// previous getAttendance/markAttendancePresent/bulkMarkAttendance/
// userAttendance/AttendanceBook (admin.ts) and AttendancePunchIn/
// AttendancePunchOut/getDayTypeFromWorkingHours/getTodayAttendance/
// AttendanceList (user.ts) controller bodies.
// ============================================================

interface MulterS3File extends Express.Multer.File {
  bucket: string;
  key: string;
  location?: string;
  etag?: string;
}

const getPagination = (query: any) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// ---- Admin/team-scoped ----

export const getAttendance = async (loggedInId: number, query: any) => {
  const { page, limit, offset } = getPagination(query);
  const childIds = await getAllChildUserIds(loggedInId);
  const allUserIds = [loggedInId, ...childIds];
  const todayDateOnly = new Date().toISOString().slice(0, 10);

  const { rows, count } = await AttendanceRepo.findTeamAttendanceToday({
    allUserIds,
    excludeUserId: loggedInId,
    todayDateOnly,
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      limit,
    },
  };
};

const LEAVE_STATUSES = ["leave", "leaveApproved", "leaveReject"];

// The single "Mark Attendance" action's outcome vocabulary — deliberately a
// small fixed set of machine-friendly values (not bulk's free-text CSV
// words) since this is driven by a UI dropdown, not a spreadsheet cell.
// "leave" always requires a companyLeaveId (which specific configured type).
const MARK_ATTENDANCE_STATUSES = ["present", "half_day", "absent", "leave"] as const;
type MarkAttendanceStatus = (typeof MARK_ATTENDANCE_STATUSES)[number];

// Statuses that mean "showed up" — only these are gated by the shift-start
// window and only these get shift-derived punch data at all.
const SHOWED_UP_STATUSES: MarkAttendanceStatus[] = ["present", "half_day"];

export const markAttendancePresent = async (loggedInId: number, callerCompanyId: number | null, body: any) => {
  const { employeeId, date, punchIn, companyLeaveId } = body || {};
  const status: MarkAttendanceStatus = MARK_ATTENDANCE_STATUSES.includes(body?.status) ? body.status : "present";

  if (!employeeId) throw new ServiceError("employeeId is required");
  if (status === "leave" && !companyLeaveId) {
    throw new ServiceError("companyLeaveId is required when marking a specific leave type");
  }

  // Team members only — covers any sale_person/manager (or deeper) under this admin/manager.
  const childIds = await getAllChildUserIds(loggedInId);
  if (!childIds.includes(Number(employeeId))) {
    throw new ServiceError("You can only mark attendance for your own team members");
  }

  let leaveTypeRow: any = null;
  if (status === "leave") {
    if (!callerCompanyId) throw new ServiceError("No company context — cannot resolve this company's leave types");
    leaveTypeRow = await AttendanceRepo.findCompanyLeaveById(Number(companyLeaveId), callerCompanyId);
    if (!leaveTypeRow) throw new ServiceError("companyLeaveId is not a leave type configured for your company");
  }

  const attendanceDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const employee = (await AttendanceRepo.findEmployeeById(Number(employeeId))) as any;
  const shift = employee?.shiftId ? await AttendanceRepo.findShiftById(employee.shiftId) : null;
  const company = shift?.companyId ? await AttendanceRepo.findCompanyById(shift.companyId) : null;

  // Shift-start gate — only meaningful for a "showed up" outcome on
  // "today": marking someone present/half-day for a past date is a
  // correction, not a real-time attendance event, and absent/leave never
  // involve showing up at all. Skipped entirely if the employee has no
  // assigned shift.
  const todayDateOnly = new Date().toISOString().slice(0, 10);
  if (SHOWED_UP_STATUSES.includes(status) && attendanceDate === todayDateOnly && isBeforeShiftWindow(shift as any, attendanceDate)) {
    throw new ServiceError(formatShiftWindowMessage(shift as any, attendanceDate, employee?.firstName));
  }

  const fields = buildMarkAttendanceFields(status, shift as any, company as any, attendanceDate, punchIn, leaveTypeRow);

  const existing = await AttendanceRepo.findAttendanceForDate(employeeId, attendanceDate);

  if (existing) {
    // Already on a leave-type status — don't let a routine correction
    // silently clobber it unless the admin is deliberately re-marking it as
    // a (possibly different) leave outcome. Anything else (present/half-day/
    // absent) must go through cancelling the leave first.
    if (LEAVE_STATUSES.includes(existing.status) && status !== "leave") {
      throw new ServiceError(
        `This employee is marked "${existing.status}" on ${attendanceDate}. Reject/cancel the leave first before marking ${status.replace("_", " ")}.`
      );
    }
    existing.status = fields.status as any;
    existing.companyLeaveId = fields.companyLeaveId;
    // Never overwrite a real punch already on the record (e.g. the employee
    // already self-punched-in for real) — only fill in shift-derived times
    // when there's nothing there yet. Non-"showed up" outcomes (absent/
    // leave) always clear punch data — the day didn't happen that way.
    if (SHOWED_UP_STATUSES.includes(status) && existing.punch_in) {
      // keep the existing real punch as-is
    } else {
      existing.punch_in = fields.punchIn;
      existing.punch_out = fields.punchOut;
      existing.working_hours = fields.workingHours;
      existing.dayType = fields.dayType;
      existing.overtime = fields.overtime;
    }
    await existing.save();
    return existing;
  }

  return AttendanceRepo.createAttendanceRecord({
    employee_id: employeeId,
    date: attendanceDate,
    punch_in: fields.punchIn,
    punch_out: fields.punchOut,
    working_hours: fields.workingHours,
    dayType: fields.dayType,
    overtime: fields.overtime,
    status: fields.status,
    companyLeaveId: fields.companyLeaveId,
  } as any);
};

// Builds the Attendance fields for each of the single-mark outcomes:
// - present: shift-derived full day (unchanged from before this status
//   picker existed) — falls back to the caller-supplied/now punch-in with
//   no punch-out when the employee has no assigned shift at all.
// - half_day: shift-derived, but only half the shift's normal working
//   hours — a genuine partial-attendance record (punch data + working_hours),
//   not a zero-hours leave-like entry.
// - absent / leave: no punch data at all — the day didn't involve showing up.
const buildMarkAttendanceFields = (
  status: MarkAttendanceStatus,
  shift: { startTime?: string; endTime?: string; fullDayHours?: number | null; halfDayAfter?: number | null; workingHours?: number | null; companyId?: number } | null,
  company: { autoHalfDayAfter?: number | null; overtimeAllowed?: boolean | null } | null,
  attendanceDate: string,
  punchIn: any,
  leaveTypeRow: any
): {
  status: string;
  companyLeaveId: number | null;
  punchIn: Date | null;
  punchOut: Date | null;
  workingHours: number | null;
  dayType: "full_day" | "half_day" | "short_leave" | null;
  overtime: number | null;
} => {
  if (status === "absent") {
    return { status: "absent", companyLeaveId: null, punchIn: null, punchOut: null, workingHours: null, dayType: null, overtime: null };
  }

  if (status === "leave") {
    return { status: "leaveApproved", companyLeaveId: leaveTypeRow.id, punchIn: null, punchOut: null, workingHours: null, dayType: null, overtime: null };
  }

  if (status === "half_day") {
    const start = shift?.startTime ? shiftStartInstant(shift, attendanceDate) : null;
    const officeHours = shift?.workingHours && shift.workingHours > 0 ? shift.workingHours : 8;
    const halfHours = officeHours / 2;
    if (start) {
      const end = new Date(start.getTime() + halfHours * 60 * 60 * 1000);
      return { status: "present", companyLeaveId: null, punchIn: start, punchOut: end, workingHours: Number(halfHours.toFixed(2)), dayType: "half_day", overtime: 0 };
    }
    const fallbackStart = punchIn ? new Date(punchIn) : new Date();
    return { status: "present", companyLeaveId: null, punchIn: fallbackStart, punchOut: null, workingHours: null, dayType: "half_day", overtime: null };
  }

  // status === "present"
  const derived = shift?.startTime
    ? deriveShiftPunchFields(shift, company, attendanceDate)
    : { punchIn: punchIn ? new Date(punchIn) : new Date(), punchOut: null, workingHours: null, dayType: null, overtime: null };
  return { status: "present", companyLeaveId: null, ...derived };
};

export const userAttendance = async (loggedInId: number, userId: string, query: any) => {
  const employeeId = Number(userId);
  if (!Number.isInteger(employeeId) || employeeId < 0) {
    throw new ServiceError("Invalid userId");
  }

  // FIX: this previously had no ownership check at all — any caller with
  // attendance:view could pass any userId and read another team's data.
  const childIds = await getAllChildUserIds(loggedInId);
  if (employeeId !== loggedInId && !childIds.includes(employeeId)) {
    throw new ServiceError("You can only view attendance of your own team members", 403);
  }

  const { page, limit, offset } = getPagination(query);
  const dateFilter = getDateFilter(query);

  const { rows, count } = await AttendanceRepo.findEmployeeAttendancePaginated(
    employeeId,
    limit,
    offset,
    dateFilter
  );

  return {
    attendance: rows,
    pagination: {
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      limit,
    },
  };
};

const getDateFilter = (query: any) => {
  const { startDate, endDate, lastDays, today } = query;
  const filter: any = {};

  if (startDate && endDate) {
    filter[Op.between] = [new Date(startDate), new Date(endDate)];
  }
  if (startDate) {
    filter[Op.gte] = new Date(startDate);
  }
  if (endDate) {
    filter[Op.lte] = new Date(endDate);
  }
  if (lastDays) {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - Number(lastDays));
    filter[Op.between] = [past, now];
  }
  if (today === "true") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter[Op.between] = [start, end];
  }
  return filter;
};

const generateDayMap = (totalDays: number) =>
  Object.fromEntries(Array.from({ length: totalDays }, (_, i) => [String(i + 1), "-"]));

const buildSearchFilter = (search: string) =>
  search
    ? {
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};

export const attendanceBook = async (userId: number, query: any) => {
  const childIds = await getAllChildUserIds(userId);

  if (!childIds.length) {
    throw new ServiceError("No child users found");
  }

  const month = Number(query.month) || new Date().getMonth() + 1;
  const year = Number(query.year) || new Date().getFullYear();
  const search = String(query.search || "");
  const pageNum = Number(query.page) || 1;
  const limitNum = Number(query.limit) || 10;
  const offset = (pageNum - 1) * limitNum;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const totalDays = endDate.getDate();

  const { rows: users, count: totalCount } = await AttendanceRepo.findUsersWithAttendanceForMonth({
    childIds,
    search: buildSearchFilter(search),
    startDate,
    endDate,
    limit: limitNum,
    offset,
  });

  const totalPages = Math.ceil(totalCount / limitNum);

  const formatted = users.map((u: any) => {
    const days = generateDayMap(totalDays);
    // dayType (full_day/half_day/short_leave) is a separate column from
    // status — surfaced alongside `days` so the UI can tell an admin exactly
    // what they're about to overwrite (e.g. "Sick Leave — Half Day")
    // instead of just the coarse status.
    const dayTypes: Record<string, string | null> = {};
    // Which specific company-configured leave type (if any) produced this
    // day's leave/leaveApproved status — lets the UI show "Sick Leave"
    // instead of just the generic "On Leave".
    const leaveTypes: Record<string, { id: number; name: string } | undefined> = {};

    if (u.Attendances?.length) {
      u.Attendances.forEach((attendance: any) => {
        const day = new Date(attendance.date).getDate();
        days[String(day)] = attendance.status ?? "-";
        if (attendance.dayType) dayTypes[String(day)] = attendance.dayType;
        if (attendance.leaveType) {
          leaveTypes[String(day)] = { id: attendance.leaveType.id, name: attendance.leaveType.leaveName };
        }
      });
    }

    return {
      id: u.id,
      employeeCode: u.employeeCode ?? null,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      dob: u.dob,
      profile: u.profile,
      role: u.role,
      days,
      dayTypes,
      leaveTypes,
    };
  });

  return {
    page: pageNum,
    limit: limitNum,
    totalCount,
    totalPages,
    users: formatted,
  };
};

// ---- Bulk attendance upload ----

// Keys are space-separated (not snake_case) because normalizeStatusKey folds
// underscores to spaces too — so "half_day", "Half Day" and "half day" all
// normalize the same way regardless of which style the caller sends.
// Generic, non-leave-type-specific statuses (present/absent/week off/
// holiday) plus a legacy fallback for the old free-text leave words, kept
// for backward compatibility with templates downloaded before leave types
// became company-configurable — these never carry a companyLeaveId.
const BULK_ATTENDANCE_STATUS_MAP: Record<string, string> = {
  absent: "absent",
  present: "present",
  "double present": "present",
  "week off": "holiday",
  holiday: "holiday",
  "half day": "leaveApproved",
  "unpaid leave": "leaveApproved",
  "paid leave": "leaveApproved",
  "sick leave": "leaveApproved",
  "casual leave": "leaveApproved",
  "comp leave": "leaveApproved",
};

const normalizeStatusKey = (value: any): string =>
  String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");

type BulkStatusResolution = { status: string; companyLeaveId: number | null };

// This company's configured leave types (by name or code) resolve to
// leaveApproved + the specific type's id — takes priority over the generic
// legacy map so "Comp Leave", "Maternity Leave", or any other custom type
// configured at registration is recognized by name in the bulk template.
const buildDynamicLeaveStatusMap = (leaveTypes: any[]): Record<string, BulkStatusResolution> => {
  const map: Record<string, BulkStatusResolution> = {};
  for (const lt of leaveTypes) {
    const entry: BulkStatusResolution = { status: "leaveApproved", companyLeaveId: lt.id };
    map[normalizeStatusKey(lt.leaveName)] = entry;
    map[normalizeStatusKey(lt.leaveCode)] = entry;
  }
  return map;
};

const resolveBulkStatus = (
  rawStatus: any,
  dynamicLeaveMap: Record<string, BulkStatusResolution>
): BulkStatusResolution | null => {
  const key = normalizeStatusKey(rawStatus);
  if (dynamicLeaveMap[key]) return dynamicLeaveMap[key];
  const legacyStatus = BULK_ATTENDANCE_STATUS_MAP[key];
  return legacyStatus ? { status: legacyStatus, companyLeaveId: null } : null;
};

// Uses local getters (not toISOString) — toISOString converts to UTC first,
// which shifts non-ISO date strings (e.g. CSV-reformatted "7/6/26") back a
// day in any timezone ahead of UTC.
const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeHeaderDate = (value: any): string | null => {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return formatLocalDate(value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return value.trim().slice(0, 10);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : formatLocalDate(parsed);
};

// A date-column cell may hold a status word (handled above) OR a punch-in
// clock time (e.g. "09:15", "9:15:00", "9:15 AM") to backfill a real
// punch_in for a past date. Excel time-formatted cells and plain text both
// come through sheet_to_json as strings in this format, so a status-word
// miss is retried against this pattern before falling back to "unknown".
const TIME_OF_DAY_RE = /^([0-1]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?$/i;

const parseTimeOfDayOnDate = (dateStr: string, value: any): Date | null => {
  const raw = String(value ?? "").trim();
  const match = raw.match(TIME_OF_DAY_RE);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  const meridiem = match[4]?.toLowerCase();

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "am") hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(y, m - 1, d, hours, minutes, seconds);
  return isNaN(result.getTime()) ? null : result;
};

export const bulkMarkAttendance = async (
  loggedInId: number,
  companyId: number | undefined,
  file: MulterS3File | undefined,
  body: { fromDate?: string; toDate?: string; shiftId?: string }
) => {
  // Resolved once (not per-row) — bulk uploads don't carry per-employee
  // shift context, but they should still respect whether this company has
  // opted into overtime tracking at all, instead of always assuming yes.
  const bulkCompany = companyId ? await AttendanceRepo.findCompanyById(Number(companyId)) : null;
  const bulkOvertimeAllowed = (bulkCompany as any)?.overtimeAllowed ?? false;

  const bulkLeaveTypes = companyId ? await AttendanceRepo.findCompanyLeaveTypesForBulk(Number(companyId)) : [];
  const dynamicLeaveMap = buildDynamicLeaveStatusMap(bulkLeaveTypes);

  if (!file) throw new ServiceError("Attendance file (.csv or .xlsx) is required");

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const data = await s3.send(new GetObjectCommand({ Bucket: file.bucket, Key: file.key }));

  if (!data.Body) throw new ServiceError("Unable to read file from S3");

  const chunks: Buffer[] = [];
  for await (const chunk of data.Body as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  // Parse .csv explicitly as text instead of relying on XLSX's binary-format
  // auto-detection — guards against edge cases (BOM from "CSV UTF-8" saves,
  // CRLF line endings, commas inside quoted names) silently mis-parsing.
  const isCsv =
    (file.originalname || "").toLowerCase().endsWith(".csv") || file.mimetype === "text/csv";
  const BOM = String.fromCharCode(0xfeff);
  const workbook = isCsv
    ? XLSX.read(buffer.toString("utf8").replace(new RegExp(`^${BOM}`), ""), {
        type: "string",
        cellDates: true,
        raw: false,
      })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === "employee_details") ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  if (rows.length < 2) throw new ServiceError("No attendance rows found in the uploaded file");

  const [headerRow, ...dataRows] = rows;

  // Column 0: Staff Name, 1: Employee ID, 2: Job Title, 3+: dates
  const dateColumns: { index: number; date: string }[] = [];
  for (let i = 3; i < headerRow.length; i++) {
    const date = normalizeHeaderDate(headerRow[i]);
    if (date) dateColumns.push({ index: i, date });
  }
  const dateColumnIndexByDate = new Map<string, number>(
    dateColumns.map(({ index, date }) => [date, index])
  );

  // The frontend also sends fromDate/toDate alongside the file (the range
  // picked in the UI). When present, that range — not just the columns the
  // sheet happens to have — decides which dates get processed per
  // employee; any date in range with no column or a blank cell defaults to
  // "present" instead of being silently skipped.
  const { fromDate, toDate } = body;
  let rangeDates: string[] = dateColumns.map((c) => c.date);
  if (fromDate && toDate) {
    const normalizedFrom = normalizeHeaderDate(fromDate);
    const normalizedTo = normalizeHeaderDate(toDate);
    if (!normalizedFrom || !normalizedTo) throw new ServiceError("Invalid fromDate/toDate");
    if (normalizedFrom > normalizedTo) throw new ServiceError("fromDate must be before toDate");

    const start = new Date(normalizedFrom);
    const end = new Date(normalizedTo);
    const MAX_RANGE_DAYS = 366;
    const spanDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (spanDays > MAX_RANGE_DAYS) throw new ServiceError(`Date range too large (max ${MAX_RANGE_DAYS} days)`);

    rangeDates = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      rangeDates.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const childIds = await getAllChildUserIds(loggedInId);
  const allowedIds = new Set<number>([loggedInId, ...childIds]);

  const skippedNonNumericEmployeeId: any[] = [];
  const skippedNotInTeam: number[] = [];
  const skippedUnknownStatus: { employeeId: number; date: string; status: any }[] = [];
  const skippedWrongShift: number[] = [];
  const skippedTooEarly: { employeeId: number; date: string; reason: string }[] = [];

  // "Employee ID" column holds each employee's human-facing code
  // (EMP00001, from the template's own "Employee ID" column) — resolved
  // against this caller's team up front, once, rather than per row. A bare
  // number is still accepted as a fallback (older templates downloaded
  // before employee codes existed, or someone typing the internal id
  // directly), so nothing already in the wild breaks.
  const teamForCodes = allowedIds.size ? await AttendanceRepo.findTeamEmployeeCodes([...allowedIds]) : [];
  const idByEmployeeCode = new Map<string, number>(
    teamForCodes
      .filter((u: any) => u.employeeCode)
      .map((u: any) => [String(u.employeeCode).toUpperCase(), u.id])
  );
  const resolveEmployeeIdCell = (rawCell: any): number | null => {
    const trimmed = String(rawCell ?? "").trim();
    if (!trimmed) return null;
    const byCode = idByEmployeeCode.get(trimmed.toUpperCase());
    if (byCode !== undefined) return byCode;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
  };

  // Pass 1: collect every row's employeeId that resolves to someone on this
  // caller's team, so their shifts can be resolved in one batch query each
  // (2 queries total) instead of one query per row.
  const validEmployeeIds: number[] = [];
  for (const row of dataRows) {
    const resolved = resolveEmployeeIdCell(row[1]);
    if (resolved !== null && allowedIds.has(resolved)) {
      validEmployeeIds.push(resolved);
    }
  }

  const requestedShiftId = body.shiftId ? Number(body.shiftId) : null;

  const employeeShiftInfo = validEmployeeIds.length ? await AttendanceRepo.findUsersShiftInfo(validEmployeeIds) : [];
  const shiftInfoByEmployee = new Map<number, { shiftId: number | null; firstName: string | null }>(
    employeeShiftInfo.map((u: any) => [u.id, { shiftId: u.shiftId ?? null, firstName: u.firstName ?? null }])
  );
  const involvedShiftIds = [...new Set(employeeShiftInfo.map((u: any) => u.shiftId).filter((id: any): id is number => !!id))];
  const shiftsById = involvedShiftIds.length
    ? new Map((await AttendanceRepo.findShiftsByIds(involvedShiftIds)).map((s: any) => [s.id, s]))
    : new Map<number, any>();

  const todayDateOnly = new Date().toISOString().slice(0, 10);

  type Assignment = { employee_id: number; date: string; status: string; punch_in?: Date; companyLeaveId?: number | null };
  const assignments: Assignment[] = [];
  const employeeIds = new Set<number>();

  for (const row of dataRows) {
    const rawEmployeeId = row[1];
    const resolvedEmployeeId = resolveEmployeeIdCell(rawEmployeeId);

    if (resolvedEmployeeId === null) {
      if (String(rawEmployeeId ?? "").trim()) skippedNonNumericEmployeeId.push(rawEmployeeId);
      continue;
    }

    const employeeId = resolvedEmployeeId;
    if (!allowedIds.has(employeeId)) {
      skippedNotInTeam.push(employeeId);
      continue;
    }

    const empShiftInfo = shiftInfoByEmployee.get(employeeId);

    // If this upload was scoped to a specific shift (dropdown), reject any
    // employee not actually assigned to that shift outright — guards
    // against a manually-edited sheet slipping someone in under the wrong
    // roster.
    if (requestedShiftId && empShiftInfo?.shiftId !== requestedShiftId) {
      skippedWrongShift.push(employeeId);
      continue;
    }

    const empShift = empShiftInfo?.shiftId ? shiftsById.get(empShiftInfo.shiftId) : null;

    // Only "present" rows for TODAY are gated — marking someone present for
    // a past date is a correction (no "about to start" to wait for), and
    // leave/holiday rows don't involve showing up at all. No assigned shift
    // never gates (nothing to wait for).
    const applyIfNotTooEarly = (date: string, status: string, extra: Partial<Assignment> = {}) => {
      if (status === "present" && date === todayDateOnly && empShift && isBeforeShiftWindow(empShift, date)) {
        skippedTooEarly.push({
          employeeId,
          date,
          reason: formatShiftWindowMessage(empShift, date, empShiftInfo?.firstName ?? undefined),
        });
        return;
      }
      employeeIds.add(employeeId);
      assignments.push({ employee_id: employeeId, date, status, ...extra });
    };

    for (const date of rangeDates) {
      const colIndex = dateColumnIndexByDate.get(date);
      const rawStatus = colIndex !== undefined ? row[colIndex] : undefined;

      // No column for this date, or the cell is blank: default to present
      // rather than silently skipping the day.
      if (!String(rawStatus ?? "").trim()) {
        applyIfNotTooEarly(date, "present");
        continue;
      }

      const resolved = resolveBulkStatus(rawStatus, dynamicLeaveMap);
      if (resolved) {
        applyIfNotTooEarly(date, resolved.status, { companyLeaveId: resolved.companyLeaveId });
        continue;
      }

      // Not a recognized status word — try it as a punch-in clock time
      // (e.g. "09:15") to backfill a real punch_in for that date.
      const punchInTime = parseTimeOfDayOnDate(date, rawStatus);
      if (punchInTime) {
        applyIfNotTooEarly(date, "present", { punch_in: punchInTime });
        continue;
      }

      skippedUnknownStatus.push({ employeeId, date, status: rawStatus });
    }
  }

  if (assignments.length === 0) {
    return {
      applied: 0,
      skippedNonNumericEmployeeId,
      skippedNotInTeam,
      skippedUnknownStatus,
      skippedWrongShift,
      skippedTooEarly,
    };
  }

  const dates = [...new Set(assignments.map((a) => a.date))];

  const existingRows = await AttendanceRepo.findAttendanceRowsForBulk([...employeeIds], dates);

  const existingMap = new Map<string, any>();
  for (const row of existingRows) {
    existingMap.set(`${row.employee_id}|${row.date}`, row);
  }

  const toCreate: Assignment[] = [];
  const toUpdate: any[] = [];

  // Same employee -> shift resolution built for the start-time gate above,
  // reused here so a bulk-backfilled punch's half-day/overtime classification
  // respects that employee's own shift thresholds — matching what
  // self-service punch-out already does — instead of silently falling back
  // to the hardcoded 8h/4h split for everyone.
  const resolveEmployeeShift = (employeeId: number) => {
    const info = shiftInfoByEmployee.get(employeeId);
    return info?.shiftId ? shiftsById.get(info.shiftId) ?? null : null;
  };

  for (const assignment of assignments) {
    const key = `${assignment.employee_id}|${assignment.date}`;
    const existing = existingMap.get(key);
    const empShiftForRow = resolveEmployeeShift(assignment.employee_id);

    if (assignment.status === "present") {
      // Punch-in/out are derived from the employee's assigned shift, same
      // as the single "Mark Present" action — a typed punch-in time (e.g.
      // "09:15") overrides the shift's own start, but punch_out (and the
      // working_hours/dayType/overtime built from it) still comes from the
      // shift's end time, so a bulk-marked day reflects the hours actually
      // scheduled instead of staying null forever.
      const derived = deriveShiftPunchFields(empShiftForRow, bulkCompany, assignment.date, assignment.punch_in ?? null);

      if (existing) {
        existing.status = "present";
        // A real punch means they showed up — no longer a leave day, so any
        // prior leave-type association is stale and must be cleared.
        existing.companyLeaveId = null;
        existing.punch_in = derived.punchIn;
        // Prefer an existing real punch_out if there is one and it's later
        // than the (possibly new) punch_in — don't discard a genuine punch
        // just because this row is being backfilled/re-marked.
        const keepExistingPunchOut = existing.punch_out && existing.punch_out > derived.punchIn;
        existing.punch_out = keepExistingPunchOut ? existing.punch_out : derived.punchOut;
        if (existing.punch_out) {
          const workingHours = Number(
            ((existing.punch_out.getTime() - derived.punchIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
          );
          const officeHours = empShiftForRow?.workingHours && empShiftForRow.workingHours > 0 ? empShiftForRow.workingHours : 8;
          existing.working_hours = workingHours;
          existing.dayType = getDayTypeFromWorkingHours(workingHours, empShiftForRow, bulkCompany);
          existing.overtime = bulkOvertimeAllowed && workingHours > officeHours ? Number((workingHours - officeHours).toFixed(2)) : 0;
        } else {
          existing.working_hours = null;
          existing.dayType = null;
          existing.overtime = null;
        }
        toUpdate.push(existing);
      } else {
        toCreate.push({
          ...assignment,
          punch_in: derived.punchIn,
          punch_out: derived.punchOut,
          working_hours: derived.workingHours,
          dayType: derived.dayType,
          overtime: derived.overtime,
        } as any);
      }
    } else if (existing) {
      // Bulk-marking overwrites the day's status directly; punch-derived
      // fields from any prior real punch no longer apply and must be
      // cleared, or they end up contradicting the new status (e.g.
      // status "absent" next to a full punched day's hours).
      existing.status = assignment.status;
      existing.companyLeaveId = assignment.companyLeaveId ?? null;
      existing.punch_in = null;
      existing.punch_out = null;
      existing.working_hours = null;
      existing.dayType = null;
      existing.overtime = null;
      toUpdate.push(existing);
    } else {
      toCreate.push(assignment);
    }
  }

  // All rows for this upload commit or roll back together (transaction).
  await AttendanceRepo.saveBulkAttendance(toUpdate, toCreate);

  return {
    applied: assignments.length,
    created: toCreate.length,
    updated: toUpdate.length,
    skippedNonNumericEmployeeId,
    skippedNotInTeam,
    skippedUnknownStatus,
    skippedWrongShift,
    skippedTooEarly,
  };
};

// ---- Self-service (punch in/out, today, list) ----

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ── Shift-start gate ─────────────────────────────────────────────────────
// An employee's attendance for "today" can only be marked present starting
// this many minutes before their assigned shift's start time ("about to
// start") — shared by markAttendancePresent, bulkMarkAttendance, and
// self-service punch-in so "shift about to start" means the same instant
// everywhere in the app, not three slightly different rules.
const EARLY_MARK_LEAD_MINUTES = 30;

// dateStr: "YYYY-MM-DD". Builds the actual Date instant the shift starts on
// that day from its "HH:mm[:ss]" startTime string.
const shiftStartInstant = (shift: { startTime?: string } | null | undefined, dateStr: string): Date | null => {
  if (!shift?.startTime) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = String(shift.startTime).split(":").map(Number);
  return new Date(y, (m || 1) - 1, d, h || 0, min || 0, 0);
};

// Builds the shift's end instant on `dateStr`, rolling to the next calendar
// day when endTime <= startTime (a night shift crossing midnight, e.g.
// 22:00–06:00) — otherwise a same-day "end before start" would produce a
// negative/zero working-hours span.
const shiftEndInstant = (
  shift: { startTime?: string; endTime?: string } | null | undefined,
  dateStr: string
): Date | null => {
  if (!shift?.endTime) return null;
  const start = shiftStartInstant(shift, dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = String(shift.endTime).split(":").map(Number);
  const end = new Date(y, (m || 1) - 1, d, h || 0, min || 0, 0);
  if (start && end <= start) end.setDate(end.getDate() + 1);
  return end;
};

// Derives punch_in/punch_out/working_hours/dayType/overtime for a day being
// marked present administratively (single mark or a bulk "present" row)
// from the employee's assigned shift — so a retroactively-marked day
// reflects the hours they were actually scheduled to work, not an arbitrary
// time an admin happened to pick. `explicitPunchIn` (bulk's punch-time-
// backfill cells, e.g. "09:15") overrides the shift's own start time while
// punch_out still comes from the shift's end. Returns punch_in only (no
// punch_out/derived fields) when there's no assigned shift, matching the
// previous fallback behavior for shift-less employees.
const deriveShiftPunchFields = (
  shift: { startTime?: string; endTime?: string; fullDayHours?: number | null; halfDayAfter?: number | null; workingHours?: number | null } | null | undefined,
  company: { autoHalfDayAfter?: number | null; overtimeAllowed?: boolean | null } | null | undefined,
  dateStr: string,
  explicitPunchIn?: Date | null
): {
  punchIn: Date;
  punchOut: Date | null;
  workingHours: number | null;
  dayType: "full_day" | "half_day" | "short_leave" | null;
  overtime: number | null;
} => {
  const punchIn = explicitPunchIn ?? shiftStartInstant(shift, dateStr);
  const punchOut = shiftEndInstant(shift, dateStr);

  if (!punchIn || !punchOut || punchOut <= punchIn) {
    return { punchIn: punchIn ?? new Date(), punchOut: null, workingHours: null, dayType: null, overtime: null };
  }

  const workingHours = Number(((punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60)).toFixed(2));
  const officeHours = shift?.workingHours && shift.workingHours > 0 ? shift.workingHours : 8;
  const overtime = company?.overtimeAllowed && workingHours > officeHours ? Number((workingHours - officeHours).toFixed(2)) : 0;
  const dayType = getDayTypeFromWorkingHours(workingHours, shift, company);

  return { punchIn, punchOut, workingHours, dayType, overtime };
};

// True when `atInstant` is still more than EARLY_MARK_LEAD_MINUTES before
// the shift's start on `dateStr` — i.e. too early to mark present yet.
// No assigned shift (shift is null) never gates — there's nothing to wait
// for, matching how punch-in already behaves when no shift is assigned.
const isBeforeShiftWindow = (
  shift: { startTime?: string } | null | undefined,
  dateStr: string,
  atInstant: Date = new Date()
): boolean => {
  const start = shiftStartInstant(shift, dateStr);
  if (!start) return false;
  const earliestAllowed = new Date(start.getTime() - EARLY_MARK_LEAD_MINUTES * 60000);
  return atInstant < earliestAllowed;
};

const formatShiftWindowMessage = (
  shift: { startTime?: string; shiftName?: string },
  dateStr: string,
  employeeName?: string
): string => {
  const start = shiftStartInstant(shift, dateStr)!;
  const earliestAllowed = new Date(start.getTime() - EARLY_MARK_LEAD_MINUTES * 60000);
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const who = employeeName ? `${employeeName}'s` : "This employee's";
  const shiftLabel = shift.shiftName ? `${shift.shiftName} shift` : "shift";
  return `${who} ${shiftLabel} starts at ${fmt(start)} — attendance can only be marked from ${fmt(earliestAllowed)} onward.`;
};

// Resolve an employee's assigned shift + their company's attendance
// policy + their branch (for geofencing) — precedence used throughout this
// file: employee's Shift > Company policy > hardcoded fallback, only when
// neither is configured.
//
// FIX: companyId used to be derived ONLY from the shift/branch's own
// companyId — fine for a sale_person (always has both), but admin/manager
// accounts routinely have neither (shiftId/branchId are null), so company
// silently resolved to null for them: late-marking fell back to a
// hardcoded 09:30/no-grace regardless of the company's actual
// lateMarkAfter policy, and overtime could never be credited since
// company.overtimeAllowed was never even looked up. `callerCompanyId` is
// the same companyId tokenCheck already resolves for every role (via
// Company.adminId/CompanyAdmin for admin, CompanyManager for manager) —
// passing it through here means an admin/manager without a shift still
// gets their real company's policy instead of a hardcoded stand-in.
const resolveAttendanceContext = async (employeeId: number, callerCompanyId?: number | null) => {
  const employee = (await AttendanceRepo.findEmployeeById(employeeId)) as any;

  const [shift, branch] = await Promise.all([
    employee?.shiftId ? AttendanceRepo.findShiftById(employee.shiftId) : Promise.resolve(null),
    employee?.branchId ? AttendanceRepo.findBranchById(employee.branchId) : Promise.resolve(null),
  ]);

  const companyId = (shift as any)?.companyId ?? (branch as any)?.companyId ?? callerCompanyId ?? null;
  const company = companyId ? await AttendanceRepo.findCompanyById(companyId) : null;

  return { shift: shift as any, company: company as any, branch: branch as any };
};

export const attendancePunchIn = async (finalUserId: number, callerCompanyId: number | null, body: any) => {
  const { punch_in, latitude_in, longitude_in } = body || {};

  if (!punch_in) throw new ServiceError("Punch-in time is required");

  // FIX: was new Date().toISOString().slice(0,10) — toISOString() converts
  // to UTC first, which rolls the calendar day backward for any local time
  // before ~05:30 IST, silently recording an early-morning punch against
  // yesterday instead of today. formatLocalDate uses local getters instead,
  // matching the fix already applied to bulk attendance in this same file.
  const today = formatLocalDate(new Date());

  const activeSession = await AttendanceRepo.findActivePunchSession(finalUserId, today);
  if (activeSession) throw new ServiceError("You have already punched-in. Please punch-out first.");

  const { shift, company, branch } = await resolveAttendanceContext(Number(finalUserId), callerCompanyId);

  // Shift-start gate — can't punch in for today until the assigned shift is
  // about to start (within EARLY_MARK_LEAD_MINUTES of its start time). No
  // assigned shift skips this entirely.
  if (isBeforeShiftWindow(shift, today)) {
    throw new ServiceError(formatShiftWindowMessage(shift, today));
  }

  // Geofencing — only enforced when the company requires it AND the
  // employee's branch has geofence data configured; missing config never
  // blocks a punch (there's nothing to enforce against).
  const geofencingActive =
    (company?.geoFencingRequired ?? true) &&
    (company?.officeLocationRequired ?? true) &&
    branch?.latitude != null &&
    branch?.longitude != null &&
    Number(branch?.geoRadius) > 0;

  if (geofencingActive) {
    if (latitude_in == null || longitude_in == null) {
      throw new ServiceError("Location is required to punch in for this company");
    }
    const distance = haversineMeters(
      Number(latitude_in),
      Number(longitude_in),
      Number(branch.latitude),
      Number(branch.longitude)
    );
    if (distance > Number(branch.geoRadius)) {
      throw new ServiceError(
        `You are ${Math.round(distance)}m away from ${branch.branchName || "your branch"} — must be within ${branch.geoRadius}m to punch in`
      );
    }
  }

  // Check if this is the first punch of the day to determine "late" status
  // — shift start time + company grace minutes, falling back to 09:30 with
  // no grace only when neither is configured.
  const existingRecordsForToday = await AttendanceRepo.findAttendanceForDate(finalUserId, today);

  let late = false;
  if (!existingRecordsForToday) {
    const officeStartTime = shift?.startTime || "09:30:00";
    const graceMinutes = company?.lateMarkAfter ?? 0;
    const [y, m, d] = today.split("-").map(Number);
    const [startHour, startMin] = String(officeStartTime).split(":").map(Number);
    const officeTime = new Date(y, (m || 1) - 1, d, startHour || 0, (startMin || 0) + graceMinutes, 0);
    const punchInTime = new Date(punch_in);
    if (punchInTime > officeTime) late = true;
  }

  const punchInTime = new Date(punch_in);

  // A row for today already exists but isn't an active "present" session
  // (already punched out once today, or an admin-marked absent/leave/holiday
  // day) — reuse that same row instead of creating a second one for the
  // same employee+date, which the rest of the app (Mark Attendance,
  // Attendance Register, bulk upload) all assume is unique. A genuine punch
  // is the most authoritative record of what actually happened that day, so
  // it overrides whatever the row previously said. "late" reflects the
  // day's first arrival only — preserved as-is on a re-punch, not recomputed.
  if (existingRecordsForToday) {
    existingRecordsForToday.punch_in = punchInTime;
    existingRecordsForToday.punch_out = null as any;
    existingRecordsForToday.working_hours = null as any;
    existingRecordsForToday.dayType = null as any;
    existingRecordsForToday.overtime = null as any;
    existingRecordsForToday.status = "present" as any;
    existingRecordsForToday.companyLeaveId = null as any;
    existingRecordsForToday.latitude_in = latitude_in;
    existingRecordsForToday.longitude_in = longitude_in;
    await existingRecordsForToday.save();
    return existingRecordsForToday;
  }

  return AttendanceRepo.createAttendanceRecord({
    employee_id: finalUserId,
    date: today,
    punch_in: punchInTime,
    status: "present",
    late,
    latitude_in,
    longitude_in,
  } as any);
};

// Derived from a punch-out session's working_hours against the employee's
// shift thresholds (fullDayHours / halfDayAfter, both in HOURS — compared
// directly against workingHours) when a shift is assigned, falling back to
// the company's autoHalfDayAfter policy (registration Step3 — collected in
// MINUTES, per that form's own label, so it's converted to hours here)
// when the shift itself doesn't specify one, and only then to an 8h full
// day / 4h half day hardcoded split — same "Shift > Company > hardcoded"
// precedence used throughout this file (geofencing, lateMarkAfter, etc.).
// Previously this used a hardcoded <3h / <9h split regardless of shift —
// which, e.g., misclassified a full 8h day as "half_day" since 8 < 9.
export const getDayTypeFromWorkingHours = (
  workingHours: number,
  shift?: { fullDayHours?: number | null; halfDayAfter?: number | null } | null,
  company?: { autoHalfDayAfter?: number | null } | null
): "full_day" | "half_day" | "short_leave" => {
  const fullDayThreshold = shift?.fullDayHours && shift.fullDayHours > 0 ? shift.fullDayHours : 8;
  const companyHalfDayHours = company?.autoHalfDayAfter && company.autoHalfDayAfter > 0
    ? company.autoHalfDayAfter / 60
    : null;
  const halfDayThreshold =
    shift?.halfDayAfter && shift.halfDayAfter > 0
      ? shift.halfDayAfter
      : companyHalfDayHours ?? fullDayThreshold / 2;
  if (workingHours < Math.min(3, halfDayThreshold)) return "short_leave";
  if (workingHours < fullDayThreshold) return "half_day";
  return "full_day";
};

export const attendancePunchOut = async (finalUserId: number, callerCompanyId: number | null, body: any) => {
  const { punch_out, AttendanceId, latitude_out, longitude_out } = body || {};

  if (!punch_out) throw new ServiceError("Punch-out time is required");

  const today = formatLocalDate(new Date());
  const attendance = await AttendanceRepo.findActivePunchSessionById(finalUserId, today, AttendanceId);
  if (!attendance) throw new ServiceError("No active punch-in record found. Please punch-in first.");

  const punchInTime = new Date(attendance.punch_in as Date);
  const punchOutTime = new Date(punch_out);

  if (punchOutTime < punchInTime) throw new ServiceError("Punch-out must be after punch-in");

  const diffMs = punchOutTime.getTime() - punchInTime.getTime();
  const workingHours = diffMs / (1000 * 60 * 60);
  const workingHoursRounded = Number(workingHours.toFixed(2));

  const { shift, company } = await resolveAttendanceContext(Number(finalUserId), callerCompanyId);

  // Overtime — only computed when the company has opted in; baseline from
  // the employee's shift working-hours, falling back to 8h.
  const overtimeAllowed = company?.overtimeAllowed ?? false;
  const officeHours = shift?.workingHours && shift.workingHours > 0 ? shift.workingHours : 8;
  const overtime =
    overtimeAllowed && workingHoursRounded > officeHours
      ? Number((workingHoursRounded - officeHours).toFixed(2))
      : 0;

  attendance.punch_out = punchOutTime;
  attendance.working_hours = workingHoursRounded;
  attendance.overtime = overtime;
  attendance.latitude_out = latitude_out;
  attendance.longitude_out = longitude_out;
  attendance.status = "out";
  attendance.dayType = getDayTypeFromWorkingHours(workingHoursRounded, shift, company);
  await attendance.save();

  return attendance;
};

export const getTodayAttendance = async (finalUserId: number) => {
  const today = formatLocalDate(new Date());
  const record = await AttendanceRepo.findLatestAttendanceForDate(finalUserId, today);
  if (!record) throw new ServiceError("No attendance found for today");
  return record;
};
