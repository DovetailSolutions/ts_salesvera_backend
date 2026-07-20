import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import {
  bulkCreateHolidays,
  findHolidayOwnedBy,
  findHolidays,
  HolidayRow,
} from "./holiday.repository";

// ============================================================
// Holiday service — validation + orchestration, no HTTP or Sequelize
// details. Behavior here is a byte-for-byte port of the previous
// addHoliday/updateHoliday/getHoliday/getHolidayById controller bodies in
// admin.ts, just split across layers.
// ============================================================

interface AddHolidayInput {
  holidayName: string;
  holidayDate: string;
  holidayType: string;
  branchId: unknown;
  description?: string | null;
  adminId?: number | string | null;
  managerId?: number | string | null;
}

export const createHolidays = async (
  userId: number,
  holidays: unknown,
  companyId: unknown
) => {
  if (!Array.isArray(holidays) || holidays.length === 0) {
    throw new ServiceError("holidays array is required");
  }

  const holidayData: HolidayRow[] = [];

  for (const item of holidays as AddHolidayInput[]) {
    const { holidayName, holidayDate, holidayType, branchId, description, adminId, managerId } = item;

    if (!holidayName || holidayName.trim().length < 2) {
      throw new ServiceError("Holiday name is required");
    }
    if (!holidayDate || String(holidayDate).trim().length < 2) {
      throw new ServiceError("Holiday date is required");
    }
    if (!holidayType || holidayType.trim().length < 2) {
      throw new ServiceError("Holiday type is required");
    }
    if (!Array.isArray(branchId) || branchId.length === 0) {
      throw new ServiceError("branchId must be a non-empty array");
    }

    for (const branch of branchId) {
      if (isNaN(Number(branch))) {
        throw new ServiceError("Invalid branchId value");
      }

      holidayData.push({
        holidayName: String(holidayName),
        holidayDate,
        holidayType: String(holidayType),
        branchId: Number(branch),
        description: description || null,
        adminId: adminId ? Number(adminId) : null,
        managerId: managerId ? Number(managerId) : null,
        userId: Number(userId),
        companyId: companyId ? Number(companyId) : null,
      });
    }
  }

  return bulkCreateHolidays(holidayData);
};

interface UpdateHolidayInput {
  holidayName?: string;
  holidayDate?: string;
  holidayType?: string;
  branchId?: unknown;
  description?: string;
}

// Note: a Holiday row has a single branchId (createHolidays creates one row
// per selected branch), but the settings-page form represents "Applicable
// Branches" as an array per holiday entry (shared multi-select UI). If an
// array comes through here, only the first branch is applied to this
// existing row — changing which/how many branches a saved holiday applies
// to isn't supported via update; delete and re-add for that.
export const updateHoliday = async (id: number, userId: number, input: UpdateHolidayInput) => {
  const holiday = await findHolidayOwnedBy(id, userId);
  if (!holiday) {
    throw new ServiceError("Holiday not found");
  }

  const { holidayName, holidayDate, holidayType, branchId, description } = input;
  const resolvedBranchId = Array.isArray(branchId) ? branchId[0] : branchId;
  if (resolvedBranchId !== undefined && isNaN(Number(resolvedBranchId))) {
    throw new ServiceError("Invalid branchId value");
  }

  if (holidayName !== undefined) (holiday as any).holidayName = holidayName;
  if (holidayDate !== undefined) (holiday as any).holidayDate = holidayDate;
  if (holidayType !== undefined) (holiday as any).holidayType = holidayType;
  if (resolvedBranchId !== undefined) (holiday as any).branchId = Number(resolvedBranchId);
  if (description !== undefined) (holiday as any).description = description;
  // companyId is intentionally not editable here.

  await holiday.save();
  return holiday;
};

export const listHolidays = async (params: {
  userId: number;
  role?: string;
  page: number;
  limit: number;
  search?: string;
  branchId?: string;
  companyId?: string;
}) => {
  const limit = Math.min(params.limit, 50);
  const offset = (params.page - 1) * limit;

  if (params.companyId) {
    const allowed = await hasCompanyAccess(Number(params.companyId), params.userId, params.role);
    if (!allowed) throw new ServiceError("You do not have access to this company", 403);
  }

  const { count, rows } = await findHolidays({
    userId: params.userId,
    search: params.search,
    branchId: params.branchId,
    companyId: params.companyId,
    limit,
    offset,
  });

  return {
    total: count,
    page: params.page,
    limit,
    totalPages: Math.ceil(count / limit),
    data: rows,
  };
};

export const getHolidayById = async (id: number, userId: number) => {
  const holiday = await findHolidayOwnedBy(id, userId);
  if (!holiday) {
    throw new ServiceError("Holiday not found");
  }
  return holiday;
};
