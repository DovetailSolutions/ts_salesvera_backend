import { Op } from "sequelize";
import { Holiday } from "../../config/dbConnection";

// ============================================================
// Holiday repository — wraps all direct Sequelize access for this domain.
// Nothing here knows about HTTP; it only knows about the Holiday model.
// ============================================================

export interface HolidayRow {
  holidayName: string;
  holidayDate: string;
  holidayType: string;
  branchId: number;
  description: string | null;
  adminId: number | null;
  managerId: number | null;
  userId: number;
  companyId: number | null;
}

export const bulkCreateHolidays = (rows: HolidayRow[]) => Holiday.bulkCreate(rows as any);

export const findHolidayOwnedBy = (id: number, userId: number) =>
  Holiday.findOne({ where: { id, userId } });

export const findHolidays = (params: {
  userId: number;
  search?: string;
  branchId?: string | number;
  companyId?: string | number;
  limit: number;
  offset: number;
}) => {
  // FIX: Holiday rows are only ever stamped with the tenant "user"'s id at
  // creation — admin/managerId are never populated — so scoping by userId
  // alone matched nothing for an admin/manager viewing their own company's
  // holidays (this is why the holiday calendar appeared completely broken
  // for admin/manager accounts), while a "user" who owns multiple companies
  // matched every holiday across all of them. When companyId is given, the
  // caller's access to it has already been verified by the service layer
  // (see shared/companyAccess.ts) — scope by companyId alone. Fall back to
  // the legacy userId-only check only when no companyId is supplied.
  const where: any = params.companyId ? { companyId: params.companyId } : { userId: params.userId };

  if (params.search) {
    where[Op.or] = [
      { holidayName: { [Op.like]: `%${params.search}%` } },
      { holidayType: { [Op.like]: `%${params.search}%` } },
    ];
  }
  if (params.branchId) where.branchId = params.branchId;

  return Holiday.findAndCountAll({
    where,
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });
};
