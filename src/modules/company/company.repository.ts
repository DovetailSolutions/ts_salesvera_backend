import { Op } from "sequelize";
import {
  Company,
  CompanyManager,
  CompanyAdmin,
  CompanyBank,
  Branch,
  Shift,
  Department,
  CompanyLeave,
  User,
  UserPermission,
} from "../../config/dbConnection";

// ============================================================
// Company repository — wraps all direct Sequelize access for this domain.
// ============================================================

export const createCompany = (row: any) => Company.create(row);

export const findCreatorPermissions = (userId: number) =>
  UserPermission.findAll({ where: { userId }, attributes: ["permissionId"] });

export const grantPermissionToAdminForCompany = (params: {
  adminId: number;
  permissionId: number;
  companyId: number;
  grantedBy: number;
}) =>
  UserPermission.findOrCreate({
    where: { userId: params.adminId, permissionId: params.permissionId, companyId: params.companyId },
    defaults: {
      userId: params.adminId,
      permissionId: params.permissionId,
      companyId: params.companyId,
      grantedBy: params.grantedBy,
    },
  });

export const findCompaniesPaginated = (params: {
  userId: number;
  search?: string;
  limit: number;
  offset: number;
}) => {
  let where: any = { userId: params.userId };
  if (params.search) {
    where = {
      ...where,
      [Op.or]: [
        { companyName: { [Op.like]: `%${params.search}%` } },
        { legalName: { [Op.like]: `%${params.search}%` } },
        { companyEmail: { [Op.like]: `%${params.search}%` } },
        { companyPhone: { [Op.like]: `%${params.search}%` } },
      ],
    };
  }
  return Company.findAndCountAll({
    where,
    limit: params.limit,
    offset: params.offset,
    order: [["createdAt", "DESC"]],
  });
};

export const findCompanyOwnedBy = (id: number | string, userId: number) =>
  Company.findOne({ where: { id, userId } });

// Plain lookup with no ownership filter — used once the caller's access has
// already been verified via shared/companyAccess.ts's hasCompanyAccess,
// which (unlike this repo's userId-only checks) also accounts for admins
// via CompanyAdmin, managers via CompanyManager, and super_admin.
export const findCompanyByIdOnly = (id: number | string) =>
  Company.findByPk(id);

// Read-only attendance/leave policy fields only — deliberately excludes
// legal/financial columns (GST, PAN, registration no, bank details) that a
// manager reading "the rules that apply to my team" (Settings module's
// Company Policy tab) shouldn't need or see; that full record stays behind
// the ADMIN_ONLY getcompany/:id endpoint.
export const findCompanyPolicyFields = (id: number | string) =>
  Company.findByPk(id, {
    attributes: [
      "id", "companyName",
      "lateMarkAfter", "autoHalfDayAfter",
      "geoFencingRequired", "officeLocationRequired", "overtimeAllowed",
      "companyWorkingDays", "halfSaturday", "altSaturday",
      "casualHolidaysTotal", "casualHolidaysPerMonth", "casualHolidayNotice",
      "casualHolidayApprovalRequired", "casualHolidayCarryForward",
      "casualCarryForwardLimit", "casualCarryForwardExpiry",
      "compOffMinHours", "compOffExpiryDays", "compOffApprovalRequired",
    ],
  });

export const findCompanyOwnedOrAdminBy = (id: number | string, userId: number) =>
  Company.findOne({ where: { id, [Op.or]: [{ adminId: userId }, { userId }] } });

export const findManagerById = (managerId: number) =>
  User.findOne({ where: { id: managerId, role: "manager" } });

export const findOrCreateCompanyManager = (companyId: number, managerId: number) =>
  (CompanyManager as any).findOrCreate({
    where: { companyId, managerId },
    defaults: { companyId, managerId },
  });

export const destroyCompanyManager = (companyId: number, managerId: number) =>
  (CompanyManager as any).destroy({ where: { companyId, managerId } });

export const findCompanyManagers = (companyId: number) =>
  (CompanyManager as any).findAll({
    where: { companyId },
    include: [{ model: User, as: "manager", attributes: ["id", "firstName", "lastName", "email", "phone"] }],
  });

export const findManagerCompanyAssignments = (managerId: number) =>
  (CompanyManager as any).findAll({
    where: { managerId },
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "companyName", "legalName", "companyEmail", "companyPhone", "city"],
      },
    ],
  });

export const findManagerCompanyAssignment = (companyId: number, managerId: number) =>
  (CompanyManager as any).findOne({
    where: { companyId, managerId },
    include: [{ model: Company, as: "company", attributes: ["id", "companyName"] }],
  });

export const updateUserRefreshToken = (userId: number, refreshToken: string) =>
  User.update({ refreshToken }, { where: { id: userId } });

// ── Multi-company admin support (mirrors the CompanyManager functions above) ──
export const findAdminById = (adminId: number) =>
  User.findOne({ where: { id: adminId, role: "admin" } });

export const findOrCreateCompanyAdmin = (companyId: number, adminId: number) =>
  (CompanyAdmin as any).findOrCreate({
    where: { companyId, adminId },
    defaults: { companyId, adminId },
  });

export const destroyCompanyAdmin = (companyId: number, adminId: number) =>
  (CompanyAdmin as any).destroy({ where: { companyId, adminId } });

export const findCompanyAdmins = (companyId: number) =>
  (CompanyAdmin as any).findAll({
    where: { companyId },
    include: [{ model: User, as: "admin", attributes: ["id", "firstName", "lastName", "email", "phone"] }],
  });

export const findAdminCompanyAssignments = (adminId: number) =>
  (CompanyAdmin as any).findAll({
    where: { adminId },
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "companyName", "legalName", "companyEmail", "companyPhone", "city"],
      },
    ],
  });

export const findAdminCompanyAssignment = (companyId: number, adminId: number) =>
  (CompanyAdmin as any).findOne({
    where: { companyId, adminId },
    include: [{ model: Company, as: "company", attributes: ["id", "companyName"] }],
  });

export const findCompaniesWithFullDetail = (userId: number) =>
  Company.findAll({
    where: { userId },
    include: [
      { model: Branch, as: "branches" },
      { model: Shift, as: "shifts" },
      { model: Department, as: "departments" },
      { model: CompanyLeave, as: "companyLeaves" },
      { model: CompanyBank, as: "companyBanks" },
    ],
  });

export const bulkCreateCompanyBanks = (rows: any[]) => CompanyBank.bulkCreate(rows);
