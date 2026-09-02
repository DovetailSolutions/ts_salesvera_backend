import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import { Branch } from "../../config/dbConnection";
import {
  createDepartment,
  findDepartmentById,
  findDepartments,
} from "./department.repository";

// A Department must always be attached to a Branch that actually exists —
// and, when a companyId is supplied, to a Branch that actually belongs to
// that company. Neither of these was ever checked: addDepartment/
// updateDepartment accepted any numeric branchId, so a stale/deleted/
// cross-company branchId (or one belonging to another tenant entirely)
// still returned "success" and persisted a Department row that could never
// resolve a real Branch. This looks up the branch once and returns it so
// the caller can also backfill companyId from it when the request omitted one.
const requireValidBranch = async (branchId: number, companyId?: number | null) => {
  const branch = await (Branch as any).findByPk(Number(branchId));
  if (!branch) throw new ServiceError("Branch not found");
  if (companyId && Number(branch.companyId) !== Number(companyId)) {
    throw new ServiceError("Branch does not belong to the specified company", 403);
  }
  return branch;
};

// Same company-scoped check listDepartments already uses (hasCompanyAccess),
// applied here so updateDepartment/getDepartmentById stop relying on the
// unreliable per-row userId ownership stamp. Falls back to that legacy
// stamp only for rows with no companyId at all (created before companyId
// was reliably backfilled).
const assertDepartmentAccess = async (department: any, userId: number, role?: string) => {
  if (department.companyId) {
    const allowed = await hasCompanyAccess(Number(department.companyId), userId, role);
    if (!allowed) throw new ServiceError("Department not found");
    return;
  }
  if (Number(department.userId) !== Number(userId)) throw new ServiceError("Department not found");
};

// ============================================================
// Department service — validation + orchestration. Byte-for-byte port of
// the previous addDepartment/updateDepartment/getDepartment/
// getDepartmentById controller bodies in admin.ts.
// ============================================================

export const addDepartment = async (userId: number, body: any) => {
  const {
    deptName, deptCode, deptHead, branchId, shiftId, maxHeadcount,
    halfSaturday, workingDays, customWorkingDays, adminId, managerId, companyId,
  } = body;

  if (!deptName || deptName.trim().length < 2) throw new ServiceError("Department name is required");
  if (!deptCode || deptCode.trim().length < 2) throw new ServiceError("Department code is required");
  if (!deptHead || deptHead.trim().length < 2) throw new ServiceError("Department head is required");
  if (!branchId || isNaN(Number(branchId))) throw new ServiceError("Valid branchId is required");

  // shiftId is optional — Step4.jsx's UI explicitly offers "Inherit / No
  // Default" as a valid choice (no shift assigned).
  if (shiftId !== undefined && shiftId !== null && shiftId !== "" && isNaN(Number(shiftId))) {
    throw new ServiceError("shiftId must be a number");
  }
  if (!maxHeadcount || isNaN(Number(maxHeadcount))) throw new ServiceError("Valid maxHeadcount is required");

  // Validate the branch exists (and, if a companyId was given, that it's
  // actually this company's branch) BEFORE persisting — a Department row
  // must never be created against a dangling/foreign branchId. Backfill
  // companyId from the branch itself when the caller didn't send one, so
  // every Department ends up correctly tenant-scoped instead of null.
  const branch = await requireValidBranch(branchId, companyId ? Number(companyId) : null);
  const resolvedCompanyId = companyId ? Number(companyId) : (branch.companyId ?? null);

  return createDepartment({
    deptName,
    deptCode,
    deptHead,
    branchId,
    shiftId: shiftId || null,
    maxHeadcount,
    halfSaturday,
    workingDays: Array.isArray(workingDays) ? workingDays : null,
    customWorkingDays: !!customWorkingDays,
    adminId,
    managerId,
    userId,
    companyId: resolvedCompanyId,
  });
};

export const updateDepartment = async (id: number, userId: number, role: string | undefined, input: any) => {
  const department = await findDepartmentById(id);
  if (!department) throw new ServiceError("Department not found");
  await assertDepartmentAccess(department, userId, role);

  const {
    deptName, deptCode, deptHead, branchId, shiftId, maxHeadcount,
    halfSaturday, workingDays, customWorkingDays,
  } = input;

  if (shiftId !== undefined && shiftId !== null && shiftId !== "" && isNaN(Number(shiftId))) {
    throw new ServiceError("shiftId must be a number");
  }

  const d = department as any;
  if (deptName !== undefined) d.deptName = deptName;
  if (deptCode !== undefined) d.deptCode = deptCode;
  if (deptHead !== undefined) d.deptHead = deptHead;
  if (branchId !== undefined) {
    // Re-validate on every branch change — moving a department to a
    // different branch is exactly the case that previously let a dangling
    // or cross-company branchId slip in silently.
    await requireValidBranch(branchId, d.companyId ?? null);
    d.branchId = Number(branchId);
  }
  if (shiftId !== undefined) d.shiftId = shiftId || null;
  if (maxHeadcount !== undefined) d.maxHeadcount = Number(maxHeadcount);
  if (halfSaturday !== undefined) d.halfSaturday = !!halfSaturday;
  if (workingDays !== undefined) d.workingDays = Array.isArray(workingDays) ? workingDays : null;
  if (customWorkingDays !== undefined) d.customWorkingDays = !!customWorkingDays;
  // companyId is intentionally not editable here.

  await department.save();
  return department;
};

export const listDepartments = async (params: {
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

  const { count, rows } = await findDepartments({
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

export const getDepartmentById = async (id: number, userId: number, role?: string) => {
  const department = await findDepartmentById(id);
  if (!department) throw new ServiceError("Department not found");
  await assertDepartmentAccess(department, userId, role);
  return department;
};
