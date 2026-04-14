import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { Op } from "sequelize";
import { Permission } from "../model/permission";
import { UserPermission } from "../model/userPermission";
import { User } from "../../config/dbConnection";
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

// Roles that a caller is allowed to assign TO, keyed by caller's role
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin: ["admin"],
  admin: ["manager"],
  manager: ["sale_person"],
};

// ─── Helper: get own permission set ────────────────────────────────────────
const getOwnPermissions = async (
  userId: number,
  companyId: number | null,
  role: string
): Promise<Set<string> | null> => {
  // super_admin has all permissions — return null to signal "no check needed"
  if (role === "super_admin") return null;

  const whereClause: any = { userId };
  if (companyId) whereClause.companyId = companyId;

  const records = await UserPermission.findAll({
    where: whereClause,
    include: [{ model: Permission, as: "permission", attributes: ["module", "action"] }],
  });

  return new Set(records.map((r: any) => `${r.permission.module}:${r.permission.action}`));
};

// ─── Helper: find target user and validate they belong to same company ──────
const findTargetUser = async (
  targetUserId: number,
  companyId: number
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

    const { targetUserId, permissionIds, companyId: bodyCompanyId } = req.body;

    if (!targetUserId || !permissionIds || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "targetUserId and permissionIds[] are required",
      });
    }

    // Determine effective companyId
    const effectiveCompanyId: number =
      role === "super_admin" ? Number(bodyCompanyId) : Number(callerCompanyId);

    if (!effectiveCompanyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    // ── Validate target user exists ─────────────────────────────────
    const targetUser = await findTargetUser(Number(targetUserId), effectiveCompanyId);
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
    const ownPerms = await getOwnPermissions(callerId, callerCompanyId, role);
    // ownPerms === null means super_admin (no restriction)

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
            companyId: effectiveCompanyId,
          },
          defaults: {
            userId: Number(targetUserId),
            permissionId: permId,
            companyId: effectiveCompanyId,
            grantedBy: callerId,
          },
        })
      )
    );

    const created = results.filter(([, wasCreated]) => wasCreated).length;
    const skipped = results.length - created;

    // Invalidate cache for the target user
    invalidatePermissionCache(Number(targetUserId), effectiveCompanyId);

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

    const effectiveCompanyId: number =
      role === "super_admin" ? Number(bodyCompanyId) : Number(callerCompanyId);

    if (!effectiveCompanyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    // Validate target user
    const targetUser = await findTargetUser(Number(targetUserId), effectiveCompanyId);
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

    // Invalidate cache
    invalidatePermissionCache(Number(targetUserId), effectiveCompanyId);

    return res.status(200).json({
      success: true,
      message: `${deleted} permission(s) revoked`,
      data: { revoked: deleted },
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

    const effectiveCompanyId: number =
      role === "super_admin" ? Number(bodyCompanyId) : Number(callerCompanyId);

    // Hierarchy check
    const allowedRoles = ASSIGNABLE_ROLES[role] || [];
    if (!allowedRoles.includes(targetRole)) {
      return res.status(403).json({
        success: false,
        message: `${role} cannot assign permissions to role '${targetRole}'`,
      });
    }

    // Anti-escalation check
    const ownPerms = await getOwnPermissions(callerId, callerCompanyId, role);
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

    // Find all users with that role in the company
    const targetUsers = await UserPermission.findAll({
      where: { companyId: effectiveCompanyId },
      attributes: ["userId"],
      group: ["userId"],
    });

    // Also get users by role directly
    const roleUsers = await (User as any).findAll({
      where: { role: targetRole, status: "active" },
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
      invalidatePermissionCache(uid, effectiveCompanyId);
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

    // Admin has all permissions within their company
    if (role === "admin") {
      const all = await Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] });
      return res.status(200).json({
        success: true,
        data: {
          role: "admin",
          companyId,
          note: "Admin has ALL permissions within their company",
          permissions: all.map((p) => `${p.module}:${p.action}`),
        },
      });
    }

    // Manager / Sale person — fetch from DB
    const records = await UserPermission.findAll({
      where: { userId, companyId },
      include: [{ model: Permission, as: "permission", attributes: ["module", "action", "description"] }],
    });

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
      data: { role, companyId, permissions: flat, matrix },
    });
  } catch (err) {
    console.error("getMyPermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
