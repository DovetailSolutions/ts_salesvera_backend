import { Router } from "express";
import { createTokenCheck } from "../../config/tokenCheck";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as SuperAdminController from "./superAdmin.controller";

const tokenCheck = createTokenCheck(["super_admin"]);

const router = Router();

// FIX: these were registered path-less (router.use(tokenCheck) with no
// path), which — because this router is mounted at app.use("/admin", ...)
// — intercepted EVERY "/admin/*" request that no earlier-mounted router
// already matched, before Express ever tried this router's own specific
// routes. Any route module mounted AFTER this one in server.ts (e.g.
// setupTracking.routes.ts's /admin/company/:id/setup) was silently
// shadowed: a non-super_admin caller got this router's 403 "Forbidden"
// instead of ever reaching their intended route. Scoping to "/super-admin"
// — this router's own routes are already all prefixed that way — fixes the
// hijack without changing behavior for any of this router's own endpoints.
router.use("/super-admin", tokenCheck);
router.use("/super-admin", authorizeRoles("super_admin"));

router.get("/super-admin/dashboard", SuperAdminController.getDashboard);
router.get("/super-admin/users", SuperAdminController.getUsers);
router.get("/super-admin/users/:id/tree", SuperAdminController.getUserTree);
router.post("/super-admin/users", SuperAdminController.createUser);
router.put("/super-admin/users/:id", SuperAdminController.updateUser);

export default router;
