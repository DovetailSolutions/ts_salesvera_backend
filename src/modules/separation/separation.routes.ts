import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as SeparationController from "./separation.controller";

// ============================================================
// Separation Management — mounted on /admin in server.ts.
//
// No permission-matrix gate: applying for your own separation is
// self-service (like editing your own employee profile), and reviewing is
// decided by role + reporting line, which the service enforces on every
// call (company of the token only, reporting manager only, no self-review).
// authorizeRoles below is a first coarse filter only.
//
// Static paths come before "/:id" ones.
// ============================================================
const router = Router();
const applicant = [tokenCheck, authorizeRoles("employee", "manager", "admin", "user")];
const reviewer = [tokenCheck, authorizeRoles("manager", "admin", "user")];
const adminOnly = [tokenCheck, authorizeRoles("admin", "user")];

// Self-service (employee / manager)
router.get("/separation/my", ...applicant, SeparationController.getMy);
router.post("/separation/my", ...applicant, SeparationController.submit);
router.post("/separation/my/:id/withdraw", ...applicant, SeparationController.withdrawOwn);

// Notice-period policy (admin)
router.get("/separation/policy", ...adminOnly, SeparationController.getPolicy);
router.put("/separation/policy", ...adminOnly, SeparationController.updatePolicy);

// Review (manager: own team / routed to them; admin: whole company)
router.get("/separation/requests", ...reviewer, SeparationController.list);
router.get("/separation/requests/:id", ...applicant, SeparationController.getOne);
router.post("/separation/requests/:id/manager-review", ...reviewer, SeparationController.managerReview);
router.post("/separation/requests/:id/admin-review", ...adminOnly, SeparationController.adminReview);
router.patch("/separation/requests/:id/last-working-day", ...adminOnly, SeparationController.adjustLastWorkingDay);
router.post("/separation/requests/:id/withdraw", ...adminOnly, SeparationController.adminWithdraw);

// Handover / clearance / offboarding
router.get("/separation/requests/:id/handover", ...reviewer, SeparationController.getHandover);
router.post("/separation/requests/:id/handover/tasks", ...adminOnly, SeparationController.reassignTasks);
router.post("/separation/requests/:id/start-handover", ...reviewer, SeparationController.startHandover);
router.patch("/separation/requests/:id/handover", ...reviewer, SeparationController.updateHandover);
router.patch("/separation/requests/:id/clearance", ...adminOnly, SeparationController.updateClearance);
router.post("/separation/requests/:id/complete", ...adminOnly, SeparationController.complete);

export default router;
