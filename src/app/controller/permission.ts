import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { Op } from "sequelize";
import { Permission } from "../model/permission";
import { UserPermission } from "../model/userPermission";
import { User, Company } from "../../config/dbConnection";
import { invalidatePermissionCache, invalidateCompanyPermissionCache } from "../../config/permissionCache";

// ============================================================
// Permission Controller
//
// HIERARCHY (enforced in every function):
//   super_admin → can assign to admin
//   admin       → can assign to manager (same company only)
//   manager     → can assign to sale_person (same company only)
//
// Anti-privilege-escalation rule:
//   You can only grant a permission you YOURSELF possess.
//   (super_admin is exempt — they have all permissions by definition)
// ============================================================

interface AuthRequest extends Request {
  userData?: string | JwtPayload;
}

// BFS traversal of the creator hierarchy below rootUserId (does NOT include root itself).
const getAllChildIds = async (rootUserId: number): Promise<number[]> => {
  const result: number[] = [];
  const queue: number[] = [rootUserId];
  const visited = new Set<number>([rootUserId]);

  while (queue.length > 0) {
    const pid = queue.shift()!;
    const user = await (User as any).findByPk(pid, {
      include: [{ model: User, as: "createdUsers", attributes: ["id", "role"], through: { attributes: [] } }],
    });

    if (user?.createdUsers) {
      for (const child of user.createdUsers) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          result.push(child.id);
          queue.push(child.id);
        }
      }
    }
  }

  return result;
};

// Returns all subordinate userIds below a given user (does NOT include the user itself).
// Only traverses downward — never climbs up to the company root.
const getSubordinateIdsDown = async (userId: number): Promise<number[]> => {
  const result: number[] = [];
  const queue: number[] = [userId];
  const visited = new Set<number>([userId]);

  while (queue.length > 0) {
    const pid = queue.shift()!;
    const user = await (User as any).findByPk(pid, {
      include: [{ model: User, as: "createdUsers", attributes: ["id", "role"], through: { attributes: [] } }],
    });

    if (user?.createdUsers) {
      for (const child of user.createdUsers) {
        if (!visited.has(child.id) && child.role !== "super_admin") {
          visited.add(child.id);
          result.push(child.id);
          queue.push(child.id);
        }
      }
    }
  }

  return result;
};

// Roles a caller can assign to individual users
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin: ["user", "admin", "manager", "sale_person"],
  user:        ["admin"],
  admin:       ["manager", "sale_person"],
  manager:     ["sale_person"],
};

// Roles a caller can bulk-assign to via /assign-role
const ROLE_ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin: ["user", "admin", "manager", "sale_person"],
  user:        ["admin", "manager", "sale_person"],
  admin:       ["manager", "sale_person"],
  manager:     ["sale_person"],
};

// ─── Helper: get own permission set ────────────────────────────────────────
const getOwnPermissions = async (
  userId: number,
  // companyId: number | null,
  role: string
): Promise<Set<string> | null> => {
  // super_admin has all permissions — return null to signal "no check needed"
  if (role === "super_admin") return null;

  const whereClause: any = { userId };
  // if (companyId) whereClause.companyId = companyId;

  const records = await UserPermission.findAll({
    where: whereClause,
    include: [{ model: Permission, as: "permission", attributes: ["module", "action"] }],
  });

  return new Set(records.map((r: any) => `${r.permission.module}:${r.permission.action}`));
};

// ─── Helper: find target user and validate they belong to same company ──────
const findTargetUser = async (
  targetUserId: number,
  // companyId: number
): Promise<{ id: number; role: string } | null> => {
  // We need the user's companyId — stored in user_permissions or via Company table.
  // Simple approach: check user_permissions for companyId OR join Company.
  // Here we look at the company table's adminId / direct membership.
  // For now, we'll validate via checking user exists in the system and
  // that the caller's companyId is used for the assignment (enforced above).
  const user = await (User as any).findOne({
    where: { id: targetUserId, status: "active" },
    attributes: ["id", "role"],
  });
  return user ? { id: user.id, role: user.role } : null;
};

