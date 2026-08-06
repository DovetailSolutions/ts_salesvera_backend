"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.addCompanyBank = exports.getOwnCompany = exports.deleteCompany = exports.getCompanyAdmins = exports.removeCompanyAdmin = exports.assignCompanyAdmin = exports.switchCompany = exports.getMyCompanies = exports.getCompanyManagers = exports.removeCompanyManager = exports.assignCompanyManager = exports.updateCompany = exports.getCompanyPolicy = exports.getCompanyById = exports.getCompany = exports.addCompany = void 0;
const serviceError_1 = require("../shared/serviceError");
const Middleware = __importStar(require("../../app/middlewear/comman"));
const permissionCache_1 = require("../../config/permissionCache");
const companyAccess_1 = require("../shared/companyAccess");
const CompanyRepo = __importStar(require("./company.repository"));
// ============================================================
// Company service — validation + orchestration. Byte-for-byte port of the
// previous addCompany/getCompany/getCompanyById/updateCompany/
// assignCompanyManager/removeCompanyManager/getCompanyManagers/
// getMyCompanies/switchCompany/deleteCompany/getOwnCompany/addCompanyBank
// controller bodies in admin.ts.
// ============================================================
const addCompany = (userId, role, body) => __awaiter(void 0, void 0, void 0, function* () {
    if (role !== "user") {
        throw new serviceError_1.ServiceError("You are not authorized to add a company");
    }
    const { companyName, legalName, registrationNo, gst, pan, industry, companySize, website, companyEmail, companyPhone, city, timezone, currency, state, country, zipcode, 
    // Bank
    bankAccountHolder, bankName, bankAccountNumber, bankIfsc, bankBranchName, bankAccountType, bankMicr, upiId, 
    // HR Config
    payrollCycle, lateMarkAfter, autoHalfDayAfter, geoFencingRequired, officeLocationRequired, overtimeAllowed, companyWorkingDays, altSaturday, casualHolidaysTotal, casualHolidaysPerMonth, casualHolidayNotice, compOffMinHours, compOffExpiryDays, casualCarryForwardLimit, casualCarryForwardExpiry, adminId, managerId, createdBy, } = body;
    if (!companyName || companyName.trim().length < 2)
        throw new serviceError_1.ServiceError("Company name is required (min 2 chars)");
    if (!legalName)
        throw new serviceError_1.ServiceError("Legal name is required");
    if (!registrationNo)
        throw new serviceError_1.ServiceError("Registration number is required");
    if (!companyEmail || !/^\S+@\S+\.\S+$/.test(companyEmail))
        throw new serviceError_1.ServiceError("Valid company email is required");
    if (!companyPhone || companyPhone.length < 8)
        throw new serviceError_1.ServiceError("Valid company phone is required");
    if (gst && gst.length !== 15)
        throw new serviceError_1.ServiceError("GST must be 15 characters");
    if (pan && pan.length !== 10)
        throw new serviceError_1.ServiceError("PAN must be 10 characters");
    if (website && !/^https?:\/\/.+/.test(website))
        throw new serviceError_1.ServiceError("Website must be a valid URL");
    if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc))
        throw new serviceError_1.ServiceError("Invalid IFSC code");
    if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId))
        throw new serviceError_1.ServiceError("Invalid UPI ID");
    const numericFields = [
        { field: lateMarkAfter, name: "lateMarkAfter" },
        { field: autoHalfDayAfter, name: "autoHalfDayAfter" },
        { field: casualHolidaysTotal, name: "casualHolidaysTotal" },
        { field: casualHolidaysPerMonth, name: "casualHolidaysPerMonth" },
        { field: casualHolidayNotice, name: "casualHolidayNotice" },
        { field: compOffMinHours, name: "compOffMinHours" },
        { field: compOffExpiryDays, name: "compOffExpiryDays" },
        { field: casualCarryForwardLimit, name: "casualCarryForwardLimit" },
        { field: casualCarryForwardExpiry, name: "casualCarryForwardExpiry" },
    ];
    for (const item of numericFields) {
        if (item.field && isNaN(Number(item.field)))
            throw new serviceError_1.ServiceError(`${item.name} must be a number`);
    }
    const company = yield CompanyRepo.createCompany({
        companyName, legalName, registrationNo, gst, pan, industry, companySize,
        website, companyEmail, companyPhone, city, timezone, currency,
        bankAccountHolder, bankName, bankAccountNumber, bankIfsc, bankBranchName,
        bankAccountType, bankMicr, upiId, state, country, zipcode,
        payrollCycle, lateMarkAfter, autoHalfDayAfter,
        geoFencingRequired: geoFencingRequired !== undefined ? Boolean(geoFencingRequired) : true,
        officeLocationRequired: officeLocationRequired !== undefined ? Boolean(officeLocationRequired) : true,
        overtimeAllowed: overtimeAllowed !== undefined ? Boolean(overtimeAllowed) : false,
        companyWorkingDays: Array.isArray(companyWorkingDays) ? companyWorkingDays : null,
        altSaturday: altSaturday !== undefined ? Boolean(altSaturday) : false,
        casualHolidaysTotal, casualHolidaysPerMonth, casualHolidayNotice,
        compOffMinHours, compOffExpiryDays, casualCarryForwardLimit, casualCarryForwardExpiry,
        userId: createdBy || userId,
        adminId: adminId || null,
        managerId: managerId || null,
    });
    // When a company is linked to an admin, propagate the creator-user's permissions
    // to that admin scoped to this company. Company is optional — if no adminId, skip.
    if (adminId) {
        const creatorUserId = Number(userId);
        const newCompanyId = company.id;
        const creatorPerms = yield CompanyRepo.findCreatorPermissions(creatorUserId);
        if (creatorPerms.length > 0) {
            yield Promise.all(creatorPerms.map((p) => CompanyRepo.grantPermissionToAdminForCompany({
                adminId: Number(adminId),
                permissionId: p.permissionId,
                companyId: newCompanyId,
                grantedBy: creatorUserId,
            })));
            (0, permissionCache_1.invalidatePermissionCache)(Number(adminId));
        }
    }
    return company;
});
exports.addCompany = addCompany;
const getCompany = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = query.search || "";
    const { count, rows } = yield CompanyRepo.findCompaniesPaginated({ userId, search, limit, offset });
    return {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        data: rows,
    };
});
exports.getCompany = getCompany;
const getCompanyById = (id, userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (!id)
        throw new serviceError_1.ServiceError("Company id is required");
    if (isNaN(Number(id)))
        throw new serviceError_1.ServiceError("Company id must be a number");
    // FIX: previously only matched Company.userId exactly — an admin,
    // manager, or super_admin (e.g. CompanyManagement.jsx, which is
    // super_admin-only) could never load a company by id at all, always
    // hitting "Company not found". hasCompanyAccess also covers the
    // CompanyAdmin/CompanyManager junctions and super_admin's universal access.
    const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(id), userId, role);
    if (!allowed)
        throw new serviceError_1.ServiceError("Company not found");
    const company = yield CompanyRepo.findCompanyByIdOnly(id);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    return company;
});
exports.getCompanyById = getCompanyById;
// Read-only attendance/leave policy bundle — the Settings module's Company
// Policy tab (manager: view the rules that apply to their team; admin/user
// already get the full editable versions of this same data via the other
// Settings tabs, so this endpoint exists specifically to give manager a
// legitimate, non-ADMIN_ONLY way to see it). Resolves companyId from the
// caller's own JWT context rather than taking one as a param — nobody
// calling this should ever need to look up a DIFFERENT company's policy.
const getCompanyPolicy = (userId, role, callerCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!callerCompanyId)
        throw new serviceError_1.ServiceError("No company context — cannot resolve your company's policy");
    const allowed = yield (0, companyAccess_1.hasCompanyAccess)(callerCompanyId, userId, role);
    if (!allowed)
        throw new serviceError_1.ServiceError("You do not have access to this company", 403);
    const company = yield CompanyRepo.findCompanyPolicyFields(callerCompanyId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    return company;
});
exports.getCompanyPolicy = getCompanyPolicy;
const updateCompany = (id, userId, body, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (!id)
        throw new serviceError_1.ServiceError("Company id is required");
    if (isNaN(Number(id)))
        throw new serviceError_1.ServiceError("Company id must be a number");
    const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(id), userId, role);
    if (!allowed)
        throw new serviceError_1.ServiceError("Company not found");
    const company = yield CompanyRepo.findCompanyByIdOnly(id);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    return company.update(body);
});
exports.updateCompany = updateCompany;
const assignCompanyManager = (companyIdParam, userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    if (!companyIdParam)
        throw new serviceError_1.ServiceError("Company id is required");
    if (isNaN(Number(companyIdParam)))
        throw new serviceError_1.ServiceError("Company id must be a number");
    const { managerId } = body;
    if (!managerId)
        throw new serviceError_1.ServiceError("managerId is required");
    if (isNaN(Number(managerId)))
        throw new serviceError_1.ServiceError("managerId must be a number");
    const company = yield CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    const manager = yield CompanyRepo.findManagerById(Number(managerId));
    if (!manager)
        throw new serviceError_1.ServiceError("Manager not found");
    const [record, created] = yield CompanyRepo.findOrCreateCompanyManager(Number(companyIdParam), Number(managerId));
    return {
        message: created ? "Manager assigned to company" : "Manager already assigned to this company",
        record,
    };
});
exports.assignCompanyManager = assignCompanyManager;
const removeCompanyManager = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { companyId, managerId } = body;
    if (!companyId || !managerId)
        throw new serviceError_1.ServiceError("companyId and managerId are required");
    const company = yield CompanyRepo.findCompanyOwnedOrAdminBy(Number(companyId), userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    const deleted = yield CompanyRepo.destroyCompanyManager(Number(companyId), Number(managerId));
    if (!deleted)
        throw new serviceError_1.ServiceError("Assignment not found");
});
exports.removeCompanyManager = removeCompanyManager;
const getCompanyManagers = (companyIdParam, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!companyIdParam)
        throw new serviceError_1.ServiceError("Company id is required");
    const company = yield CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    return CompanyRepo.findCompanyManagers(Number(companyIdParam));
});
exports.getCompanyManagers = getCompanyManagers;
const getMyCompanies = (userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (role === "admin") {
        // FIX: the CompanyAdmin junction only holds companies an admin was
        // explicitly ASSIGNED to — it has no row for the company an admin
        // created and owns outright (Company.userId/adminId, stamped directly
        // at creation), so an owning admin with no extra assignments got an
        // empty array here even though getowncompany/profile correctly showed
        // their company. Merge both sources, deduped by company id, same
        // response shape (array of company objects) as before.
        const [assignments, owned] = yield Promise.all([
            CompanyRepo.findAdminCompanyAssignments(userId),
            CompanyRepo.findOwnedCompaniesByAdminId(userId),
        ]);
        const companies = [...assignments.map((a) => a.company), ...owned];
        const seen = new Set();
        return companies.filter((c) => {
            if (seen.has(c.id))
                return false;
            seen.add(c.id);
            return true;
        });
    }
    const assignments = yield CompanyRepo.findManagerCompanyAssignments(userId);
    return assignments.map((a) => a.company);
});
exports.getMyCompanies = getMyCompanies;
const switchCompany = (userId, role, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { companyId } = body;
    if (!companyId)
        throw new serviceError_1.ServiceError("companyId is required");
    if (isNaN(Number(companyId)))
        throw new serviceError_1.ServiceError("companyId must be a number");
    if (role !== "admin" && role !== "manager") {
        throw new serviceError_1.ServiceError("Only admin or manager accounts can switch companies");
    }
    const targetCompanyId = Number(companyId);
    const callerId = Number(userId);
    // Verify this admin/manager is actually assigned to the target company via junction table
    const assignment = role === "admin"
        ? yield CompanyRepo.findAdminCompanyAssignment(targetCompanyId, callerId)
        : yield CompanyRepo.findManagerCompanyAssignment(targetCompanyId, callerId);
    if (!assignment)
        throw new serviceError_1.ServiceError("You are not assigned to this company");
    const company = assignment.company;
    // Issue a new token scoped to the target company
    const { accessToken, refreshToken } = Middleware.CreateToken(String(callerId), role, targetCompanyId);
    yield CompanyRepo.updateUserRefreshToken(callerId, refreshToken);
    return {
        accessToken,
        companyId: targetCompanyId,
        companyName: company.companyName,
    };
});
exports.switchCompany = switchCompany;
const assignCompanyAdmin = (companyIdParam, userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    if (!companyIdParam)
        throw new serviceError_1.ServiceError("Company id is required");
    if (isNaN(Number(companyIdParam)))
        throw new serviceError_1.ServiceError("Company id must be a number");
    const { adminId } = body;
    if (!adminId)
        throw new serviceError_1.ServiceError("adminId is required");
    if (isNaN(Number(adminId)))
        throw new serviceError_1.ServiceError("adminId must be a number");
    const company = yield CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    const admin = yield CompanyRepo.findAdminById(Number(adminId));
    if (!admin)
        throw new serviceError_1.ServiceError("Admin not found");
    const [record, created] = yield CompanyRepo.findOrCreateCompanyAdmin(Number(companyIdParam), Number(adminId));
    return {
        message: created ? "Admin assigned to company" : "Admin already assigned to this company",
        record,
    };
});
exports.assignCompanyAdmin = assignCompanyAdmin;
const removeCompanyAdmin = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { companyId, adminId } = body;
    if (!companyId || !adminId)
        throw new serviceError_1.ServiceError("companyId and adminId are required");
    const company = yield CompanyRepo.findCompanyOwnedOrAdminBy(Number(companyId), userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    const deleted = yield CompanyRepo.destroyCompanyAdmin(Number(companyId), Number(adminId));
    if (!deleted)
        throw new serviceError_1.ServiceError("Assignment not found");
});
exports.removeCompanyAdmin = removeCompanyAdmin;
const getCompanyAdmins = (companyIdParam, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!companyIdParam)
        throw new serviceError_1.ServiceError("Company id is required");
    const company = yield CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    return CompanyRepo.findCompanyAdmins(Number(companyIdParam));
});
exports.getCompanyAdmins = getCompanyAdmins;
const deleteCompany = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!id)
        throw new serviceError_1.ServiceError("Company id is required");
    if (isNaN(Number(id)))
        throw new serviceError_1.ServiceError("Company id must be a number");
    const company = yield CompanyRepo.findCompanyOwnedBy(id, userId);
    if (!company)
        throw new serviceError_1.ServiceError("Company not found");
    // FIX: this used to destroy the company unconditionally. Block instead,
    // with a clear message, until the company is actually empty — see
    // countCompanyDependents' comment for why this matters.
    const { branchCount, shiftCount, departmentCount } = yield CompanyRepo.countCompanyDependents(Number(id));
    if (branchCount > 0 || shiftCount > 0 || departmentCount > 0) {
        throw new serviceError_1.ServiceError(`Cannot delete this company while it still has ${branchCount} branch(es), ${shiftCount} shift(s), and ${departmentCount} department(s). Remove those first.`);
    }
    yield company.destroy();
});
exports.deleteCompany = deleteCompany;
const getOwnCompany = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const companies = yield CompanyRepo.findCompaniesWithFullDetail(userId);
    if (!companies || companies.length === 0)
        throw new serviceError_1.ServiceError("No company found for this user");
    return companies;
});
exports.getOwnCompany = getOwnCompany;
const addCompanyBank = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { companyId, banks } = body;
    if (!companyId)
        throw new serviceError_1.ServiceError("companyId is required");
    if (!Array.isArray(banks) || banks.length === 0)
        throw new serviceError_1.ServiceError("banks array is required");
    const bankData = banks.map((b) => ({
        companyId: Number(companyId),
        branchId: b.branchId ? Number(b.branchId) : null,
        userId: Number(userId),
        bankAccountHolder: b.bankAccountHolder,
        bankName: b.bankName,
        bankAccountNumber: b.bankAccountNumber,
        bankIfsc: b.bankIfsc,
        bankBranchName: b.bankBranchName || null,
        bankAccountType: b.bankAccountType || null,
        bankMicr: b.bankMicr || null,
        upiId: b.upiId || null,
    }));
    return CompanyRepo.bulkCreateCompanyBanks(bankData);
});
exports.addCompanyBank = addCompanyBank;
