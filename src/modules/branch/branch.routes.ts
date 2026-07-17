import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as BranchController from "./branch.controller";

// ============================================================
// Branch routes — mounted on /admin in server.ts, same URL paths as before
// (addbranch/getbranch/getbranch/:id/updatebranch/:id).
// ============================================================
const router = Router();

router.post("/addbranch", tokenCheck, authorizeRoles(...ADMIN_ONLY), BranchController.addBranch);
router.get("/getbranch", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), BranchController.getBranch);
router.get("/getbranch/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), BranchController.getBranchById);
router.patch("/updatebranch/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), BranchController.updateBranch);

export default router;
