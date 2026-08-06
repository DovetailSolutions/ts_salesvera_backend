"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkCreateCompanyBanks = exports.findCompaniesWithFullDetail = exports.findAdminCompanyAssignment = exports.findOwnedCompaniesByAdminId = exports.findAdminCompanyAssignments = exports.findCompanyAdmins = exports.destroyCompanyAdmin = exports.findOrCreateCompanyAdmin = exports.findAdminById = exports.updateUserRefreshToken = exports.findManagerCompanyAssignment = exports.findManagerCompanyAssignments = exports.findCompanyManagers = exports.destroyCompanyManager = exports.findOrCreateCompanyManager = exports.findManagerById = exports.findCompanyOwnedOrAdminBy = exports.findCompanyPolicyFields = exports.findCompanyByIdOnly = exports.countCompanyDependents = exports.findCompanyOwnedBy = exports.findCompaniesPaginated = exports.grantPermissionToAdminForCompany = exports.findCreatorPermissions = exports.createCompany = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
// ============================================================
// Company repository — wraps all direct Sequelize access for this domain.
// ============================================================
const createCompany = (row) => dbConnection_1.Company.create(row);
exports.createCompany = createCompany;
const findCreatorPermissions = (userId) => dbConnection_1.UserPermission.findAll({ where: { userId }, attributes: ["permissionId"] });
exports.findCreatorPermissions = findCreatorPermissions;
const grantPermissionToAdminForCompany = (params) => dbConnection_1.UserPermission.findOrCreate({
    where: { userId: params.adminId, permissionId: params.permissionId, companyId: params.companyId },
    defaults: {
        userId: params.adminId,
        permissionId: params.permissionId,
        companyId: params.companyId,
        grantedBy: params.grantedBy,
    },
});
exports.grantPermissionToAdminForCompany = grantPermissionToAdminForCompany;
const findCompaniesPaginated = (params) => {
    let where = { userId: params.userId };
    if (params.search) {
        where = Object.assign(Object.assign({}, where), { [sequelize_1.Op.or]: [
                { companyName: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { legalName: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { companyEmail: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { companyPhone: { [sequelize_1.Op.like]: `%${params.search}%` } },
            ] });
    }
    return dbConnection_1.Company.findAndCountAll({
        where,
        limit: params.limit,
        offset: params.offset,
        order: [["createdAt", "DESC"]],
    });
};
exports.findCompaniesPaginated = findCompaniesPaginated;
const findCompanyOwnedBy = (id, userId) => dbConnection_1.Company.findOne({ where: { id, userId } });
exports.findCompanyOwnedBy = findCompanyOwnedBy;
// Used by deleteCompany to block a destructive delete while real records
// still reference this company — Branch/Shift/Department have no
// cascade-on-delete relationship to Company, so removing the company row
// would otherwise either silently orphan every branch/shift/department (and
// every User whose branchId points into one of them, which is the primary
// signal the company-scoping logic elsewhere relies on) or fail with a raw,
// unhelpful DB constraint error if one happens to exist.
const countCompanyDependents = (companyId) => __awaiter(void 0, void 0, void 0, function* () {
    const [branchCount, shiftCount, departmentCount] = yield Promise.all([
        dbConnection_1.Branch.count({ where: { companyId } }),
        dbConnection_1.Shift.count({ where: { companyId } }),
        dbConnection_1.Department.count({ where: { companyId } }),
    ]);
    return { branchCount, shiftCount, departmentCount };
});
exports.countCompanyDependents = countCompanyDependents;
// Plain lookup with no ownership filter — used once the caller's access has
// already been verified via shared/companyAccess.ts's hasCompanyAccess,
// which (unlike this repo's userId-only checks) also accounts for admins
// via CompanyAdmin, managers via CompanyManager, and super_admin.
const findCompanyByIdOnly = (id) => dbConnection_1.Company.findByPk(id);
exports.findCompanyByIdOnly = findCompanyByIdOnly;
// Read-only attendance/leave policy fields only — deliberately excludes
// legal/financial columns (GST, PAN, registration no, bank details) that a
// manager reading "the rules that apply to my team" (Settings module's
// Company Policy tab) shouldn't need or see; that full record stays behind
// the ADMIN_ONLY getcompany/:id endpoint.
const findCompanyPolicyFields = (id) => dbConnection_1.Company.findByPk(id, {
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
exports.findCompanyPolicyFields = findCompanyPolicyFields;
const findCompanyOwnedOrAdminBy = (id, userId) => dbConnection_1.Company.findOne({ where: { id, [sequelize_1.Op.or]: [{ adminId: userId }, { userId }] } });
exports.findCompanyOwnedOrAdminBy = findCompanyOwnedOrAdminBy;
const findManagerById = (managerId) => dbConnection_1.User.findOne({ where: { id: managerId, role: "manager" } });
exports.findManagerById = findManagerById;
const findOrCreateCompanyManager = (companyId, managerId) => dbConnection_1.CompanyManager.findOrCreate({
    where: { companyId, managerId },
    defaults: { companyId, managerId },
});
exports.findOrCreateCompanyManager = findOrCreateCompanyManager;
const destroyCompanyManager = (companyId, managerId) => dbConnection_1.CompanyManager.destroy({ where: { companyId, managerId } });
exports.destroyCompanyManager = destroyCompanyManager;
const findCompanyManagers = (companyId) => dbConnection_1.CompanyManager.findAll({
    where: { companyId },
    include: [{ model: dbConnection_1.User, as: "manager", attributes: ["id", "firstName", "lastName", "email", "phone"] }],
});
exports.findCompanyManagers = findCompanyManagers;
const findManagerCompanyAssignments = (managerId) => dbConnection_1.CompanyManager.findAll({
    where: { managerId },
    include: [
        {
            model: dbConnection_1.Company,
            as: "company",
            attributes: ["id", "companyName", "legalName", "companyEmail", "companyPhone", "city"],
        },
    ],
});
exports.findManagerCompanyAssignments = findManagerCompanyAssignments;
const findManagerCompanyAssignment = (companyId, managerId) => dbConnection_1.CompanyManager.findOne({
    where: { companyId, managerId },
    include: [{ model: dbConnection_1.Company, as: "company", attributes: ["id", "companyName"] }],
});
exports.findManagerCompanyAssignment = findManagerCompanyAssignment;
const updateUserRefreshToken = (userId, refreshToken) => dbConnection_1.User.update({ refreshToken }, { where: { id: userId } });
exports.updateUserRefreshToken = updateUserRefreshToken;
// ── Multi-company admin support (mirrors the CompanyManager functions above) ──
const findAdminById = (adminId) => dbConnection_1.User.findOne({ where: { id: adminId, role: "admin" } });
exports.findAdminById = findAdminById;
const findOrCreateCompanyAdmin = (companyId, adminId) => dbConnection_1.CompanyAdmin.findOrCreate({
    where: { companyId, adminId },
    defaults: { companyId, adminId },
});
exports.findOrCreateCompanyAdmin = findOrCreateCompanyAdmin;
const destroyCompanyAdmin = (companyId, adminId) => dbConnection_1.CompanyAdmin.destroy({ where: { companyId, adminId } });
exports.destroyCompanyAdmin = destroyCompanyAdmin;
const findCompanyAdmins = (companyId) => dbConnection_1.CompanyAdmin.findAll({
    where: { companyId },
    include: [{ model: dbConnection_1.User, as: "admin", attributes: ["id", "firstName", "lastName", "email", "phone"] }],
});
exports.findCompanyAdmins = findCompanyAdmins;
const findAdminCompanyAssignments = (adminId) => dbConnection_1.CompanyAdmin.findAll({
    where: { adminId },
    include: [
        {
            model: dbConnection_1.Company,
            as: "company",
            attributes: ["id", "companyName", "legalName", "companyEmail", "companyPhone", "city"],
        },
    ],
});
exports.findAdminCompanyAssignments = findAdminCompanyAssignments;
// The CompanyAdmin junction above only has a row when an admin was
// explicitly ASSIGNED to a company (assign-company-admin). It has no row for
// the company an admin created and owns outright — addCompany stamps that
// company's userId (and optionally adminId) with the creating admin's id
// directly, never inserting a junction row. Same attribute set as
// findAdminCompanyAssignments' company include, so callers can merge the two
// without changing the response shape.
const findOwnedCompaniesByAdminId = (adminId) => dbConnection_1.Company.findAll({
    where: { [sequelize_1.Op.or]: [{ userId: adminId }, { adminId }] },
    attributes: ["id", "companyName", "legalName", "companyEmail", "companyPhone", "city"],
});
exports.findOwnedCompaniesByAdminId = findOwnedCompaniesByAdminId;
const findAdminCompanyAssignment = (companyId, adminId) => dbConnection_1.CompanyAdmin.findOne({
    where: { companyId, adminId },
    include: [{ model: dbConnection_1.Company, as: "company", attributes: ["id", "companyName"] }],
});
exports.findAdminCompanyAssignment = findAdminCompanyAssignment;
const findCompaniesWithFullDetail = (userId) => dbConnection_1.Company.findAll({
    where: { userId },
    include: [
        { model: dbConnection_1.Branch, as: "branches" },
        { model: dbConnection_1.Shift, as: "shifts" },
        { model: dbConnection_1.Department, as: "departments" },
        { model: dbConnection_1.CompanyLeave, as: "companyLeaves" },
        { model: dbConnection_1.CompanyBank, as: "companyBanks" },
    ],
});
exports.findCompaniesWithFullDetail = findCompaniesWithFullDetail;
const bulkCreateCompanyBanks = (rows) => dbConnection_1.CompanyBank.bulkCreate(rows);
exports.bulkCreateCompanyBanks = bulkCreateCompanyBanks;
