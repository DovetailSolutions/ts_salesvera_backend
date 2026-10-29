import { ServiceError } from "../shared/serviceError";
import { getISTDateString } from "../shared/dateUtils";
import * as Repo from "./employeeProfile.repository";

// ============================================================
// Date of joining for a newly added admin / manager / employee. Stored in the
// existing employee_extra_details.dateOfJoining (the "Date of Joining" field
// of the employee profile), so there is one place to read and edit it — and
// work anniversaries can be worked out from it. Every account creation path
// (single registration, bulk upload, super admin) sets it; when the form
// leaves it out it defaults to the day the account is added.
// ============================================================

export const JOINING_DATE_ROLES = ["admin", "manager", "employee"];

const DAY_MS = 24 * 60 * 60 * 1000;

// "" / null / undefined → null (caller defaults it). Otherwise it must be a
// real YYYY-MM-DD date, not before 1950 and at most a year ahead (an offer
// accepted for a future start date is fine; a typo year is not).
export const parseJoiningDate = (raw: unknown): string | null => {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const value = String(raw).trim().slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid) throw new ServiceError("Date of joining must be a valid date (YYYY-MM-DD)");
  if (value < "1950-01-01") throw new ServiceError("Date of joining cannot be before 1950");
  const latest = new Date(Date.parse(`${getISTDateString()}T00:00:00Z`) + 365 * DAY_MS).toISOString().slice(0, 10);
  if (value > latest) throw new ServiceError("Date of joining cannot be more than a year in the future");
  return value;
};

// Writes the joining date of a just-created account (today when not given).
export const saveJoiningDate = async (params: {
  userId: number;
  role: string;
  dateOfJoining: string | null;
  companyId: number | null;
  createdBy: number | null;
}) => {
  if (!JOINING_DATE_ROLES.includes(params.role)) return null;
  const existing = await Repo.findExtraDetails(params.userId);
  return Repo.upsertExtraDetails(params.userId, {
    dateOfJoining: params.dateOfJoining ?? getISTDateString(),
    ...(existing ? {} : { companyId: params.companyId, createdBy: params.createdBy }),
  });
};
