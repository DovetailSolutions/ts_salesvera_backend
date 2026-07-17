import { Router } from "express";
import { createTokenCheck } from "../../config/tokenCheck";
import { checkPermission } from "../../config/checkPermission";
import * as AttendanceController from "./attendance.controller";

// ============================================================
// Attendance routes (employee self-service side) — mounted directly on the
// /api router in server.ts, same URL paths and same checkPermission gates
// as before. This module fully replaces the attendance functions that used
// to live in user.ts/router/user.ts.
//
// Uses its own tokenCheck (not the shared jwtVerify2, which deliberately
// excludes "admin" for the rest of the /api/* self-service surface) —
// admin punching their own attendance is a real, requested case, and
// scoping the wider role just to this router keeps every other /api/*
// route's original user/manager/sale_person-only boundary unchanged.
// ============================================================
const tokenCheck = createTokenCheck(["user", "admin", "manager", "sale_person"]);

const router = Router();

router.post("/attendance/punch-in", tokenCheck, checkPermission("attendance", "create"), AttendanceController.AttendancePunchIn);
router.post("/attendance/punch-out", tokenCheck, checkPermission("attendance", "update"), AttendanceController.AttendancePunchOut);
router.get("/attendance/today", tokenCheck, checkPermission("attendance", "view"), AttendanceController.getTodayAttendance);
router.get("/attendancelist", tokenCheck, checkPermission("attendance", "view"), AttendanceController.AttendanceList);

export default router;
