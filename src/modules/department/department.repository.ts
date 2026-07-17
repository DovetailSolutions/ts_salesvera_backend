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

export const findDepartmentOwnedBy = (id: number, userId: number) =>
  Department.findOne({ where: { id, userId } });

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
    where,
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });
};
