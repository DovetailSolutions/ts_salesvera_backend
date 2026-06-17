"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.ALL_STAFF = exports.ADMIN_AND_MANAGER = exports.ADMIN_ONLY = void 0;
exports.ADMIN_ONLY = ["admin", "super_admin", "user"];
exports.ADMIN_AND_MANAGER = ["admin", "super_admin", "manager", "user"];
exports.ALL_STAFF = ["admin", "super_admin", "manager", "sale_person", "user"];
/**
 * Middleware factory that restricts a route to users whose role is in allowedRoles.
 * Must be used AFTER tokenCheck so req.userData is already set.
 *
 * Returns:
 *   401 — if userData/role is missing (tokenCheck didn't run or failed)
 *   403 — if the user's role is not in the allowed list
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        const userData = req.userData;
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
exports.authorizeRoles = authorizeRoles;
