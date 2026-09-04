import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import getUploadMiddleware from "../../config/fileUploads";
import * as AttendanceController from "./attendance.controller";

// ============================================================
// Attendance routes (admin/team-scoped side) — mounted directly on the
// /admin router in server.ts, same URL paths and same checkPermission gates
// as before. This module fully replaces the attendance functions that used
// to live in admin.ts/router/admin.ts.
// ============================================================
const router = Router();
const attendanceBulk = getUploadMiddleware("attendance-bulk");

router.get("/get-attendance", tokenCheck, checkPermission("attendance", "view"), AttendanceController.getAttendance);
router.post("/mark-attendance-present", tokenCheck, checkPermission("attendance", "update"), AttendanceController.markAttendancePresent);
// Bulk attendance upload (xlsx: one row per employee, one column per date).
// Matches rows by numeric Employee ID against the admin/manager's own team,
// and stamps Attendance.status directly per the mapping in bulkMarkAttendance.
router.post(
  "/bulk-mark-attendance",
  tokenCheck,
  checkPermission("attendance", "update"),
  attendanceBulk.single("file"),
  AttendanceController.bulkMarkAttendance
);
router.get("/user-attendance", tokenCheck, checkPermission("attendance", "view"), AttendanceController.userAttendance);
router.get("/attendance-book", tokenCheck, checkPermission("attendance", "view"), AttendanceController.AttendanceBook);
// Admin/manager team attendance summary: total child count, present today,
// absent today, on leave today — all derived from batched COUNT queries
// (no row fetching) so it responds fast regardless of team size.
router.get("/attendance-summary", tokenCheck, checkPermission("attendance", "view"), AttendanceController.attendanceSummary);
// Excel export of the admin/manager's own team's attendance (childIds only).
// Query: startDate/endDate (default: current month), userId (optional — one
// team member instead of the whole team).
router.get(
  "/attendance-report/export",
  tokenCheck,
  checkPermission("attendance", "view"),
  AttendanceController.exportAttendanceReport
);

// Admin/manager view of one Sale Person's daily travel (their own
// company-scoped team only — see getSalesPersonTravelForAdmin).
router.get(
  "/sales-person/:userId/travel/:date",
  tokenCheck,
  checkPermission("attendance", "view"),
  AttendanceController.getSalesPersonTravel
);

// "My Team" travel overview — one row per direct-report sale_person for the
// date, so a manager/admin can scan everyone before drilling into one.
router.get(
  "/sales-team/travel-summary/:date",
  tokenCheck,
  checkPermission("attendance", "view"),
  AttendanceController.getTeamTravelSummary
);


// Self-service punch in/out and travel summary for web admin / portal users
router.post("/attendance/punch-in", tokenCheck, checkPermission("attendance", "create"), AttendanceController.AttendancePunchIn);
router.post("/attendance/punch-out", tokenCheck, checkPermission("attendance", "update"), AttendanceController.AttendancePunchOut);
router.get("/attendance/today", tokenCheck, checkPermission("attendance", "view"), AttendanceController.getTodayAttendance);
router.get("/travel/today", tokenCheck, checkPermission("attendance", "view"), AttendanceController.getMyTravelSummary);
router.get("/travel/:date", tokenCheck, checkPermission("attendance", "view"), AttendanceController.getMyTravelSummary);

export default router;

