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
// Excel export of the admin/manager's own team's attendance (childIds only).
// Query: startDate/endDate (default: current month), userId (optional — one
// team member instead of the whole team).
router.get(
  "/attendance-report/export",
  tokenCheck,
  checkPermission("attendance", "view"),
  AttendanceController.exportAttendanceReport
);

export default router;
