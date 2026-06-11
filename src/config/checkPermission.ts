import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import { UserPermission } from "../app/model/userPermission";
import { Permission } from "../app/model/permission";
import { getUserPermissionsFromCache } from "./permissionCache";

// ============================================================
// checkPermission middleware factory
//
// Usage:
//   router.post('/attendance', tokenCheck, checkPermission('attendance', 'create'), controller)
//
// Behaviour by role:
//   super_admin  → always passes (global access, no DB hit)
//   admin        → checked against user_permissions cache (must have explicit permission)
//   manager      → checked against user_permissions cache
//   sale_person  → checked against user_permissions cache
//
// FIX: admin no longer bypasses permission checks — all non-super_admin roles
//      are verified against user_permissions so that an admin without leave:*
//      cannot access leave routes (and cannot cascade those rights to manager/sale_person).
// ============================================================

interface AuthenticatedRequest extends Request {
  userData?: string | JwtPayload;
}

/**
 * Loads a user's permissions from the database.
 * Returns an array of "module:action" strings.
 * Eager-loads Permission model to avoid N+1.
 */
const loadUserPermissionsFromDB = async (
  userId: number
): Promise<string[]> => {
  const userPerms = await UserPermission.findAll({
    where: { userId },
    include: [
      {
        model: Permission,
        as: "permission",
        attributes: ["module", "action"],
      },
    ],
    attributes: [],
  });

  return userPerms.map((up: any) => `${up.permission.module}:${up.permission.action}`);
};

/**
 * Middleware factory — call with module and action to protect a route.
 */
export const checkPermission = (module: string, action: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData = req.userData as JwtPayload;

      if (!userData || !userData.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized — no user data in token",
        });
      }

      console.log("checkPermission: userData from token:", userData);

      const { role, userId, companyId } = userData as any;


      console.log(`checkPermission: userId=${userId}, role=${role}, companyId=${companyId}, required=${module}:${action}`);

      // ── Super Admin: bypass all permission checks ──────────────────
      if (role === "super_admin") {
        return next();
      }

      // ── Admin / Manager / Sale Person: check permissions table via cache ────
      if (!companyId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden — no company context in token",
        });
      }

      const permissionSet = await getUserPermissionsFromCache(
        userId,
        () => loadUserPermissionsFromDB(userId)
      );

      const required = `${module}:${action}`;

      console.log(`User permissions: ${Array.from(permissionSet).join(", ")}`);
      console.log(`Required permission: ${required}`);

      if (!permissionSet.has(required)) {
        return res.status(403).json({
          success: false,
          message: `You don’t have  '${module}" "${action}'permission`,
        });
      }

      return next();
    } catch (error) {
      console.error("checkPermission error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check",
      });
    }
  };
};
