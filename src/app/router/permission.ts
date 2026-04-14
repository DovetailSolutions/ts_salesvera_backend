import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
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
// GET /admin/permissions/all
router.get("/all", tokenCheck, PermissionController.getAllPermissions);

// ── View calling user's own permissions ──────────────────────────────────
// GET /admin/permissions/my
router.get("/my", tokenCheck, PermissionController.getMyPermissions);

// ── View a specific user's permissions ───────────────────────────────────
// GET /admin/permissions/user/:userId
router.get("/user/:userId", tokenCheck, PermissionController.getUserPermissions);

// ── Assign permissions to a specific user ────────────────────────────────
// POST /admin/permissions/assign
// Body: { targetUserId, permissionIds: number[], companyId? (super_admin only) }
router.post("/assign", tokenCheck, PermissionController.assignPermissions);

// ── Revoke permissions from a specific user ───────────────────────────────
// DELETE /admin/permissions/revoke
// Body: { targetUserId, permissionIds: number[], companyId? (super_admin only) }
router.delete("/revoke", tokenCheck, PermissionController.revokePermissions);

// ── Bulk: assign permissions to all users of a given role in a company ────
// POST /admin/permissions/assign-role
// Body: { targetRole, permissionIds: number[], companyId? (super_admin only) }
router.post("/assign-role", tokenCheck, PermissionController.assignPermissionsToRole);

export default router;
