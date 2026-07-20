import { Op } from "sequelize";
import { Branch } from "../../config/dbConnection";

// ============================================================
// Branch repository — wraps all direct Sequelize access for this domain.
// ============================================================

export interface BranchCreateRow {
  branchName: string;
  branchCode: string;
  branchCity: string;
  branchState: string;
  branchCountry: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string | null;
  branchEmail?: string;
  branchPhone?: string;
  latitude: number;
  longitude: number;
  geoRadius: number;
  adminId: number | null;
  managerId: number | null;
  userId: number;
  companyId: number;
}

export const createBranch = (row: BranchCreateRow) => Branch.create(row as any);

export const findBranchOwnedBy = (id: number, userId: number) =>
  Branch.findOne({ where: { id, userId } });

export const findBranches = (params: { userId: number; companyId?: string | number; search?: string; limit: number; offset: number }) => {
  // FIX: previously scoped ownership only (userId/adminId/managerId), never
  // companyId — so a tenant owner with more than one company saw every
  // company's branches mixed together in one list. Also, adminId/managerId
  // are never actually populated on a Branch row at creation time (only
  // userId, always the tenant owner) — so this same ownership check
  // silently matched *nothing* for an admin/manager looking at their own
  // company's branches. When companyId is given, the caller's access to it
  // has already been verified by the service layer (see
  // shared/companyAccess.ts) — scope by companyId alone, which is always
  // reliably set, instead of the unreliable per-row ownership stamps.
  // Fall back to the legacy ownership-only check only when no companyId is
  // supplied at all.
  let where: any;
  if (params.companyId) {
    where = { companyId: params.companyId };
  } else {
    where = { [Op.or]: [{ userId: params.userId }, { adminId: params.userId }, { managerId: params.userId }] };
  }

  if (params.search) {
    const searchClause = {
      [Op.or]: [
        { branchName: { [Op.like]: `%${params.search}%` } },
        { branchCode: { [Op.like]: `%${params.search}%` } },
        { branchCity: { [Op.like]: `%${params.search}%` } },
        { branchState: { [Op.like]: `%${params.search}%` } },
        { branchCountry: { [Op.like]: `%${params.search}%` } },
        { postalCode: { [Op.like]: `%${params.search}%` } },
        { addressLine1: { [Op.like]: `%${params.search}%` } },
        { addressLine2: { [Op.like]: `%${params.search}%` } },
        { branchEmail: { [Op.like]: `%${params.search}%` } },
        { branchPhone: { [Op.like]: `%${params.search}%` } },
      ],
    };
    where = { [Op.and]: [where, searchClause] };
  }

  return Branch.findAndCountAll({
    where,
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });
};
