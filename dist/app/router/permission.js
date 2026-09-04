"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jwtVerify_1 = require("../../config/jwtVerify");
const tokenCheck_1 = require("../../config/tokenCheck");
const rbac_1 = require("../middlewear/rbac");
const PermissionController = __importStar(require("../controller/permission"));
// FIX: "/my" (view my own permissions) is called on every login by
// AuthProvider.jsx (fetchAndSyncProfile) for every role, including
// sale_person — but this router's `tokenCheck` (jwtVerify.ts) structurally
// excludes sale_person, the same bug as auth.routes.ts's getProfile. It's
// non-blocking there (`.catch(() => null)`) so it didn't stop login itself,
// but it silently left a permanently empty permissions matrix for every
// sale_person session, which any permission-gated UI reads from.
const selfServiceTokenCheck = (0, tokenCheck_1.createTokenCheck)(["user", "admin", "super_admin", "manager", "sale_person"]);
// ============================================================
// Permission Router
// Base path: /admin/permissions  (mounted in server.ts under /admin)
//
// All routes require a valid JWT (tokenCheck).
// Role-level enforcement is handled inside the controller.
// ============================================================
const router = (0, express_1.Router)();
// ── View all available permissions (permission matrix reference) ──────────
router.get("/all", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.getAllPermissions);
// ── Default permission template for a role (registration wizard pre-fill) ──
// Open to any authenticated role — result is intersected with the caller's
// own permissions, so it never leaks more than they could already grant.
router.get("/template/:role", jwtVerify_1.tokenCheck, PermissionController.getPermissionTemplate);
// ── Fetch users in this company filtered by role (preview before bulk assign) ─
router.get("/users-by-role", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.getUsersByRole);
// ── View calling user's own permissions ──────────────────────────────────
router.get("/my", selfServiceTokenCheck, PermissionController.getMyPermissions);
// ── View a specific user's permissions ───────────────────────────────────
router.get("/user/:userId", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.getUserPermissions);
// ── Assign / revoke permissions — admin, manager, and super_admin ─────────
// Manager can assign/revoke for sale_person (enforced in controller via ASSIGNABLE_ROLES)
router.post("/assign", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.assignPermissions);
router.delete("/revoke", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.revokePermissions);
router.post("/assign-role", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.assignPermissionsToRole);
router.delete("/revoke-role", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.revokePermissionsFromRole);
exports.default = router;
