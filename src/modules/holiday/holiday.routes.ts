import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as HolidayController from "./holiday.controller";

// ============================================================
// Holiday routes — mounted directly on the /admin router in server.ts,
// same URL paths as before (addholiday/getholiday/getholiday/:id/
// updateholiday/:id) so the frontend needs zero changes. This module fully
// replaces the holiday functions that used to live in admin.ts/router/admin.ts.
// ============================================================
const router = Router();

router.post("/addholiday", tokenCheck, authorizeRoles(...ADMIN_ONLY), HolidayController.addHoliday);
router.get("/getholiday", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), HolidayController.getHoliday);
router.get("/getholiday/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), HolidayController.getHolidayById);
router.patch("/updateholiday/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), HolidayController.updateHoliday);

export default router;
