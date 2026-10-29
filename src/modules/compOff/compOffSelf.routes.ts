import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as CompOffController from "./compOff.controller";

// ============================================================
// Employee self-service comp-off — mounted on /api in server.ts (mobile app
// and the web "My Leave" page). Behind the same leave permissions as
// applying for / viewing one's own leave; every call acts on the caller's
// own records in their active company only.
// ============================================================
const router = Router();

router.get("/comp-off/my", tokenCheck, checkPermission("leave", "view"), CompOffController.getMyCompOff);
router.post("/comp-off/request", tokenCheck, checkPermission("leave", "apply"), CompOffController.requestCompOff);

export default router;
