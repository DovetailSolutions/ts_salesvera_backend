import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import * as TaskController from "../controller/task";

const router = Router();

// All task routes require a valid JWT and admin/manager role
router.post(  "/create",      tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), TaskController.createTask);
router.get(   "/list",        tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), TaskController.getAllTasks);
router.get(   "/:id",         tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), TaskController.getTaskById);
router.patch( "/update/:id",  tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), TaskController.updateTask);
router.delete("/delete/:id",  tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), TaskController.deleteTask);

export default router;
