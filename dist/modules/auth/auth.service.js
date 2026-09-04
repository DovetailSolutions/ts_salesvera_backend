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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.verifyOtp = exports.forgotPassword = exports.updatePassword = exports.updateProfile = exports.getProfile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const serviceError_1 = require("../shared/serviceError");
const Middleware = __importStar(require("../../app/middlewear/comman"));
const email_1 = require("../../config/email");
const dbConnection_1 = require("../../config/dbConnection");
const userHierarchy_1 = require("../shared/userHierarchy");
const companyAccess_1 = require("../shared/companyAccess");
const tokenCheck_1 = require("../../config/tokenCheck");
const AuthRepo = __importStar(require("./auth.repository"));
// ============================================================
// Auth service — validation + orchestration. Byte-for-byte port of the
// previous Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword/
// forgotPassword/verifyOtp/changePassword controller bodies in admin.ts.
// ============================================================
const UNIQUE_ROLES = ["super_admin"];
// Roles a caller is allowed to register an account as — mirrors
// ASSIGNABLE_ROLES in permission.ts. "super_admin" isn't a key here: it's
// handled as a standalone bootstrap case below (no caller required at all).
const REGISTER_ALLOWED_ROLES = {
    super_admin: ["user", "admin", "manager", "sale_person"],
    user: ["admin", "manager", "sale_person"],
    admin: ["manager", "sale_person"],
    manager: ["sale_person"],
};
const register = (body, callerData) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, firstName, lastName, phone, dob, role, createdBy, permissionIds, branchId, shiftId, departmentId } = body;
    const requiredFields = { email, password, firstName, lastName, phone, dob, role };
    for (const key in requiredFields) {
        if (!requiredFields[key])
            throw new serviceError_1.ServiceError(`${key} is required`);
    }
    // ── Authorization ────────────────────────────────────────────────────
    // FIX: this endpoint previously trusted role/createdBy straight from the
    // request body with zero verification of the caller — anyone could POST
    // role:"admin" with an arbitrary createdBy and get an account that
    // auto-inherits that creator's permissions (see below). "super_admin" is
    // the sole exception: there's no seed script, so the very first
    // super_admin has only ever been created through this same endpoint,
    // before any JWT could exist — UNIQUE_ROLES below still caps it at one.
    const callerRole = callerData === null || callerData === void 0 ? void 0 : callerData.role;
    const callerId = (callerData === null || callerData === void 0 ? void 0 : callerData.userId) ? Number(callerData.userId) : null;
    if (role !== "super_admin") {
        if (!callerRole || !callerId || !(REGISTER_ALLOWED_ROLES[callerRole] || []).includes(role)) {
            throw new serviceError_1.ServiceError(callerRole
                ? `${callerRole} is not authorized to register a '${role}' account`
                : "Authentication is required to register this account");
        }
    }
    let primaryCreatorId = Array.isArray(createdBy)
        ? Number(createdBy[0])
        : createdBy
            ? Number(createdBy)
            : undefined;
    // createdBy (when supplied) must be the caller themself or one of their
    // own subordinates — otherwise a caller could attribute the new account
    // to an arbitrary user in a completely different tenant.
    //
    // Deliberately the UNSCOPED hierarchy (not getCompanyScopedChildUserIds):
    // this gates who may CREATE/LINK an account, not what team data anyone can
    // see. An admin/manager assigned to several companies legitimately creates
    // staff under a subordinate of any of their own companies, and the branch/
    // shift defaults below are resolved from the CREATOR's company (not the
    // caller's active token company) anyway — narrowing this to the token's
    // company would reject that supported flow without closing any cross-tenant
    // hole, since the subordinate must still be inside the caller's own tree.
    if (role !== "super_admin" && primaryCreatorId && !isNaN(primaryCreatorId) && primaryCreatorId !== callerId) {
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(callerId);
        if (!childIds.includes(primaryCreatorId)) {
            throw new serviceError_1.ServiceError("createdBy must be yourself or one of your own team members");
        }
    }
    // Every non-super_admin role needs SOME creator to hang off (tenantId +
    // the createdBy hierarchy both depend on it) — default to self-authorship
    // when the caller omitted createdBy entirely, instead of silently
    // producing an orphaned account with no tenantId and no creator link.
    if (role !== "super_admin" && (primaryCreatorId === undefined || isNaN(primaryCreatorId)) && callerId) {
        primaryCreatorId = callerId;
    }
    // ── Resolve tenantId for the new user ──────────────────────────────
    // super_admin / standalone user creation: no tenantId yet (set after create)
    // All other roles inherit tenantId from their creator's tree
    let resolvedTenantId = null;
    let creator = null;
    if (primaryCreatorId && !isNaN(primaryCreatorId) && role !== "super_admin") {
        creator = yield AuthRepo.findUserById(primaryCreatorId, ["id", "role", "tenantId"]);
        if (creator) {
            if (creator.role === "user") {
                resolvedTenantId = creator.id;
            }
            else if (creator.tenantId) {
                resolvedTenantId = creator.tenantId;
            }
        }
    }
    // Check if user with same email exists — scoped to tenant.
    // super_admin and user (tenant roots) are globally unique; admin/manager/
    // sale_person are unique only within their tenant.
    const emailCheckTenantId = role === "super_admin" || role === "user" ? null : resolvedTenantId;
    const isExist = yield Middleware.FindByEmailInTenant(dbConnection_1.User, email, emailCheckTenantId);
    if (isExist)
        throw new serviceError_1.ServiceError("Email already exists");
    // Check role — admin/super_admin only once in DB
    if (UNIQUE_ROLES.includes(role)) {
        const existing = yield Middleware.findByRole(dbConnection_1.User, role);
        if (existing)
            throw new serviceError_1.ServiceError(`${role} already exists. Only one ${role} can be created.`);
    }
    let resolvedBranchId = branchId !== undefined && branchId !== null && branchId !== "" && !isNaN(Number(branchId))
        ? Number(branchId)
        : null;
    let resolvedShiftId = shiftId !== undefined && shiftId !== null && shiftId !== "" && !isNaN(Number(shiftId))
        ? Number(shiftId)
        : null;
    let resolvedDepartmentId = departmentId !== undefined && departmentId !== null && departmentId !== "" && !isNaN(Number(departmentId))
        ? Number(departmentId)
        : null;
    // Resolved once whenever there's a creator — used for the branch/shift/
    // department defaulting and validation below AND to link a new manager
    // into the CompanyManager junction table (see FIX further down), not just
    // when branch/shift defaulting happens to be needed.
    const creatorCompanyId = creator
        ? yield (0, tokenCheck_1.resolveCompanyId)(creator.id, creator.role, null)
        : null;
    // FIX: an explicitly-supplied branchId/departmentId was never checked
    // against the caller's own company — the same cross-tenant hole
    // assignEmployeeShift used to have (see the FIX note there). Reject
    // outright if either belongs to (or exists in) a different company than
    // the caller's, instead of silently stamping the new user with it.
    if (resolvedBranchId !== null) {
        const branch = yield dbConnection_1.Branch.findByPk(resolvedBranchId);
        if (!branch || (creatorCompanyId && Number(branch.companyId) !== creatorCompanyId)) {
            throw new serviceError_1.ServiceError("Branch not found");
        }
    }
    if (resolvedDepartmentId !== null) {
        const department = yield dbConnection_1.Department.findByPk(resolvedDepartmentId);
        if (!department || (creatorCompanyId && Number(department.companyId) !== creatorCompanyId)) {
            throw new serviceError_1.ServiceError("Department not found");
        }
    }
    // No branch/shift explicitly given — default to the company's main branch
    // (its first-ever registered branch) and its first-ever registered shift,
    // resolved via the creator's own company, instead of leaving this employee
    // unassigned. Silently no-ops (stays null) if the company has neither yet
    // (e.g. this is the very first user created, before Step 1/3 have run) or
    // no company context is resolvable at all.
    if ((resolvedBranchId === null || resolvedShiftId === null) && creatorCompanyId) {
        const defaults = yield (0, companyAccess_1.resolveDefaultBranchAndShift)(creatorCompanyId);
        if (resolvedBranchId === null)
            resolvedBranchId = defaults.branchId;
        if (resolvedShiftId === null)
            resolvedShiftId = defaults.shiftId;
    }
    const obj = Object.assign({ email,
        password,
        firstName,
        lastName,
        phone,
        dob,
        role, tenantId: resolvedTenantId, branchId: resolvedBranchId, shiftId: resolvedShiftId, departmentId: resolvedDepartmentId }, (primaryCreatorId && !isNaN(primaryCreatorId) ? { createdBy: primaryCreatorId } : {}));
    const item = yield AuthRepo.createUser(obj);
    // If this is a tenant root (user role created by super_admin), point tenantId at self
    if (role === "user" && !resolvedTenantId) {
        yield item.update({ tenantId: item.getDataValue("id") });
    }
    if (role === "sale_person" || role === "manager" || role === "admin" || role === "user") {
        // Uses the same resolved primaryCreatorId as obj.createdBy above (which
        // may be the self-authorship default, not just the raw request body) —
        // previously this checked the raw createdBy field, so an omitted
        // createdBy left User.createdBy set but the UserCreators join-table
        // link missing, which is what the hierarchy walks actually use.
        const ids = Array.isArray(createdBy)
            ? createdBy.map((id) => Number(id)).filter((id) => !isNaN(id))
            : primaryCreatorId !== undefined && !isNaN(primaryCreatorId)
                ? [primaryCreatorId]
                : [];
        if (ids.length > 0) {
            yield item.setCreators(ids);
        }
        // When a new admin is created by a user, inherit that user's permissions
        if (role === "admin" && ids.length > 0) {
            const newAdminId = item.getDataValue("id");
            for (const creatorId of ids) {
                const creator = yield AuthRepo.findUserByRoleAndId(creatorId, "user");
                if (!creator)
                    continue;
                const creatorPerms = yield AuthRepo.findUserPermissionsForUser(creatorId);
                if (creatorPerms.length > 0) {
                    yield Promise.all(creatorPerms.map((p) => AuthRepo.grantPermission({
                        userId: newAdminId,
                        permissionId: p.permissionId,
                        companyId: null,
                        grantedBy: creatorId,
                    })));
                }
            }
        }
    }
    // When super_admin creates a user (role="user"), assign permissions immediately if provided
    if (role === "user" && Array.isArray(permissionIds) && permissionIds.length > 0 && createdBy) {
        const granterId = Number(createdBy);
        const granterUser = yield AuthRepo.findUserByRoleAndId(granterId, "super_admin");
        if (granterUser) {
            const newUserId = item.getDataValue("id");
            const validPerms = yield AuthRepo.findPermissionsByIds(permissionIds);
            yield Promise.all(validPerms.map((p) => AuthRepo.grantPermission({
                userId: newUserId,
                permissionId: p.id,
                companyId: null,
                grantedBy: granterId,
            })));
        }
    }
    // FIX (ATT-003 root cause): a newly-registered manager was never linked to
    // their company via the CompanyManager junction table — admins get linked
    // via Company.adminId (set when their company is registered), but managers
    // have no equivalent direct FK and nothing here ever created this row.
    // Both login()'s companyId resolution and every subsequent request's
    // resolveCompanyId (config/tokenCheck.ts) only ever check this same
    // junction table for a manager, so without it a manager's JWT/req.userData
    // permanently had no companyId — breaking every company-scoped endpoint
    // for them (e.g. GET /admin/user-leave's "no company context in token").
    if (role === "manager" && creatorCompanyId) {
        yield dbConnection_1.CompanyManager.findOrCreate({
            where: { companyId: creatorCompanyId, managerId: item.getDataValue("id") },
            defaults: { companyId: creatorCompanyId, managerId: item.getDataValue("id") },
        });
    }
    const { accessToken, refreshToken } = Middleware.CreateToken(String(item.getDataValue("id")), String(item.getDataValue("role")));
    yield item.update({ refreshToken });
    // Email login credentials in the background (no await — don't block registration)
    (0, email_1.sendEmail)("Welcome to SalesVera - Your Login Credentials", password, email, firstName, lastName).catch((err) => console.error(`Failed to send credentials email to ${email}:`, err));
    // FIX: `item` was returned as the raw Sequelize instance, which serializes
    // every column straight into the HTTP response — including the bcrypt
    // password hash and the refreshToken just set above (itself a fully-usable
    // credential on its own, see CreateToken/tokenCheck), handed to whoever
    // created this account (not the account itself). Strip before returning.
    const _a = item.get({ plain: true }), { password: _pw, refreshToken: _rt, otp: _otp, otpExpiry: _otpExp } = _a, safeItem = __rest(_a, ["password", "refreshToken", "otp", "otpExpiry"]);
    return { item: safeItem, accessToken, role };
});
exports.register = register;
const login = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, tenantId, deviceType } = body || {};
    if (!email || !password)
        throw new serviceError_1.ServiceError("Email and password are required");
    const loginTenantId = tenantId ? Number(tenantId) : null;
    const user = yield Middleware.FindByEmailInTenant(dbConnection_1.User, email, loginTenantId);
    if (!user)
        throw new serviceError_1.ServiceError("Invalid email or password");
    const allowedRoles = ["admin", "manager", "super_admin", "user", "sale_person", "sales_person"];
    const userRole = user.get("role");
    if (!allowedRoles.includes(userRole)) {
        throw new serviceError_1.ServiceError("Access restricted. Invalid user role.");
    }
    // Exe (desktop) login is admin-only; web login is unrestricted (within allowedRoles)
    if (deviceType === "exe" && userRole !== "admin") {
        throw new serviceError_1.ServiceError("Only admin can login from the desktop application");
    }
    const hashedPassword = user.get("password");
    const isPasswordValid = yield bcrypt_1.default.compare(password, hashedPassword);
    if (!isPasswordValid)
        throw new serviceError_1.ServiceError("Invalid email or password");
    const userId = user.get("id");
    // ── Resolve companyId for the JWT ─────────────────────────────────
    let companyId = null;
    if (userRole === "admin") {
        const company = yield AuthRepo.findCompanyByAdminId(userId);
        companyId = company ? company.id : null;
        // Fall back to the multi-company junction table if this admin isn't the
        // single primary owner (Company.adminId) of any company, but has been
        // assigned to one or more companies via assign-company-admin.
        if (!companyId) {
            const assignment = yield AuthRepo.findCompanyAdminAssignment(userId);
            companyId = assignment ? assignment.companyId : null;
        }
    }
    else if (userRole === "manager") {
        const assignment = yield AuthRepo.findCompanyManagerAssignment(userId);
        companyId = assignment ? assignment.companyId : null;
    }
    else if (userRole === "user") {
        const company = yield AuthRepo.findCompanyByUserId(userId);
        companyId = company ? company.id : null;
    }
    // Priority 2: Fallback — find ANY company where this user has assigned permissions
    if (!companyId && userRole !== "super_admin" && userRole !== "user") {
        const firstPermission = yield AuthRepo.findFirstUserPermissionCompany(userId);
        companyId = firstPermission ? firstPermission.companyId : null;
    }
    // ── Restore last active company (from previous logout), if still accessible ──
    const lastLoginCompanyId = user.get("lastLoginCompanyId");
    if (lastLoginCompanyId && (userRole === "admin" || userRole === "manager" || userRole === "sale_person")) {
        let hasAccess = false;
        if (userRole === "admin") {
            const company = yield AuthRepo.findCompanyByIdAndAdmin(lastLoginCompanyId, userId);
            hasAccess = !!company;
            if (!hasAccess) {
                const assignment = yield AuthRepo.findCompanyAdminAssignmentFor(lastLoginCompanyId, userId);
                hasAccess = !!assignment;
            }
        }
        else if (userRole === "manager") {
            const assignment = yield AuthRepo.findCompanyManagerAssignmentFor(lastLoginCompanyId, userId);
            hasAccess = !!assignment;
        }
        else if (userRole === "sale_person") {
            const company = yield AuthRepo.findCompanyByIdAndManagerOwner(lastLoginCompanyId, userId);
            hasAccess = !!company;
        }
        if (hasAccess)
            companyId = lastLoginCompanyId;
    }
    const { accessToken, refreshToken } = Middleware.CreateToken(String(userId), userRole, companyId);
    yield user.update({ refreshToken });
    // ── Fetch Permissions for the Login Response ─────────────────────
    let permissions = [];
    if (userRole === "super_admin" || userRole === "user") {
        const all = yield AuthRepo.findAllPermissions();
        permissions = all.map((p) => `${p.module}:${p.action}`);
    }
    else if (userRole === "admin" && companyId) {
        const all = yield AuthRepo.findAllPermissions();
        permissions = all.map((p) => `${p.module}:${p.action}`);
    }
    else {
        const records = yield AuthRepo.findUserPermissionsWithPermission(userId);
        permissions = records.map((r) => `${r.permission.module}:${r.permission.action}`);
    }
    return {
        accessToken,
        refreshToken,
        companyId,
        user: {
            id: user.get("id"),
            firstName: user.get("firstName"),
            lastName: user.get("lastName"),
            email: user.get("email"),
            role: userRole,
            tallyGuid: user.get("tallyGuid") || null,
            tallyName: user.get("tallyName") || null,
            tallyStartDate: user.get("tallyStartDate") || null,
        },
        permissions,
    };
});
exports.login = login;
const logout = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { lastLoginCompanyId } = body || {};
    // Frontend sends {} when the user has no active company context yet — nothing to persist.
    if (lastLoginCompanyId !== undefined) {
        yield AuthRepo.updateUserFields(userId, {
            lastLoginCompanyId: lastLoginCompanyId === null ? null : Number(lastLoginCompanyId),
        });
    }
});
exports.logout = logout;
const getProfile = (userId, role, companyId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield AuthRepo.findUserWithProfileIncludes(Number(userId), role, role !== "manager");
    // For managers: attach active company (from JWT companyId) onto user.company
    if (role === "manager" && companyId) {
        const activeCompany = yield AuthRepo.findCompanyWithFullDetail(Number(companyId));
        if (user && activeCompany) {
            user.dataValues.company = activeCompany;
        }
    }
    // FIX: `user` serialized every column of the User model into the response
    // — including the caller's own bcrypt password hash and their live
    // refreshToken (a fully-usable credential on its own, see CreateToken/
    // tokenCheck) — on every single profile fetch (this fires on every page
    // load via AuthProvider.fetchAndSyncProfile). Strip before returning.
    if (user) {
        delete user.dataValues.password;
        delete user.dataValues.refreshToken;
        delete user.dataValues.otp;
        delete user.dataValues.otpExpiry;
    }
    const permissions = [];
    const matrix = {};
    if (role === "super_admin" || role === "user") {
        const all = yield AuthRepo.findAllPermissions(true);
        for (const p of all) {
            if (!matrix[p.module])
                matrix[p.module] = {};
            matrix[p.module][p.action] = true;
            permissions.push(`${p.module}:${p.action}`);
        }
    }
    else {
        const records = yield AuthRepo.findUserPermissionsWithPermission(Number(userId));
        for (const r of records) {
            const { module, action } = r.permission;
            if (!matrix[module])
                matrix[module] = {};
            matrix[module][action] = true;
            permissions.push(`${module}:${action}`);
        }
    }
    return { user, permissions, matrix };
});
exports.getProfile = getProfile;
const updateProfile = (userId, body, file) => __awaiter(void 0, void 0, void 0, function* () {
    const ALLOWED_FIELDS = ["firstName", "lastName", "phone", "dob", "tallyGuid", "tallyName", "tallyStartDate"];
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
        if (body[field] !== undefined && body[field] !== "") {
            updates[field] = body[field];
        }
    }
    if (file) {
        updates.profile = file.location;
    }
    if (Object.keys(updates).length === 0)
        throw new serviceError_1.ServiceError("No fields provided to update");
    const user = yield AuthRepo.findUserById(Number(userId));
    if (!user)
        throw new serviceError_1.ServiceError("User not found");
    const updatePayload = Object.assign({}, updates);
    if (updatePayload.tallyStartDate) {
        updatePayload.tallyStartDate = new Date(updatePayload.tallyStartDate);
    }
    yield user.update(updatePayload);
    const updatedUser = yield AuthRepo.findUserById(Number(userId), [
        "id", "firstName", "lastName", "email", "phone", "dob", "profile", "role", "tallyGuid", "tallyName", "tallyStartDate",
    ]);
    return { user: updatedUser };
});
exports.updateProfile = updateProfile;
const updatePassword = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { oldPassword, newPassword } = body || {};
    if (!oldPassword || !newPassword)
        throw new serviceError_1.ServiceError("Please provide old password and new password");
    if (oldPassword === newPassword)
        throw new serviceError_1.ServiceError("New password must be different from the old password");
    const user = yield Middleware.getById(dbConnection_1.User, Number(userId));
    if (!user)
        throw new serviceError_1.ServiceError("User not found");
    const isPasswordValid = yield bcrypt_1.default.compare(oldPassword, user.get("password"));
    if (!isPasswordValid)
        throw new serviceError_1.ServiceError("Old password is incorrect");
    user.set("password", newPassword);
    yield user.save();
});
exports.updatePassword = updatePassword;
const forgotPassword = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, tenantId } = body || {};
    if (!email)
        throw new serviceError_1.ServiceError("Email is missing");
    const loginTenantId = tenantId ? Number(tenantId) : null;
    const user = yield Middleware.FindByEmailInTenant(dbConnection_1.User, email, loginTenantId);
    // FIX: throwing "User not found" here let anyone enumerate which emails
    // are registered (including which Owners/Admins exist) with zero
    // authentication. The controller always responds "OTP sent to your
    // email" regardless — silently no-op instead of erroring when there's no
    // matching account, so the response is identical either way.
    if (!user)
        return;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    yield user.save();
    (0, email_1.forgotpassword)("Password Reset OTP", otp, user.email);
});
exports.forgotPassword = forgotPassword;
const verifyOtp = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp, tenantId } = body || {};
    if (!email || !otp)
        throw new serviceError_1.ServiceError("Email and OTP are required");
    const loginTenantId = tenantId ? Number(tenantId) : null;
    const user = yield Middleware.FindByEmailInTenant(dbConnection_1.User, email, loginTenantId);
    if (!user)
        throw new serviceError_1.ServiceError("User not found");
    if (user.otp !== otp)
        throw new serviceError_1.ServiceError("Invalid OTP");
    if (!user.otpExpiry || new Date(user.otpExpiry) < new Date())
        throw new serviceError_1.ServiceError("OTP has expired");
    user.otp = null;
    user.otpExpiry = null;
    yield user.save();
});
exports.verifyOtp = verifyOtp;
const changePassword = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, newPassword, tenantId } = body || {};
    if (!email || !newPassword)
        throw new serviceError_1.ServiceError("Email and new password are required");
    const loginTenantId = tenantId ? Number(tenantId) : null;
    const user = yield Middleware.FindByEmailInTenant(dbConnection_1.User, email, loginTenantId);
    if (!user)
        throw new serviceError_1.ServiceError("User not found");
    user.set("password", newPassword);
    yield user.save();
});
exports.changePassword = changePassword;
