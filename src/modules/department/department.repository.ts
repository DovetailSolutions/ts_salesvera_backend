import { Op } from "sequelize";
import { Department } from "../../config/dbConnection";

// ============================================================
// Department repository — wraps all direct Sequelize access for this domain.
// ============================================================

export interface DepartmentCreateRow {
  deptName: string;
  deptCode: string;
  deptHead: string;
  branchId: number;
  shiftId: number | null;
  maxHeadcount: number;
  halfSaturday?: boolean;
  workingDays: string[] | null;
  customWorkingDays: boolean;
  adminId?: number | null;
  managerId?: number | null;
  userId: number;
  companyId: number | null;
}

export const createDepartment = (row: DepartmentCreateRow) => Department.create(row as any);

// Plain lookup by id — access is checked separately in the service layer
// via hasCompanyAccess (see assertDepartmentAccess), the same
// company-scoped check listDepartments already uses. The old
// findDepartmentOwnedBy(id, userId) filtered `WHERE id = ? AND userId = ?`
// directly in SQL — but Department.userId is only ever stamped with the
// tenant "user" who originally created the row (never admin/managerId), so
// any admin/manager updating or fetching-by-id a department they didn't
// personally create got "Department not found" even though it's their own
// company's department and shows up fine in their department list.
export const findDepartmentById = (id: number) => Department.findByPk(id);

export const findDepartments = (params: {
  userId: number;
  search?: string;
  branchId?: string | number;
  companyId?: string | number;
  limit: number;
  offset: number;
}) => {
  // FIX: Department rows are only ever stamped with the tenant "user"'s id
  // at creation — admin/managerId are never populated — so scoping by
  // userId alone matched nothing for an admin/manager viewing their own
  // company's departments, while a "user" who owns multiple companies
  // matched every department across all of them. When companyId is given,
  // the caller's access to it has already been verified by the service
  // layer (see shared/companyAccess.ts) — scope by companyId alone. Fall
  // back to the legacy userId-only check only when no companyId is supplied.
  const where: any = params.companyId ? { companyId: params.companyId } : { userId: params.userId };

  if (params.search) {
    where[Op.or] = [
      { deptName: { [Op.like]: `%${params.search}%` } },
      { deptCode: { [Op.like]: `%${params.search}%` } },
    ];
  }
  if (params.branchId) where.branchId = params.branchId;

  return Department.findAndCountAll({
    attributes: ["id", "deptName", "deptCode", "deptHead", "branchId", "shiftId", "maxHeadcount", "companyId", "createdAt"],
    where,
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });
};
