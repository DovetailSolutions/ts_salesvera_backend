import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
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

export default router;
