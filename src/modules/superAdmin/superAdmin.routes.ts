import { Router } from "express";
import { createTokenCheck } from "../../config/tokenCheck";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as SuperAdminController from "./superAdmin.controller";

const tokenCheck = createTokenCheck(["super_admin"]);

const router = Router();

router.use(tokenCheck);
router.use(authorizeRoles("super_admin"));

router.get("/super-admin/dashboard", SuperAdminController.getDashboard);
router.get("/super-admin/users", SuperAdminController.getUsers);
router.get("/super-admin/users/:id/tree", SuperAdminController.getUserTree);
router.post("/super-admin/users", SuperAdminController.createUser);
router.put("/super-admin/users/:id", SuperAdminController.updateUser);

export default router;
