import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as Controller from "./taskDashboard.controller";

// ============================================================
// Task dashboard (read-only) — mounted at BOTH "/admin" (web) and "/api"
// (mobile) in server.ts:
//
//   GET /admin|/api/task-dashboard/my               my tasks (any role)
//   GET /admin|/api/task-dashboard/team             manager: team · admin/owner: company
//   GET /admin|/api/task-dashboard/member/:userId   one team member's tasks
//
// Query (optional): days=30 (default) | from=YYYY-MM-DD&to=YYYY-MM-DD (max 366 days)
// Access: logged in + task:view. Scope rules live in taskDashboard.service.ts.
// ============================================================
const router = Router();
const canView = [tokenCheck, checkPermission("task", "view")];

router.get("/task-dashboard/my", ...canView, Controller.getMy);
router.get("/task-dashboard/team", ...canView, Controller.getTeam);
router.get("/task-dashboard/member/:userId", ...canView, Controller.getMember);

export default router;
