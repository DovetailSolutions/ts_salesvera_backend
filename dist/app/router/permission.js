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
const rbac_1 = require("../middlewear/rbac");
const PermissionController = __importStar(require("../controller/permission"));
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
// ── Fetch users in this company filtered by role (preview before bulk assign) ─
router.get("/users-by-role", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.getUsersByRole);
// ── View calling user's own permissions ──────────────────────────────────
router.get("/my", jwtVerify_1.tokenCheck, PermissionController.getMyPermissions);
// ── View a specific user's permissions ───────────────────────────────────
router.get("/user/:userId", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.getUserPermissions);
// ── Assign / revoke permissions — admin, manager, and super_admin ─────────
// Manager can assign/revoke for sale_person (enforced in controller via ASSIGNABLE_ROLES)
router.post("/assign", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.assignPermissions);
router.delete("/revoke", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.revokePermissions);
router.post("/assign-role", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.assignPermissionsToRole);
router.delete("/revoke-role", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), PermissionController.revokePermissionsFromRole);
exports.default = router;
