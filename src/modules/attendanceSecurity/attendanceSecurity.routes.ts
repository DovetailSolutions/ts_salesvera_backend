import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as Controller from "./attendanceSecurity.controller";

// ============================================================
// Attendance Security routes — mounted on /admin in server.ts, next to
// geoFencingRoutes. Uses checkPermission("attendance-security", action)
// (the newer RBAC convention attendance.routes.ts/leave.routes.ts already
// use), not geoFencing's older authorizeRoles(...).
//
// /my is open to any authenticated staff role (a user needs to know their
// own settings before punching in); everything else requires an explicit
// attendance-security permission grant.
// ============================================================
const router = Router();

router.get("/attendance-security/my", tokenCheck, Controller.getMy);

router.get(
  "/attendance-security/settings/:userId",
  tokenCheck,
  checkPermission("attendance-security", "view"),
  Controller.getForUser
);
router.put(
  "/attendance-security/settings/:userId",
  tokenCheck,
  checkPermission("attendance-security", "update"),
  Controller.updateForUser
);
router.post(
  "/attendance-security/bulk-settings",
  tokenCheck,
  checkPermission("attendance-security", "update"),
  Controller.bulkUpdate
);

router.get(
  "/attendance-security/device-requests",
  tokenCheck,
  checkPermission("attendance-security", "view"),
  Controller.listDeviceRequests
);
// Self-service status view (any authenticated role, scoped to the caller's
// own userId) — must be registered before the "/:id" route below, or Express
// would match "my" as an :id and hit getDeviceRequest with NaN instead.
router.get("/attendance-security/device-requests/my", tokenCheck, Controller.listMyDeviceRequests);
router.get(
  "/attendance-security/device-requests/:id",
  tokenCheck,
  checkPermission("attendance-security", "view"),
  Controller.getDeviceRequest
);
router.post(
  "/attendance-security/device-requests/:id/approve",
  tokenCheck,
  checkPermission("attendance-security", "device-review"),
  Controller.approveDeviceRequest
);
router.post(
  "/attendance-security/device-requests/:id/reject",
  tokenCheck,
  checkPermission("attendance-security", "device-review"),
  Controller.rejectDeviceRequest
);
router.post(
  "/attendance-security/devices/:userId/revoke",
  tokenCheck,
  checkPermission("attendance-security", "device-review"),
  Controller.revokeDevice
);

router.get(
  "/attendance-security/audit-log",
  tokenCheck,
  checkPermission("attendance-security", "view"),
  Controller.getAuditLog
);

export default router;
