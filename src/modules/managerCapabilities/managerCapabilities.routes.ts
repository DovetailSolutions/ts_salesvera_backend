import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as ManagerCapabilitiesController from "./managerCapabilities.controller";

// ============================================================
// Manager Capabilities — Admin-only audit/visibility page. Read-only: never
// creates, updates, or deletes a permission/user record.
//
// Admin-only per the task spec (Manager/Sale Person/"user" all rejected) —
// deliberately NOT the shared ADMIN_ONLY tuple from rbac.ts (which includes
// "user"), since this feature's own spec calls for admin/super_admin only.
// ============================================================
const router = Router();

router.get(
  "/manager-capabilities",
  tokenCheck,
  authorizeRoles("admin", "super_admin"),
  ManagerCapabilitiesController.getManagerCapabilitiesOverview
);

router.get(
  "/manager-capabilities/managers",
  tokenCheck,
  authorizeRoles("admin", "super_admin"),
  ManagerCapabilitiesController.getCompanyManagersList
);

router.get(
  "/manager-capabilities/:managerId",
  tokenCheck,
  authorizeRoles("admin", "super_admin"),
  ManagerCapabilitiesController.getManagerCapabilities
);

export default router;

