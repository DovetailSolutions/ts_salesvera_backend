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
//   admin        → always passes (company-level gatekeeper; controller enforces companyId)
//   manager      → checked against user_permissions cache
//   sale_person  → checked against user_permissions cache
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
  userId: number,
  companyId: number
): Promise<string[]> => {
  const userPerms = await UserPermission.findAll({
    where: { userId, companyId },
    include: [
      {
        model: Permission,
        as: "permission",
        attributes: ["module", "action"],
      },
    ],
    attributes: [], // Only need the joined permission columns
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

      const { role, userId, companyId } = userData as any;

      // ── Super Admin: bypass all permission checks ──────────────────
      if (role === "super_admin") {
        return next();
      }

      // ── Admin: bypass permission check; company enforced in controller ──
      if (role === "admin") {
        return next();
      }

      // ── Manager / Sale Person: check permissions table via cache ────
      if (!companyId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden — no company context in token",
        });
      }

      const permissionSet = await getUserPermissionsFromCache(
        userId,
        companyId,
        () => loadUserPermissionsFromDB(userId, companyId)
      );

      const required = `${module}:${action}`;

      if (!permissionSet.has(required)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden — you do not have '${module}:${action}' permission`,
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
