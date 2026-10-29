import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as BirthdayController from "./birthday.controller";

// ============================================================
// Birthday Celebrations routes — mounted on /admin in server.ts. Company
// admins (and the tenant owner) only; every handler additionally verifies
// the caller's access to the target company (birthday.service.ts's
// resolveTargetCompany), so no cross-company reads or writes.
// ============================================================
const router = Router();
const companyAdmins = authorizeRoles("admin", "user");

router.get("/birthday-celebrations/settings", tokenCheck, companyAdmins, BirthdayController.getSettings);
router.put("/birthday-celebrations/settings", tokenCheck, companyAdmins, BirthdayController.updateSettings);
router.post("/birthday-celebrations/preview", tokenCheck, companyAdmins, BirthdayController.previewTemplate);
router.get("/birthday-celebrations/birthdays", tokenCheck, companyAdmins, BirthdayController.getBirthdays);
router.get("/birthday-celebrations/runs", tokenCheck, companyAdmins, BirthdayController.getRecentRuns);

export default router;
