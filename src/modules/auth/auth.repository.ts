import { Op } from "sequelize";
import {
  User,
  Company,
  CompanyManager,
  CompanyAdmin,
  Branch,
  Shift,
  Department,
  CompanyLeave,
  CompanyBank,
  Permission,
  UserPermission,
} from "../../config/dbConnection";

// ============================================================
// Auth repository — wraps all direct Sequelize access for this domain.
// Covers Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword/
// forgotPassword/verifyOtp/changePassword.
// ============================================================

export const findUserById = (id: number, attributes?: string[]) =>
  User.findByPk(id, attributes ? { attributes } : undefined);

export const createUser = (row: any) => User.create(row);

export const findUserWithCreatedUsers = (id: number) =>
  User.findByPk(id, {
    include: [{ model: User, as: "createdUsers", attributes: ["id"], through: { attributes: [] } }],
  });

export const findUserByRoleAndId = (id: number, role: string) =>
  User.findOne({ where: { id, role }, attributes: ["id"] });

export const findPermissionsByIds = (ids: number[]) =>
  Permission.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id"] });

export const findUserPermissionsForUser = (userId: number) =>
  UserPermission.findAll({ where: { userId }, attributes: ["permissionId"] });

export const grantPermission = (params: {
  userId: number;
  permissionId: number;
  companyId: number | null;
  grantedBy: number;
}) =>
  UserPermission.findOrCreate({
    where: { userId: params.userId, permissionId: params.permissionId, companyId: params.companyId },
    defaults: {
      userId: params.userId,
      permissionId: params.permissionId,
      companyId: params.companyId,
      grantedBy: params.grantedBy,
    },
  });

export const findCompanyByAdminId = (adminId: number) =>
  (Company as any).findOne({ where: { adminId }, attributes: ["id"] });

export const findCompanyManagerAssignment = (managerId: number) =>
  (CompanyManager as any).findOne({ where: { managerId }, attributes: ["companyId"] });

export const findCompanyByUserId = (userId: number) =>
  (Company as any).findOne({ where: { userId }, attributes: ["id"] });

export const findFirstUserPermissionCompany = (userId: number) =>
  UserPermission.findOne({ where: { userId }, attributes: ["companyId"] });

export const findCompanyByIdAndAdmin = (id: number, adminId: number) =>
  (Company as any).findOne({ where: { id, adminId }, attributes: ["id"] });

export const findCompanyManagerAssignmentFor = (companyId: number, managerId: number) =>
  (CompanyManager as any).findOne({ where: { companyId, managerId }, attributes: ["id"] });

export const findCompanyByIdAndManagerOwner = (id: number, managerId: number) =>
  (Company as any).findOne({ where: { id, managerId }, attributes: ["id"] });

// Multi-company admin support (mirrors the CompanyManager lookups above)
export const findCompanyAdminAssignment = (adminId: number) =>
  (CompanyAdmin as any).findOne({ where: { adminId }, attributes: ["companyId"] });

export const findCompanyAdminAssignmentFor = (companyId: number, adminId: number) =>
  (CompanyAdmin as any).findOne({ where: { companyId, adminId }, attributes: ["id"] });

export const findAllPermissions = (ordered?: boolean) =>
  ordered
    ? Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] })
    : Permission.findAll({ attributes: ["module", "action"] });

// FIX: previously filtered by { userId, companyId } — but permission grants
// (assignPermissions in permission.ts) are written without a companyId (that
// column is left null), so the exact-match filter silently returned zero
// rows for every manager/sale_person, even ones with permissions actually
// assigned. loadUserPermissionsFromDB in checkPermission.ts (the real
// enforcement gate used on every protected route) already queries by userId
// alone — this brings the login/getProfile response in line with that same,
// already-correct behavior instead of two divergent sources of truth.
export const findUserPermissionsWithPermission = (userId: number) =>
  UserPermission.findAll({
    where: { userId },
    include: [{ model: Permission, as: "permission", attributes: ["module", "action"] }],
  });

export const updateUserFields = (id: number, fields: any) => User.update(fields, { where: { id } });

export const findUserWithProfileIncludes = (id: number, role: string, includeCompanyRelations: boolean) => {
  const companyIncludes = [
    { model: Branch, as: "branches" },
    { model: Shift, as: "shifts" },
    { model: Department, as: "departments" },
    { model: CompanyLeave, as: "companyLeaves" },
    { model: CompanyBank, as: "companyBanks" },
  ];

  const include: any[] = [{ model: Branch, as: "branch" }];
  if (includeCompanyRelations) {
    include.push({ model: Company, as: "company", include: companyIncludes });
  }

  return User.findByPk(id, { include });
};

export const findCompanyWithFullDetail = (companyId: number) => {
  const companyIncludes = [
    { model: Branch, as: "branches" },
    { model: Shift, as: "shifts" },
    { model: Department, as: "departments" },
    { model: CompanyLeave, as: "companyLeaves" },
    { model: CompanyBank, as: "companyBanks" },
  ];
  return Company.findByPk(companyId, { include: companyIncludes });
};
