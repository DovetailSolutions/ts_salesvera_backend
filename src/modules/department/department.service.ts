import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import {
  createDepartment,
  findDepartmentOwnedBy,
  findDepartments,
} from "./department.repository";

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
    companyId: companyId || null,
  });
};

export const updateDepartment = async (id: number, userId: number, input: any) => {
  const department = await findDepartmentOwnedBy(id, userId);
  if (!department) throw new ServiceError("Department not found");

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
  if (branchId !== undefined) d.branchId = Number(branchId);
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

export const getDepartmentById = async (id: number, userId: number) => {
  const department = await findDepartmentOwnedBy(id, userId);
  if (!department) throw new ServiceError("Department not found");
  return department;
};
