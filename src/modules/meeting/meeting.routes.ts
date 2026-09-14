import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import { authorizeRoles, ADMIN_ONLY } from "../../app/middlewear/rbac";
import * as MeetingController from "./meeting.controller";

// ============================================================
// New meeting capabilities (dashboard, manager-initiated scheduling that
// supports brand-new clients, reschedule) — mounted alongside, never
// replacing, the legacy /createmeeting, /endmeeting, /getusermeeting,
// /admin/assign-meeting routes in router/admin.ts and router/user.ts.
// ============================================================
const router = Router();

router.post("/meetings/schedule", tokenCheck, checkPermission("meeting", "schedule"), MeetingController.scheduleMeeting);
router.patch("/meetings/:id/reschedule", tokenCheck, checkPermission("meeting", "update"), MeetingController.rescheduleMeeting);
router.get("/meetings/dashboard", tokenCheck, checkPermission("meeting", "view"), MeetingController.getMeetingDashboard);
router.get(
  "/meetings/dashboard/details",
  tokenCheck,
  checkPermission("meeting", "view"),
  MeetingController.getMeetingDashboardDetails
);
router.get(
  "/meetings/dashboard/new-clients",
  tokenCheck,
  checkPermission("meeting", "view"),
  MeetingController.getNewClientsDashboardDetails
);

// Admin Meeting Excel Export — new, additive, read-only. Admin-only by role
// (authorizeRoles), not just by a hidden button: a manager calling this
// directly gets a 403 even though managers otherwise hold meeting:view.
// Query: fromDate, toDate (required, YYYY-MM-DD), userIds (optional,
// comma-separated — omitted/empty means every authorized user).
router.get(
  "/meetings/export",
  tokenCheck,
  authorizeRoles(...ADMIN_ONLY),
  MeetingController.exportMeetingReport
);

export default router;
