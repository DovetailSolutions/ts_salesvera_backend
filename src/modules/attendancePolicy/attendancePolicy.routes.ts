import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as PolicyController from "./attendancePolicy.controller";

// ============================================================
// Attendance policy routes — mounted at "/admin" in server.ts.
// Reading needs attendance:view, saving attendance:update — and the service
// restricts both to admin / owner (managers get 403). Preview only
// classifies sample data and saves nothing.
// ============================================================
const router = Router();

router.get("/attendance-policies", tokenCheck, checkPermission("attendance", "view"), PolicyController.getPolicies);
router.post("/attendance-policies/preview", tokenCheck, checkPermission("attendance", "view"), PolicyController.previewPolicy);
router.post("/attendance-policies", tokenCheck, checkPermission("attendance", "update"), PolicyController.savePolicy);

export default router;
