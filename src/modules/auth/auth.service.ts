import bcrypt from "bcrypt";
import { ServiceError } from "../shared/serviceError";
import * as Middleware from "../../app/middlewear/comman";
import { sendEmail, forgotpassword } from "../../config/email";
import { User } from "../../config/dbConnection";
import { getAllChildUserIds } from "../shared/userHierarchy";
import * as AuthRepo from "./auth.repository";

// ============================================================
// Auth service — validation + orchestration. Byte-for-byte port of the
// previous Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword/
// forgotPassword/verifyOtp/changePassword controller bodies in admin.ts.
// ============================================================

const UNIQUE_ROLES = ["super_admin"];

// Roles a caller is allowed to register an account as — mirrors
// ASSIGNABLE_ROLES in permission.ts. "super_admin" isn't a key here: it's
// handled as a standalone bootstrap case below (no caller required at all).
const REGISTER_ALLOWED_ROLES: Record<string, string[]> = {
  super_admin: ["user", "admin", "manager", "sale_person"],
  user: ["admin", "manager", "sale_person"],
  admin: ["manager", "sale_person"],
  manager: ["sale_person"],
};

interface MulterS3File extends Express.Multer.File {
  bucket: string;
  key: string;
  location?: string;
  etag?: string;
}

export const register = async (body: any, callerData?: { userId?: number | string; role?: string }) => {
  const { email, password, firstName, lastName, phone, dob, role, createdBy, permissionIds, branchId, shiftId } = body;

  const requiredFields: Record<string, any> = { email, password, firstName, lastName, phone, dob, role };
  for (const key in requiredFields) {
    if (!requiredFields[key]) throw new ServiceError(`${key} is required`);
  }

  // ── Authorization ────────────────────────────────────────────────────
  // FIX: this endpoint previously trusted role/createdBy straight from the
  // request body with zero verification of the caller — anyone could POST
  // role:"admin" with an arbitrary createdBy and get an account that
  // auto-inherits that creator's permissions (see below). "super_admin" is
  // the sole exception: there's no seed script, so the very first
  // super_admin has only ever been created through this same endpoint,
  // before any JWT could exist — UNIQUE_ROLES below still caps it at one.
  const callerRole = callerData?.role;
  const callerId = callerData?.userId ? Number(callerData.userId) : null;

  if (role !== "super_admin") {
    if (!callerRole || !callerId || !(REGISTER_ALLOWED_ROLES[callerRole] || []).includes(role)) {
      throw new ServiceError(
        callerRole
          ? `${callerRole} is not authorized to register a '${role}' account`
          : "Authentication is required to register this account"
      );
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
  if (role !== "super_admin" && primaryCreatorId && !isNaN(primaryCreatorId) && primaryCreatorId !== callerId) {
    const childIds = await getAllChildUserIds(callerId!);
    if (!childIds.includes(primaryCreatorId)) {
      throw new ServiceError("createdBy must be yourself or one of your own team members");
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
  let resolvedTenantId: number | null = null;

  if (primaryCreatorId && !isNaN(primaryCreatorId) && role !== "super_admin") {
    const creator = (await AuthRepo.findUserById(primaryCreatorId, ["id", "role", "tenantId"])) as any;

    if (creator) {
      if (creator.role === "user") {
        resolvedTenantId = creator.id;
      } else if (creator.tenantId) {
        resolvedTenantId = creator.tenantId;
      }
    }
  }

  // Check if user with same email exists — scoped to tenant.
  // super_admin and user (tenant roots) are globally unique; admin/manager/
  // sale_person are unique only within their tenant.
  const emailCheckTenantId = role === "super_admin" || role === "user" ? null : resolvedTenantId;
  const isExist = await Middleware.FindByEmailInTenant(User, email, emailCheckTenantId);
  if (isExist) throw new ServiceError("Email already exists");

  // Check role — admin/super_admin only once in DB
  if (UNIQUE_ROLES.includes(role)) {
    const existing = await Middleware.findByRole(User, role);
    if (existing) throw new ServiceError(`${role} already exists. Only one ${role} can be created.`);
  }

  const resolvedBranchId =
    branchId !== undefined && branchId !== null && branchId !== "" && !isNaN(Number(branchId))
      ? Number(branchId)
      : null;

  const resolvedShiftId =
    shiftId !== undefined && shiftId !== null && shiftId !== "" && !isNaN(Number(shiftId))
      ? Number(shiftId)
      : null;

  const obj: any = {
    email,
    password,
    firstName,
    lastName,
    phone,
    dob,
    role,
    tenantId: resolvedTenantId,
    branchId: resolvedBranchId,
    shiftId: resolvedShiftId,
    ...(primaryCreatorId && !isNaN(primaryCreatorId) ? { createdBy: primaryCreatorId } : {}),
  };
  const item = await AuthRepo.createUser(obj);

  // If this is a tenant root (user role created by super_admin), point tenantId at self
  if (role === "user" && !resolvedTenantId) {
    await item.update({ tenantId: item.getDataValue("id") });
  }

  if (role === "sale_person" || role === "manager" || role === "admin" || role === "user") {
    // Uses the same resolved primaryCreatorId as obj.createdBy above (which
    // may be the self-authorship default, not just the raw request body) —
    // previously this checked the raw createdBy field, so an omitted
    // createdBy left User.createdBy set but the UserCreators join-table
    // link missing, which is what the hierarchy walks actually use.
    const ids = Array.isArray(createdBy)
      ? createdBy.map((id: any) => Number(id)).filter((id) => !isNaN(id))
      : primaryCreatorId !== undefined && !isNaN(primaryCreatorId)
      ? [primaryCreatorId]
      : [];

    if (ids.length > 0) {
      await (item as any).setCreators(ids);
    }

    // When a new admin is created by a user, inherit that user's permissions
    if (role === "admin" && ids.length > 0) {
      const newAdminId = item.getDataValue("id") as number;
      for (const creatorId of ids) {
        const creator = await AuthRepo.findUserByRoleAndId(creatorId, "user");
        if (!creator) continue;

        const creatorPerms = await AuthRepo.findUserPermissionsForUser(creatorId);

        if (creatorPerms.length > 0) {
          await Promise.all(
            creatorPerms.map((p: any) =>
              AuthRepo.grantPermission({
                userId: newAdminId,
                permissionId: p.permissionId,
                companyId: null,
                grantedBy: creatorId,
              })
            )
          );
        }
      }
    }
  }

  // When super_admin creates a user (role="user"), assign permissions immediately if provided
  if (role === "user" && Array.isArray(permissionIds) && permissionIds.length > 0 && createdBy) {
    const granterId = Number(createdBy);
    const granterUser = await AuthRepo.findUserByRoleAndId(granterId, "super_admin");

    if (granterUser) {
      const newUserId = item.getDataValue("id") as number;
      const validPerms = await AuthRepo.findPermissionsByIds(permissionIds);

      await Promise.all(
        validPerms.map((p: any) =>
          AuthRepo.grantPermission({
            userId: newUserId,
            permissionId: p.id,
            companyId: null,
            grantedBy: granterId,
          })
        )
      );
    }
  }

  const { accessToken, refreshToken } = Middleware.CreateToken(
    String(item.getDataValue("id")),
    String(item.getDataValue("role"))
  );
  await item.update({ refreshToken });

  // Email login credentials in the background (no await — don't block registration)
  sendEmail("Welcome to SalesVera - Your Login Credentials", password, email, firstName, lastName).catch((err) =>
    console.error(`Failed to send credentials email to ${email}:`, err)
  );

  return { item, accessToken, role };
};

export const login = async (body: any) => {
  const { email, password, tenantId, deviceType } = body || {};

  if (!email || !password) throw new ServiceError("Email and password are required");

  const loginTenantId = tenantId ? Number(tenantId) : null;
  const user = await Middleware.FindByEmailInTenant(User, email, loginTenantId);
  if (!user) throw new ServiceError("Invalid email or password");

  const allowedRoles = ["admin", "manager", "super_admin", "user"];
  const userRole = user.get("role") as string;

  if (!allowedRoles.includes(userRole)) {
    throw new ServiceError("Access restricted. Only admin, manager & user can login.");
  }

  // Exe (desktop) login is admin-only; web login is unrestricted (within allowedRoles)
  if (deviceType === "exe" && userRole !== "admin") {
    throw new ServiceError("Only admin can login from the desktop application");
  }

  const hashedPassword = user.get("password") as string;
  const isPasswordValid = await bcrypt.compare(password, hashedPassword);
  if (!isPasswordValid) throw new ServiceError("Invalid email or password");

  const userId = user.get("id") as number;

  // ── Resolve companyId for the JWT ─────────────────────────────────
  let companyId: number | null = null;

  if (userRole === "admin") {
    const company = await AuthRepo.findCompanyByAdminId(userId);
    companyId = company ? company.id : null;
    // Fall back to the multi-company junction table if this admin isn't the
    // single primary owner (Company.adminId) of any company, but has been
    // assigned to one or more companies via assign-company-admin.
    if (!companyId) {
      const assignment = await AuthRepo.findCompanyAdminAssignment(userId);
      companyId = assignment ? assignment.companyId : null;
    }
  } else if (userRole === "manager") {
    const assignment = await AuthRepo.findCompanyManagerAssignment(userId);
    companyId = assignment ? assignment.companyId : null;
  } else if (userRole === "user") {
    const company = await AuthRepo.findCompanyByUserId(userId);
    companyId = company ? company.id : null;
  }

  // Priority 2: Fallback — find ANY company where this user has assigned permissions
  if (!companyId && userRole !== "super_admin" && userRole !== "user") {
    const firstPermission = await AuthRepo.findFirstUserPermissionCompany(userId);
    companyId = firstPermission ? firstPermission.companyId : null;
  }

  // ── Restore last active company (from previous logout), if still accessible ──
  const lastLoginCompanyId = user.get("lastLoginCompanyId") as number | null;
  if (lastLoginCompanyId && (userRole === "admin" || userRole === "manager" || userRole === "sale_person")) {
    let hasAccess = false;

    if (userRole === "admin") {
      const company = await AuthRepo.findCompanyByIdAndAdmin(lastLoginCompanyId, userId);
      hasAccess = !!company;
      if (!hasAccess) {
        const assignment = await AuthRepo.findCompanyAdminAssignmentFor(lastLoginCompanyId, userId);
        hasAccess = !!assignment;
      }
    } else if (userRole === "manager") {
      const assignment = await AuthRepo.findCompanyManagerAssignmentFor(lastLoginCompanyId, userId);
      hasAccess = !!assignment;
    } else if (userRole === "sale_person") {
      const company = await AuthRepo.findCompanyByIdAndManagerOwner(lastLoginCompanyId, userId);
      hasAccess = !!company;
    }

    if (hasAccess) companyId = lastLoginCompanyId;
  }

  const { accessToken, refreshToken } = Middleware.CreateToken(String(userId), userRole, companyId);
  await user.update({ refreshToken });

  // ── Fetch Permissions for the Login Response ─────────────────────
  let permissions: string[] = [];
  if (userRole === "super_admin" || userRole === "user") {
    const all = await AuthRepo.findAllPermissions();
    permissions = all.map((p: any) => `${p.module}:${p.action}`);
  } else if (userRole === "admin" && companyId) {
    const all = await AuthRepo.findAllPermissions();
    permissions = all.map((p: any) => `${p.module}:${p.action}`);
  } else {
    const records = await AuthRepo.findUserPermissionsWithPermission(userId);
    permissions = records.map((r: any) => `${r.permission.module}:${r.permission.action}`);
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
};

export const logout = async (userId: number, body: any) => {
  const { lastLoginCompanyId } = body || {};

  // Frontend sends {} when the user has no active company context yet — nothing to persist.
  if (lastLoginCompanyId !== undefined) {
    await AuthRepo.updateUserFields(userId, {
      lastLoginCompanyId: lastLoginCompanyId === null ? null : Number(lastLoginCompanyId),
    });
  }
};

export const getProfile = async (userId: number, role: string, companyId: number | undefined) => {
  const user = await AuthRepo.findUserWithProfileIncludes(Number(userId), role, role !== "manager");

  // For managers: attach active company (from JWT companyId) onto user.company
  if (role === "manager" && companyId) {
    const activeCompany = await AuthRepo.findCompanyWithFullDetail(Number(companyId));
    if (user && activeCompany) {
      (user as any).dataValues.company = activeCompany;
    }
  }

  const permissions: string[] = [];
  const matrix: Record<string, Record<string, boolean>> = {};

  if (role === "super_admin" || role === "user") {
    const all = await AuthRepo.findAllPermissions(true);
    for (const p of all as any[]) {
      if (!matrix[p.module]) matrix[p.module] = {};
      matrix[p.module][p.action] = true;
      permissions.push(`${p.module}:${p.action}`);
    }
  } else {
    const records = await AuthRepo.findUserPermissionsWithPermission(Number(userId));
    for (const r of records as any[]) {
      const { module, action } = r.permission;
      if (!matrix[module]) matrix[module] = {};
      matrix[module][action] = true;
      permissions.push(`${module}:${action}`);
    }
  }

  return { user, permissions, matrix };
};

export const updateProfile = async (userId: number, body: any, file: MulterS3File | undefined) => {
  const ALLOWED_FIELDS = ["firstName", "lastName", "phone", "dob", "tallyGuid", "tallyName", "tallyStartDate"] as const;
  type AllowedField = (typeof ALLOWED_FIELDS)[number];

  const updates: Partial<Record<AllowedField, string>> & { profile?: string } = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined && body[field] !== "") {
      updates[field] = body[field];
    }
  }

  if (file) {
    updates.profile = file.location;
  }

  if (Object.keys(updates).length === 0) throw new ServiceError("No fields provided to update");

  const user = await AuthRepo.findUserById(Number(userId));
  if (!user) throw new ServiceError("User not found");

  const updatePayload: any = { ...updates };
  if (updatePayload.tallyStartDate) {
    updatePayload.tallyStartDate = new Date(updatePayload.tallyStartDate);
  }

  await user.update(updatePayload);

  const updatedUser = await AuthRepo.findUserById(Number(userId), [
    "id", "firstName", "lastName", "email", "phone", "dob", "profile", "role", "tallyGuid", "tallyName", "tallyStartDate",
  ]);

  return { user: updatedUser };
};

export const updatePassword = async (userId: number, body: any) => {
  const { oldPassword, newPassword } = body || {};
  if (!oldPassword || !newPassword) throw new ServiceError("Please provide old password and new password");
  if (oldPassword === newPassword) throw new ServiceError("New password must be different from the old password");

  const user = await Middleware.getById(User, Number(userId));
  if (!user) throw new ServiceError("User not found");

  const isPasswordValid = await bcrypt.compare(oldPassword, user.get("password") as string);
  if (!isPasswordValid) throw new ServiceError("Old password is incorrect");

  user.set("password", newPassword);
  await user.save();
};

export const forgotPassword = async (body: any) => {
  const { email, tenantId } = body || {};
  if (!email) throw new ServiceError("Email is missing");

  const loginTenantId = tenantId ? Number(tenantId) : null;
  const user: any = await Middleware.FindByEmailInTenant(User, email, loginTenantId);
  if (!user) throw new ServiceError("User not found");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  forgotpassword("Password Reset OTP", otp, user.email);
};

export const verifyOtp = async (body: any) => {
  const { email, otp, tenantId } = body || {};
  if (!email || !otp) throw new ServiceError("Email and OTP are required");

  const loginTenantId = tenantId ? Number(tenantId) : null;
  const user: any = await Middleware.FindByEmailInTenant(User, email, loginTenantId);
  if (!user) throw new ServiceError("User not found");

  if (user.otp !== otp) throw new ServiceError("Invalid OTP");
  if (!user.otpExpiry || new Date(user.otpExpiry) < new Date()) throw new ServiceError("OTP has expired");

  user.otp = null;
  user.otpExpiry = null;
  await user.save();
};

export const changePassword = async (body: any) => {
  const { email, newPassword, tenantId } = body || {};
  if (!email || !newPassword) throw new ServiceError("Email and new password are required");

  const loginTenantId = tenantId ? Number(tenantId) : null;
  const user: any = await Middleware.FindByEmailInTenant(User, email, loginTenantId);
  if (!user) throw new ServiceError("User not found");

  user.set("password", newPassword);
  await user.save();
};
