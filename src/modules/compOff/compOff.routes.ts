import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as CompOffController from "./compOff.controller";

// ============================================================
// Comp-off routes — mounted on /admin in server.ts, behind the same leave
// permissions as leave requests. The service limits every read and review
// to the caller's active company and their own team.
// ============================================================
const router = Router();

router.get("/comp-off", tokenCheck, checkPermission("leave", "view"), CompOffController.listCompOff);
router.patch("/comp-off/:id/review", tokenCheck, checkPermission("leave", "approve"), CompOffController.reviewCompOff);

export default router;
