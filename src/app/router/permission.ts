import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import * as PermissionController from "../controller/permission";
// ============================================================
// Permission Router
// Base path: /admin/permissions  (mounted in server.ts under /admin)
//
// All routes require a valid JWT (tokenCheck).
// Role-level enforcement is handled inside the controller.
// ============================================================
const router = Router();
// ── View all available permissions (permission matrix reference) ──────────
router.get("/all",tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.getAllPermissions);

// ── Default permission template for a role (registration wizard pre-fill) ──
// Open to any authenticated role — result is intersected with the caller's
// own permissions, so it never leaks more than they could already grant.
router.get("/template/:role", tokenCheck, PermissionController.getPermissionTemplate);
// ── Fetch users in this company filtered by role (preview before bulk assign) ─
router.get("/users-by-role", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.getUsersByRole);

// ── View calling user's own permissions ──────────────────────────────────
router.get("/my",tokenCheck, PermissionController.getMyPermissions);

// ── View a specific user's permissions ───────────────────────────────────
router.get("/user/:userId", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.getUserPermissions);

// ── Assign / revoke permissions — admin, manager, and super_admin ─────────
// Manager can assign/revoke for sale_person (enforced in controller via ASSIGNABLE_ROLES)
router.post("/assign",       tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.assignPermissions);
router.delete("/revoke",     tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.revokePermissions);
router.post("/assign-role",  tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.assignPermissionsToRole);
router.delete("/revoke-role",tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PermissionController.revokePermissionsFromRole);

export default router;
