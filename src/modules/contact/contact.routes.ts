import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as ContactController from "./contact.controller";

// ============================================================
// POST /api/contact-query — mounted on /api in server.ts, public, no
// tokenCheck: this is the landing page's "Contact Us" form, reachable by
// anyone (logged out visitors included).
// ============================================================
export const contactPublicRoutes = Router();
contactPublicRoutes.post("/contact-query", ContactController.submitQuery);

// ============================================================
// GET/PATCH /admin/contact-queries — mounted on /admin, super_admin only:
// this is the platform's own marketing-lead inbox, not a per-tenant
// feature — admin/manager/user (tenant accounts) never see it.
// ============================================================
export const contactAdminRoutes = Router();
contactAdminRoutes.get("/contact-queries", tokenCheck, authorizeRoles("super_admin"), ContactController.listQueries);
contactAdminRoutes.patch("/contact-queries/:id", tokenCheck, authorizeRoles("super_admin"), ContactController.updateQueryStatus);
