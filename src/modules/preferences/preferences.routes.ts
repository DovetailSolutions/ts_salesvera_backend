import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as PreferencesController from "./preferences.controller";

// ============================================================
// Preferences routes — the Settings module's "My Preferences" tab.
// Self-service only (no target-user param anywhere) — every role that can
// authenticate via jwtVerify (admin/manager/user/super_admin) reads/writes
// their own row only.
// ============================================================
const router = Router();

router.get("/my-preferences", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PreferencesController.getMyPreferences);
router.patch("/my-preferences", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), PreferencesController.updateMyPreferences);

export default router;
