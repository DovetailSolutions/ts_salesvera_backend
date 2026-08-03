"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCompanyWithFullDetail = exports.findUserWithProfileIncludes = exports.updateUserFields = exports.findUserPermissionsWithPermission = exports.findAllPermissions = exports.findCompanyAdminAssignmentFor = exports.findCompanyAdminAssignment = exports.findCompanyByIdAndManagerOwner = exports.findCompanyManagerAssignmentFor = exports.findCompanyByIdAndAdmin = exports.findFirstUserPermissionCompany = exports.findCompanyByUserId = exports.findCompanyManagerAssignment = exports.findCompanyByAdminId = exports.grantPermission = exports.findUserPermissionsForUser = exports.findPermissionsByIds = exports.findUserByRoleAndId = exports.findUserWithCreatedUsers = exports.createUser = exports.findUserById = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
// ============================================================
// Auth repository — wraps all direct Sequelize access for this domain.
// Covers Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword/
// forgotPassword/verifyOtp/changePassword.
// ============================================================
const findUserById = (id, attributes) => dbConnection_1.User.findByPk(id, attributes ? { attributes } : undefined);
exports.findUserById = findUserById;
const createUser = (row) => dbConnection_1.User.create(row);
exports.createUser = createUser;
const findUserWithCreatedUsers = (id) => dbConnection_1.User.findByPk(id, {
    include: [{ model: dbConnection_1.User, as: "createdUsers", attributes: ["id"], through: { attributes: [] } }],
});
exports.findUserWithCreatedUsers = findUserWithCreatedUsers;
const findUserByRoleAndId = (id, role) => dbConnection_1.User.findOne({ where: { id, role }, attributes: ["id"] });
exports.findUserByRoleAndId = findUserByRoleAndId;
const findPermissionsByIds = (ids) => dbConnection_1.Permission.findAll({ where: { id: { [sequelize_1.Op.in]: ids } }, attributes: ["id"] });
exports.findPermissionsByIds = findPermissionsByIds;
const findUserPermissionsForUser = (userId) => dbConnection_1.UserPermission.findAll({ where: { userId }, attributes: ["permissionId"] });
exports.findUserPermissionsForUser = findUserPermissionsForUser;
const grantPermission = (params) => dbConnection_1.UserPermission.findOrCreate({
    where: { userId: params.userId, permissionId: params.permissionId, companyId: params.companyId },
    defaults: {
        userId: params.userId,
        permissionId: params.permissionId,
        companyId: params.companyId,
        grantedBy: params.grantedBy,
    },
});
exports.grantPermission = grantPermission;
const findCompanyByAdminId = (adminId) => dbConnection_1.Company.findOne({ where: { adminId }, attributes: ["id"] });
exports.findCompanyByAdminId = findCompanyByAdminId;
const findCompanyManagerAssignment = (managerId) => dbConnection_1.CompanyManager.findOne({ where: { managerId }, attributes: ["companyId"] });
exports.findCompanyManagerAssignment = findCompanyManagerAssignment;
const findCompanyByUserId = (userId) => dbConnection_1.Company.findOne({ where: { userId }, attributes: ["id"] });
exports.findCompanyByUserId = findCompanyByUserId;
const findFirstUserPermissionCompany = (userId) => dbConnection_1.UserPermission.findOne({ where: { userId }, attributes: ["companyId"] });
exports.findFirstUserPermissionCompany = findFirstUserPermissionCompany;
const findCompanyByIdAndAdmin = (id, adminId) => dbConnection_1.Company.findOne({ where: { id, adminId }, attributes: ["id"] });
exports.findCompanyByIdAndAdmin = findCompanyByIdAndAdmin;
const findCompanyManagerAssignmentFor = (companyId, managerId) => dbConnection_1.CompanyManager.findOne({ where: { companyId, managerId }, attributes: ["id"] });
exports.findCompanyManagerAssignmentFor = findCompanyManagerAssignmentFor;
const findCompanyByIdAndManagerOwner = (id, managerId) => dbConnection_1.Company.findOne({ where: { id, managerId }, attributes: ["id"] });
exports.findCompanyByIdAndManagerOwner = findCompanyByIdAndManagerOwner;
// Multi-company admin support (mirrors the CompanyManager lookups above)
const findCompanyAdminAssignment = (adminId) => dbConnection_1.CompanyAdmin.findOne({ where: { adminId }, attributes: ["companyId"] });
exports.findCompanyAdminAssignment = findCompanyAdminAssignment;
const findCompanyAdminAssignmentFor = (companyId, adminId) => dbConnection_1.CompanyAdmin.findOne({ where: { companyId, adminId }, attributes: ["id"] });
exports.findCompanyAdminAssignmentFor = findCompanyAdminAssignmentFor;
const findAllPermissions = (ordered) => ordered
    ? dbConnection_1.Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] })
    : dbConnection_1.Permission.findAll({ attributes: ["module", "action"] });
exports.findAllPermissions = findAllPermissions;
// FIX: previously filtered by { userId, companyId } — but permission grants
// (assignPermissions in permission.ts) are written without a companyId (that
// column is left null), so the exact-match filter silently returned zero
// rows for every manager/sale_person, even ones with permissions actually
// assigned. loadUserPermissionsFromDB in checkPermission.ts (the real
// enforcement gate used on every protected route) already queries by userId
// alone — this brings the login/getProfile response in line with that same,
// already-correct behavior instead of two divergent sources of truth.
const findUserPermissionsWithPermission = (userId) => dbConnection_1.UserPermission.findAll({
    where: { userId },
    include: [{ model: dbConnection_1.Permission, as: "permission", attributes: ["module", "action"] }],
});
exports.findUserPermissionsWithPermission = findUserPermissionsWithPermission;
const updateUserFields = (id, fields) => dbConnection_1.User.update(fields, { where: { id } });
exports.updateUserFields = updateUserFields;
const findUserWithProfileIncludes = (id, role, includeCompanyRelations) => {
    const companyIncludes = [
        { model: dbConnection_1.Branch, as: "branches" },
        { model: dbConnection_1.Shift, as: "shifts" },
        { model: dbConnection_1.Department, as: "departments" },
        { model: dbConnection_1.CompanyLeave, as: "companyLeaves" },
        { model: dbConnection_1.CompanyBank, as: "companyBanks" },
    ];
    const include = [{ model: dbConnection_1.Branch, as: "branch" }];
    if (includeCompanyRelations) {
        include.push({ model: dbConnection_1.Company, as: "company", include: companyIncludes });
    }
    return dbConnection_1.User.findByPk(id, { include });
};
exports.findUserWithProfileIncludes = findUserWithProfileIncludes;
const findCompanyWithFullDetail = (companyId) => {
    const companyIncludes = [
        { model: dbConnection_1.Branch, as: "branches" },
        { model: dbConnection_1.Shift, as: "shifts" },
        { model: dbConnection_1.Department, as: "departments" },
        { model: dbConnection_1.CompanyLeave, as: "companyLeaves" },
        { model: dbConnection_1.CompanyBank, as: "companyBanks" },
    ];
    return dbConnection_1.Company.findByPk(companyId, { include: companyIncludes });
};
exports.findCompanyWithFullDetail = findCompanyWithFullDetail;
