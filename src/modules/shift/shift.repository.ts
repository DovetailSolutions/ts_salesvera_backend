import { Op } from "sequelize";
import { Company, Shift } from "../../config/dbConnection";

// ============================================================
// Shift repository — wraps all direct Sequelize access for this domain
// (plus the one Company read/update addShift bundles in for company-wide
// attendance policy, since that's what the registration wizard's request
// shape actually carries).
// ============================================================

export interface ShiftCreateRow {
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  fullDayHours: number;
  nightShift: boolean;
  breakMinutes: number;
  workingHours: number;
  lateMarkAfter: number;
  halfDayAfter: number;
  branchId: number;
  companyId: number;
  userId: number;
}

export const createShift = (row: ShiftCreateRow) => Shift.create(row as any);

export const findShiftOwnedBy = (id: number, userId: number) =>
  Shift.findOne({ where: { id, userId } });

export const findShifts = (params: {
  userId: number;
  search?: string;
  branchId?: string | number;
  companyId?: string | number;
  limit: number;
  offset: number;
}) => {
  // FIX: Shift rows are only ever stamped with the tenant "user"'s id at
  // creation — admin/managerId are never populated — so scoping by userId
  // alone matched nothing for an admin/manager viewing their own company's
  // shifts, while a "user" who owns multiple companies matched every shift
  // across all of them. When companyId is given, the caller's access to it
  // has already been verified by the service layer (see
  // shared/companyAccess.ts) — scope by companyId alone. Fall back to the
  // legacy userId-only check only when no companyId is supplied.
  const where: any = params.companyId ? { companyId: params.companyId } : { userId: params.userId };

  if (params.search) {
    where[Op.or] = [
      { shiftName: { [Op.like]: `%${params.search}%` } },
      { shiftCode: { [Op.like]: `%${params.search}%` } },
    ];
  }
  if (params.branchId) where.branchId = params.branchId;

  return Shift.findAndCountAll({
    where,
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });
};

export const findCompanyById = (id: number) => Company.findByPk(id);
