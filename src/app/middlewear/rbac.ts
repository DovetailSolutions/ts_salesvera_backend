import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";

interface AuthenticatedRequest extends Request {
  userData?: string | JwtPayload;
}

export const ADMIN_ONLY = ["admin", "super_admin", "user"] as const;
export const ADMIN_AND_MANAGER = ["admin", "super_admin", "manager", "user"] as const;
export const ALL_STAFF = ["admin", "super_admin", "manager", "sale_person", "user"] as const;

/**
 * Middleware factory that restricts a route to users whose role is in allowedRoles.
 * Must be used AFTER tokenCheck so req.userData is already set.
 *
 * Returns:
 *   401 — if userData/role is missing (tokenCheck didn't run or failed)
 *   403 — if the user's role is not in the allowed list
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized — authentication required",
      });
    }

    if (!allowedRoles.includes(userData.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden — requires one of: ${allowedRoles.join(", ")}`,
      });
    }

    return next();
  };
};
