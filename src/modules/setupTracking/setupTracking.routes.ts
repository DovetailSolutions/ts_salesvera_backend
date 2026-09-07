import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { createTokenCheck } from "../../config/tokenCheck";
import * as Controller from "./setupTracking.controller";

// ============================================================
// Setup Tracking routes — mounted on /admin in server.ts.
//
// Tenant-level setup (a User's own admin/company checklist) is a
// super_admin-only view/action surface — mirrors superAdmin.routes.ts.
// Company-level setup is readable/actionable by whoever already has a
// legitimate relationship to that company (super_admin, owner/admin via
// hasCompanyAccess) — the service layer enforces the fine-grained check,
// same pattern as company.routes.ts's /getcompany/:id.
// ============================================================
const superAdminOnly = createTokenCheck(["super_admin"]);

const router = Router();

router.get("/super-admin/users/:id/setup", superAdminOnly, Controller.getTenantSetup);
router.patch("/super-admin/users/:id/setup/complete", superAdminOnly, Controller.setTenantSetup("complete"));
router.patch("/super-admin/users/:id/setup/skip", superAdminOnly, Controller.setTenantSetup("skip"));
router.patch("/super-admin/users/:id/setup/reopen", superAdminOnly, Controller.setTenantSetup("reopen"));

router.get("/company/:id/setup", tokenCheck, Controller.getCompanySetup);
router.patch("/company/:id/setup/complete", tokenCheck, Controller.setCompanySetup("complete"));
router.patch("/company/:id/setup/skip", tokenCheck, Controller.setCompanySetup("skip"));
router.patch("/company/:id/setup/reopen", tokenCheck, Controller.setCompanySetup("reopen"));

export default router;
