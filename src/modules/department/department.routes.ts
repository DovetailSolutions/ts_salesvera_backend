import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as DepartmentController from "./department.controller";

// ============================================================
// Department routes — mounted on /admin in server.ts, same URL paths as
// before (adddepartment/getdepartment/getdepartment/:id/updatedepartment/:id).
// ============================================================
const router = Router();

router.post("/adddepartment", tokenCheck, authorizeRoles(...ADMIN_ONLY), DepartmentController.addDepartment);
router.get("/getdepartment", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), DepartmentController.getDepartment);
router.get("/getdepartment/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), DepartmentController.getDepartmentById);
router.patch("/updatedepartment/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), DepartmentController.updateDepartment);

export default router;
