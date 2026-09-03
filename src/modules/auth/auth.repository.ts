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
  const userAttributes = [
    "id", "employeeCode", "firstName", "lastName", "email", "phone", "dob", "profile",
    "role", "status", "branchId", "departmentId", "shiftId", "tenantId", "createdBy",
    "canViewAllBranches", "tallyGuid", "tallyName", "tallyStartDate", "createdAt", "updatedAt"
  ];

  if (role === "super_admin") {
    return User.findByPk(id, { attributes: userAttributes });
  }

  const companyIncludes = [
    { model: Branch, as: "branches", attributes: ["id", "branchName", "branchCode", "branchCity", "branchState", "branchCountry", "postalCode", "addressLine1", "addressLine2", "branchEmail", "branchPhone", "latitude", "longitude", "geoRadius", "companyId"] },
    { model: Shift, as: "shifts", attributes: ["id", "shiftName", "shiftCode", "startTime", "endTime", "fullDayHours", "nightShift", "breakMinutes", "workingHours", "lateMarkAfter", "halfDayAfter", "branchId", "companyId"] },
    { model: Department, as: "departments", attributes: ["id", "deptName", "deptCode", "deptHead", "branchId", "shiftId", "maxHeadcount", "companyId"] },
    { model: CompanyLeave, as: "companyLeaves", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear", "carryForward", "status", "companyId"] },
    { model: CompanyBank, as: "companyBanks", attributes: ["id", "bankName", "bankAccountNumber", "bankIfsc", "bankBranchName", "bankAccountHolder", "companyId"] },
  ];

  const include: any[] = [
    { model: Branch, as: "branch", attributes: ["id", "branchName", "branchCode", "latitude", "longitude", "geoRadius"] },
    { model: Department, as: "department", attributes: ["id", "deptName", "deptCode"] }
  ];

  if (includeCompanyRelations) {
    include.push({
      model: Company,
      as: "company",
      attributes: ["id", "companyName", "legalName", "registrationNo", "companyEmail", "companyPhone", "industry", "companySize", "userId", "adminId"],
      include: companyIncludes
    });
  }

  return User.findByPk(id, { attributes: userAttributes, include });
};

export const findCompanyWithFullDetail = (companyId: number) => {
  const companyIncludes = [
    { model: Branch, as: "branches", attributes: ["id", "branchName", "branchCode", "branchCity", "branchState", "branchCountry", "postalCode", "addressLine1", "addressLine2", "branchEmail", "branchPhone", "latitude", "longitude", "geoRadius", "companyId"] },
    { model: Shift, as: "shifts", attributes: ["id", "shiftName", "shiftCode", "startTime", "endTime", "fullDayHours", "nightShift", "breakMinutes", "workingHours", "lateMarkAfter", "halfDayAfter", "branchId", "companyId"] },
    { model: Department, as: "departments", attributes: ["id", "deptName", "deptCode", "deptHead", "branchId", "shiftId", "maxHeadcount", "companyId"] },
    { model: CompanyLeave, as: "companyLeaves", attributes: ["id", "leaveName", "leaveCode", "leavesPerYear", "carryForward", "status", "companyId"] },
    { model: CompanyBank, as: "companyBanks", attributes: ["id", "bankName", "bankAccountNumber", "bankIfsc", "bankBranchName", "bankAccountHolder", "companyId"] },
  ];
  return Company.findByPk(companyId, {
    attributes: ["id", "companyName", "legalName", "registrationNo", "companyEmail", "companyPhone", "industry", "companySize", "userId", "adminId"],
    include: companyIncludes
  });
};
