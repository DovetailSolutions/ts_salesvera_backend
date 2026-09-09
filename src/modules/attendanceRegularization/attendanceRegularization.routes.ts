import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import { handleRegularizationAttachment } from "./attendanceRegularizationUpload";
import * as Controller from "./attendanceRegularization.controller";

// ============================================================
// Attendance Regularization routes — mounted on /admin in server.ts, next
// to attendanceSecurityRoutes. Same "/my is self-service, everything else
// needs an explicit permission" convention as attendanceSecurity.routes.ts.
// ============================================================
const router = Router();

router.get("/attendance-regularization/types", tokenCheck, Controller.getRequestTypes);

router.post(
  "/attendance-regularization",
  tokenCheck,
  checkPermission("attendance", "create"),
  handleRegularizationAttachment,
  Controller.createRequest
);

// Self-service — any authenticated staff role, scoped server-side to their
// own userId. Registered before "/:id" so Express doesn't try to parse
// "my" as a numeric id.
router.get("/attendance-regularization/my", tokenCheck, Controller.getMyRequests);
router.post("/attendance-regularization/:id/cancel", tokenCheck, Controller.cancelRequest);

router.get(
  "/attendance-regularization",
  tokenCheck,
  checkPermission("attendance-regularization", "view"),
  Controller.listRequests
);
router.get(
  "/attendance-regularization/:id",
  tokenCheck,
  Controller.getRequestDetail // self-owner check happens inside the service; reviewer authorization too
);
router.post(
  "/attendance-regularization/:id/approve",
  tokenCheck,
  checkPermission("attendance-regularization", "review"),
  Controller.approveRequest
);
router.post(
  "/attendance-regularization/:id/reject",
  tokenCheck,
  checkPermission("attendance-regularization", "review"),
  Controller.rejectRequest
);

export default router;
