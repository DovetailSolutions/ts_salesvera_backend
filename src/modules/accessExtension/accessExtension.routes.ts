import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as AccessExtensionController from "./accessExtension.controller";

// ============================================================
// Access-extension routes. This whole router is mounted at "/admin"
// (server.ts), same as leave.routes.ts/company.routes.ts/etc. — so a
// relative path here becomes "/admin/<path>". The two Super-Admin-facing
// routes deliberately include the "/super-admin" segment THEMSELVES
// (giving "/admin/super-admin/..."), matching superAdmin.routes.ts's own
// existing convention (see its FIX comment on why "/super-admin" is
// pinned to the specific routes rather than router.use()'d path-lessly).
// ============================================================
const router = Router();

router.get(
  "/access-status",
  tokenCheck,
  authorizeRoles("user"),
  AccessExtensionController.getMyAccessStatus
);
router.post(
  "/access-extension-requests",
  tokenCheck,
  authorizeRoles("user"),
  AccessExtensionController.submitExtensionRequest
);
router.get(
  "/access-extension-requests",
  tokenCheck,
  authorizeRoles("user"),
  AccessExtensionController.listMyExtensionRequests
);

router.get(
  "/super-admin/access-extension-requests",
  tokenCheck,
  authorizeRoles("super_admin"),
  AccessExtensionController.listAllExtensionRequests
);
router.post(
  "/super-admin/access-extension-requests/:id/approve",
  tokenCheck,
  authorizeRoles("super_admin"),
  AccessExtensionController.approveExtensionRequest
);
router.post(
  "/super-admin/access-extension-requests/:id/reject",
  tokenCheck,
  authorizeRoles("super_admin"),
  AccessExtensionController.rejectExtensionRequest
);

export default router;