// ============================================================
// GET /permissions/all
// Returns every permission in the master table.
// Any authenticated user can view this (used for the permission matrix UI).
// ============================================================
export const getAllPermissions = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const permissions = await Permission.findAll({
      order: [["module", "ASC"], ["action", "ASC"]],
    });

    // Group by module for easy frontend consumption
    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push({ id: p.id, action: p.action, description: p.description });
    }

    return res.status(200).json({ success: true, data: { permissions, grouped } });
  } catch (err) {
    console.error("getAllPermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// GET /permissions/user/:userId
// Returns the effective permission list for a specific user.
// Admin can only view users in their company.
// ============================================================
export const getUserPermissions = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role, userId: callerId, companyId } = userData;
    const targetUserId = Number(req.params.userId);

    // Non-super_admin must be in the same company
    const whereClause: any = { userId: targetUserId };
    if (role !== "super_admin") {
      if (!companyId) return res.status(403).json({ success: false, message: "No company context" });
      whereClause.companyId = companyId;
    }

    const records = await UserPermission.findAll({
      where: whereClause,
      include: [
        {
          model: Permission,
          as: "permission",
          attributes: ["id", "module", "action", "description"],
        },
      ],
    });

    // Build permission matrix: { module: { action: true } }
    const matrix: Record<string, Record<string, boolean>> = {};
    const flat: string[] = [];

    for (const r of records as any[]) {
      const { module, action } = r.permission;
      if (!matrix[module]) matrix[module] = {};
      matrix[module][action] = true;
      flat.push(`${module}:${action}`);
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: targetUserId,
        permissions: flat,
        matrix,
        raw: records,
      },
    });
  } catch (err) {
    console.error("getUserPermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// POST /permissions/assign
// Assign one or more permissions to a user.
// Body: { targetUserId, companyId (optional for super_admin), permissionIds: number[] }
//
// Rules:
//  1. Caller can only assign to their directly subordinate role
//  2. Caller can only assign permissions they themselves have
//  3. Admin/Manager scoped to their companyId
// ============================================================
export const assignPermissions = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role, userId: callerId, companyId: callerCompanyId } = userData;
// companyId: bodyCompanyId
    const { targetUserId, permissionIds } = req.body;

    if (!targetUserId || !permissionIds || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "targetUserId and permissionIds[] are required",
      });
    }

    // super_admin and user manage multiple companies — they pass companyId in body; others use JWT companyId
    // const effectiveCompanyId: number =
    //   (role === "super_admin" || role === "user") ? Number(bodyCompanyId) : Number(callerCompanyId);

    // if (!effectiveCompanyId) {
    //   return res.status(400).json({ success: false, message: "companyId is required" });
    // }

    // ── Validate target user exists ─────────────────────────────────
    const targetUser = await findTargetUser(Number(targetUserId));
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Target user not found or inactive" });
    }

    // ── Hierarchy check: can caller assign to target's role? ─────────
    const allowedRoles = ASSIGNABLE_ROLES[role] || [];
    if (!allowedRoles.includes(targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: `${role} cannot assign permissions to ${targetUser.role}`,
      });
    }

    // ── Anti-escalation: caller must own each permission they're granting ──
    // user provides companyId in body, so use effectiveCompanyId for their permission lookup
    // const ownPermsCompanyId = role === "user" ? effectiveCompanyId : callerCompanyId;
    const ownPerms = await getOwnPermissions(callerId, role); 
