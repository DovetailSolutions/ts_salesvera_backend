import { Router } from "express";
import { createTokenCheck } from "../../config/tokenCheck";
import { checkPermission } from "../../config/checkPermission";
import { handleRegularizationAttachment } from "./attendanceRegularizationUpload";
import * as Controller from "./attendanceRegularization.controller";

// ============================================================
// Self-service surface for Attendance Regularization — mounted on /api in
// server.ts, same URL-prefix split as attendance/attendanceSelf.routes.ts
// (self-service /api/*) vs attendance/attendance.routes.ts (admin-facing
// /admin/*). Same controller/service functions as
// attendanceRegularization.routes.ts (/admin/*) — this file only adds a
// second set of routes at the prefix the mobile app's own networking layer
// actually calls (per docs/manager-mobile-api.md: "Build the manager
// mobile app against this [/api] surface... does NOT need to call
// [/admin]"). No new business logic here.
//
// Uses the same self-service role set as attendanceSelf.routes.ts's own
// tokenCheck (user/admin/manager/sale_person) rather than jwtVerify.ts's
// /admin-side tokenCheck.
// ============================================================
const tokenCheck = createTokenCheck(["user", "admin", "manager", "sale_person"]);

const router = Router();

router.get("/attendance-regularization/types", tokenCheck, Controller.getRequestTypes);

router.post(
  "/attendance-regularization",
  tokenCheck,
  checkPermission("attendance", "create"),
  handleRegularizationAttachment,
  Controller.createRequest
);

router.get("/attendance-regularization/my", tokenCheck, Controller.getMyRequests);
router.post("/attendance-regularization/:id/cancel", tokenCheck, Controller.cancelRequest);
router.get("/attendance-regularization/:id", tokenCheck, Controller.getRequestDetail);

export default router;
