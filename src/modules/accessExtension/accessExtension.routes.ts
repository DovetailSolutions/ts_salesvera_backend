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

// "user" (the tenant owner) and "admin" both reach these three: an admin is
// the one who actually hits the employee cap while hiring, so locking them
// out of even SEEING the number left them guessing at why a creation failed.
// Both are read/ask only — every mutation of a limit, expiry or status is
// super_admin-gated below. Manager/employee are deliberately not included.
// Which tenant's data a caller gets is resolved server-side from their own
// record (accessExtension.service.ts), never from the request.
const OWNER_AND_ADMIN = ["user", "admin"] as const;

router.get(
  "/access-status",
  tokenCheck,
  authorizeRoles(...OWNER_AND_ADMIN),
  AccessExtensionController.getMyAccessStatus
);
router.post(
  "/access-extension-requests",
  tokenCheck,
  authorizeRoles(...OWNER_AND_ADMIN),
  AccessExtensionController.submitExtensionRequest
);
router.get(
  "/access-extension-requests",
  tokenCheck,
  authorizeRoles(...OWNER_AND_ADMIN),
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