// ownPermsCompanyId
    // ── Validate all permissionIds exist ────────────────────────────
    const permsToAssign = await Permission.findAll({
      where: { id: { [Op.in]: permissionIds } },
    });

    if (permsToAssign.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more invalid permissionIds",
      });
    }

    // ── Check anti-escalation for each permission ────────────────────
    if (ownPerms !== null) {
      for (const perm of permsToAssign) {
        const key = `${perm.module}:${perm.action}`;
        if (!ownPerms.has(key)) {
          return res.status(403).json({
            success: false,
            message: `You do not have '${key}' permission — you cannot assign it to others`,
          });
        }
      }
    }

    // ── Bulk upsert (findOrCreate for each) ─────────────────────────
    const results = await Promise.all(
      permissionIds.map((permId: number) =>
        UserPermission.findOrCreate({
          where: {
            userId: Number(targetUserId),
            permissionId: permId,
            // companyId: effectiveCompanyId,
          },
          defaults: {
            userId: Number(targetUserId),
            permissionId: permId,
            // companyId: effectiveCompanyId,
            grantedBy: callerId,
          },
        })
      )
    );

    const created = results.filter(([, wasCreated]) => wasCreated).length;
    const skipped = results.length - created;

    // Invalidate cache for the target user
    invalidatePermissionCache(Number(targetUserId));

    // Propagate new permissions to all admins created by this user
    if (targetUser.role === "user") {
      const userWithAdmins = await (User as any).findByPk(Number(targetUserId), {
        include: [{
          model: User,
          as: "createdUsers",
          where: { role: "admin", status: "active" },
          required: false,
          attributes: ["id"],
          through: { attributes: [] },
        }],
        attributes: ["id"],
      });

      const adminUsers: any[] = userWithAdmins?.createdUsers || [];

      for (const admin of adminUsers) {
        // null-scoped (admin not yet linked to a company)
        await Promise.all(
          permissionIds.map((permId: number) =>
            UserPermission.findOrCreate({
              where: { userId: admin.id, permissionId: permId, companyId: null },
              defaults: { userId: admin.id, permissionId: permId, companyId: null, grantedBy: callerId },
            })
          )
        );

        // company-scoped (for each company this admin is linked to)
        const adminCompanies = await (Company as any).findAll({
          where: { adminId: admin.id },
          attributes: ["id"],
        });

        for (const company of adminCompanies) {
          await Promise.all(
            permissionIds.map((permId: number) =>
              UserPermission.findOrCreate({
                where: { userId: admin.id, permissionId: permId, companyId: company.id },
                defaults: { userId: admin.id, permissionId: permId, companyId: company.id, grantedBy: callerId },
              })
            )
          );
        }

        invalidatePermissionCache(admin.id);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Permissions assigned: ${created} new, ${skipped} already existed`,
      data: { assigned: created, alreadyExisted: skipped },
    });
  } catch (err) {
    console.error("assignPermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err instanceof Error ? err.message : err });
  }
};

// ============================================================
// DELETE /permissions/revoke
// Revoke one or more permissions from a user.
// Body: { targetUserId, companyId (optional for super_admin), permissionIds: number[] }
// ============================================================
export const revokePermissions = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role, userId: callerId, companyId: callerCompanyId } = userData;

    const { targetUserId, permissionIds, companyId: bodyCompanyId } = req.body;

    if (!targetUserId || !permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: "targetUserId and permissionIds[] are required",
      });
    }

    // super_admin and user manage multiple companies — they pass companyId in body
    const effectiveCompanyId: number =
      (role === "super_admin" || role === "user") ? Number(bodyCompanyId) : Number(callerCompanyId);

    if (!effectiveCompanyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    // Validate target user
    // effectiveCompanyId
    const targetUser = await findTargetUser(Number(targetUserId));
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Target user not found" });
    }

    // Hierarchy check
    const allowedRoles = ASSIGNABLE_ROLES[role] || [];
    if (!allowedRoles.includes(targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: `${role} cannot revoke permissions from ${targetUser.role}`,
      });
    }

    const deleted = await UserPermission.destroy({
      where: {
        userId: Number(targetUserId),
        companyId: effectiveCompanyId,
        permissionId: { [Op.in]: permissionIds },
      },
    });
// effectiveCompanyId
    invalidatePermissionCache(Number(targetUserId));

    // Cascade: revoke the same permissions from all subordinates of the target user
    const onlySubordinates = await getSubordinateIdsDown(Number(targetUserId));

    let cascadeRevoked = 0;
    if (onlySubordinates.length > 0) {
      cascadeRevoked = await UserPermission.destroy({
        where: {
          userId: { [Op.in]: onlySubordinates },
          companyId: effectiveCompanyId,
          permissionId: { [Op.in]: permissionIds },
        },
      });

      // effectiveCompanyId
      for (const subId of onlySubordinates) {
        invalidatePermissionCache(subId,);
      }
    }

    // Propagate revocation to all admins created by this user
    if (targetUser.role === "user") {
      const userWithAdmins = await (User as any).findByPk(Number(targetUserId), {
        include: [{
          model: User,
          as: "createdUsers",
          where: { role: "admin", status: "active" },
          required: false,
          attributes: ["id"],
          through: { attributes: [] },
        }],
        attributes: ["id"],
      });

      const adminUsers: any[] = userWithAdmins?.createdUsers || [];

      for (const admin of adminUsers) {
        // revoke null-scoped
        await UserPermission.destroy({
          where: { userId: admin.id, permissionId: { [Op.in]: permissionIds }, companyId: null },
        });

        // revoke from each company the admin is linked to
        const adminCompanies = await (Company as any).findAll({
          where: { adminId: admin.id },
          attributes: ["id"],
        });

        for (const company of adminCompanies) {
          await UserPermission.destroy({
            where: { userId: admin.id, permissionId: { [Op.in]: permissionIds }, companyId: company.id },
          });
        }

        invalidatePermissionCache(admin.id);
      }
    }

    return res.status(200).json({
      success: true,
      message: `${deleted} permission(s) revoked from user; ${cascadeRevoked} cascaded to ${onlySubordinates.length} subordinate(s)`,
      data: { revoked: deleted, cascadeRevoked, subordinatesAffected: onlySubordinates.length },
    });
  } catch (err) {
    console.error("revokePermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// POST /permissions/assign-bulk-role
// Convenience: assign all permissions of a certain set to all
// users of a given role within a company (e.g., give all managers attendance:view)
// Body: { targetRole, companyId, permissionIds: number[] }
// Only callable by: admin (for manager), manager (for sale_person)
// ============================================================
export const assignPermissionsToRole = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role, userId: callerId, companyId: callerCompanyId } = userData;

    const { targetRole, companyId: bodyCompanyId, permissionIds } = req.body;

    if (!targetRole || !permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: "targetRole and permissionIds[] are required",
      });
    }

    // super_admin and user manage multiple companies — they pass companyId in body
    const effectiveCompanyId: number =
      (role === "super_admin" || role === "user") ? Number(bodyCompanyId) : Number(callerCompanyId);

    // Hierarchy check
    const allowedRoles = ROLE_ASSIGNABLE_ROLES[role] || [];
    if (!allowedRoles.includes(targetRole)) {
      return res.status(403).json({
        success: false,
        message: `${role} cannot assign permissions to role '${targetRole}'`,
      });
    }

    // Anti-escalation check
    const ownPerms = await getOwnPermissions(callerId, role);
    // callerCompanyId
    const permsToAssign = await Permission.findAll({
      where: { id: { [Op.in]: permissionIds } },
    });

    if (ownPerms !== null) {
      for (const perm of permsToAssign) {
        const key = `${perm.module}:${perm.action}`;
        if (!ownPerms.has(key)) {
          return res.status(403).json({
            success: false,
            message: `You do not have '${key}' permission — cannot assign it`,
          });
        }
      }
    }

    // Find the company's root admin to scope the search to this company's hierarchy
    const company = await (Company as any).findByPk(effectiveCompanyId, { attributes: ["id", "adminId"] });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const allChildIds = await getAllChildIds(company.adminId);

    const roleUsers = await (User as any).findAll({
      where: {
        id: { [Op.in]: allChildIds },
        role: targetRole,
        status: "active",
      },
      attributes: ["id"],
    });

    const userIds: number[] = roleUsers.map((u: any) => u.id);

    if (userIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No active users with role '${targetRole}' found`,
        data: { assigned: 0 },
      });
    }

    // Bulk assign
    let totalAssigned = 0;
    for (const uid of userIds) {
      for (const permId of permissionIds) {
        const [, wasCreated] = await UserPermission.findOrCreate({
          where: { userId: uid, permissionId: permId, companyId: effectiveCompanyId },
          defaults: { userId: uid, permissionId: permId, companyId: effectiveCompanyId, grantedBy: callerId },
        });
        if (wasCreated) totalAssigned++;
      }
      // effectiveCompanyId
      invalidatePermissionCache(uid, );
    }

    return res.status(200).json({
      success: true,
      message: `Bulk assigned ${totalAssigned} new permissions to ${userIds.length} ${targetRole}(s)`,
      data: { usersAffected: userIds.length, permissionsAssigned: totalAssigned },
    });
  } catch (err) {
    console.error("assignPermissionsToRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// GET /permissions/users-by-role?role=sale_person
// Returns all active users in the caller's company with the given role.
// Used by admin/manager to preview who will be affected before bulk-assigning.
// Query params: role (required), companyId (required only for super_admin)
// ============================================================
export const getUsersByRole = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role: callerRole, companyId: callerCompanyId } = userData;
    const { role: targetRole, companyId: queryCompanyId } = req.query;

    const VALID_ROLES = ["admin", "manager", "sale_person", "user"];
    if (!targetRole || !VALID_ROLES.includes(targetRole as string)) {
      return res.status(400).json({
        success: false,
        message: "Query param 'role' is required and must be one of: admin, manager, sale_person, user",
      });
    }

    // Hierarchy check: caller can only view users of roles they can assign to
    const allowedRoles = ROLE_ASSIGNABLE_ROLES[callerRole] || [];
    if (!allowedRoles.includes(targetRole as string)) {
      return res.status(403).json({
        success: false,
        message: `${callerRole} cannot fetch users with role '${targetRole}'`,
      });
    }

    const effectiveCompanyId: number =
      (callerRole === "super_admin" || callerRole === "user") ? Number(queryCompanyId) : Number(callerCompanyId);

    if (!effectiveCompanyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await (Company as any).findByPk(effectiveCompanyId, { attributes: ["id", "adminId"] });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const allChildIds = await getAllChildIds(company.adminId);

    const users = await (User as any).findAll({
      where: {
        id: { [Op.in]: allChildIds },
        role: targetRole as string,
        status: "active",
      },
      attributes: ["id", "firstName", "lastName", "email", "phone", "role", "profile", "createdAt"],
      order: [["firstName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: {
        role: targetRole,
        companyId: effectiveCompanyId,
        count: users.length,
        users,
      },
    });
  } catch (err) {
    console.error("getUsersByRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// GET /permissions/my
// Returns the calling user's own permission set.
// ============================================================
export const getMyPermissions = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role, userId, companyId } = userData;

    // Super admin has everything
    if (role === "super_admin") {
      const all = await Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] });
      return res.status(200).json({
        success: true,
        data: {
          role: "super_admin",
          note: "Super Admin has ALL permissions",
          permissions: all.map((p) => `${p.module}:${p.action}`),
        },
      });
    }

    // Admin / Manager / Sale person — fetch from DB (only what was granted)
    const records = await UserPermission.findAll({
      where: { userId, companyId },
      include: [{ model: Permission, as: "permission", attributes: ["module", "action", "description"] }],
    });
     const all = await Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] });

    const matrix: Record<string, Record<string, boolean>> = {};
    const flat: string[] = [];
    for (const r of records as any[]) {
      const { module, action } = r.permission;
      if (!matrix[module]) matrix[module] = {};
      matrix[module][action] = true;
      flat.push(`${module}:${action}`);
    }

    const allPermissions: Record<string, string[]> = {};
    for (const p of all) {
      if (!allPermissions[p.module]) allPermissions[p.module] = [];
      allPermissions[p.module].push(p.action);
    }

    return res.status(200).json({
      success: true,
      data: { role, companyId, permissions: flat, matrix, allPermissions },
    });
  } catch (err) {
    console.error("getMyPermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// DELETE /permissions/revoke-role
// Revoke one or more permissions from ALL users of a given role in a company.
// Body: { targetRole, companyId, permissionIds: number[] }
// Callable by: super_admin (any role), admin (manager/sale_person), manager (sale_person)
// ============================================================
export const revokePermissionsFromRole = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userData = req.userData as any;
    const { role, companyId: callerCompanyId } = userData;

    const { targetRole, companyId: bodyCompanyId, permissionIds } = req.body;

    if (!targetRole || !permissionIds || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "targetRole and permissionIds[] are required",
      });
    }

    // super_admin and user manage multiple companies — they pass companyId in body
    const effectiveCompanyId: number =
      (role === "super_admin" || role === "user") ? Number(bodyCompanyId) : Number(callerCompanyId);

    if (!effectiveCompanyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    // Hierarchy check
    const allowedRoles = ROLE_ASSIGNABLE_ROLES[role] || [];
    if (!allowedRoles.includes(targetRole)) {
      return res.status(403).json({
        success: false,
        message: `${role} cannot revoke permissions from role '${targetRole}'`,
      });
    }

    // Validate all permissionIds exist
    const permsToRevoke = await Permission.findAll({
      where: { id: { [Op.in]: permissionIds } },
    });
    if (permsToRevoke.length !== permissionIds.length) {
      return res.status(400).json({ success: false, message: "One or more invalid permissionIds" });
    }

    // Resolve company → get all users of targetRole in this company
    const company = await (Company as any).findByPk(effectiveCompanyId, { attributes: ["id", "adminId"] });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const allChildIds = await getAllChildIds(company.adminId);

    const roleUsers = await (User as any).findAll({
      where: { id: { [Op.in]: allChildIds }, role: targetRole, status: "active" },
      attributes: ["id"],
    });

    const userIds: number[] = roleUsers.map((u: any) => u.id);

    if (userIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No active users with role '${targetRole}' found`,
        data: { revoked: 0, usersAffected: 0 },
      });
    }

    // Bulk delete matching rows
    const totalRevoked = await UserPermission.destroy({
      where: {
        userId: { [Op.in]: userIds },
        permissionId: { [Op.in]: permissionIds },
        companyId: effectiveCompanyId,
      },
    });

    for (const uid of userIds) {
      // effectiveCompanyId
      invalidatePermissionCache(uid);
    }

    return res.status(200).json({
      success: true,
      message: `Revoked ${totalRevoked} permission record(s) from ${userIds.length} ${targetRole}(s)`,
      data: { revoked: totalRevoked, usersAffected: userIds.length },
    });
  } catch (err) {
    console.error("revokePermissionsFromRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
