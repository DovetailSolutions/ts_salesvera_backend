import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as ShiftController from "./shift.controller";

// ============================================================
// Shift routes — mounted on /admin in server.ts, same URL paths as before
// (addshift/getshift/getshift/:id/updateshift/:id). "assign-employee-shift"
// stays in admin.ts/router/admin.ts — it's a cross-domain employee-
// assignment concern (touches User + Department too), not pure Shift CRUD.
// ============================================================
const router = Router();

router.post("/addshift", tokenCheck, authorizeRoles(...ADMIN_ONLY), ShiftController.addShift);
router.get("/getshift", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), ShiftController.getShift);
router.get("/getshift/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), ShiftController.getShiftById);
router.patch("/updateshift/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), ShiftController.updateShift);

export default router;
