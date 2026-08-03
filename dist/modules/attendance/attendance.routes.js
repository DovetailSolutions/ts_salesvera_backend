"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jwtVerify_1 = require("../../config/jwtVerify");
const checkPermission_1 = require("../../config/checkPermission");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const AttendanceController = __importStar(require("./attendance.controller"));
// ============================================================
// Attendance routes (admin/team-scoped side) — mounted directly on the
// /admin router in server.ts, same URL paths and same checkPermission gates
// as before. This module fully replaces the attendance functions that used
// to live in admin.ts/router/admin.ts.
// ============================================================
const router = (0, express_1.Router)();
const attendanceBulk = (0, fileUploads_1.default)("attendance-bulk");
router.get("/get-attendance", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AttendanceController.getAttendance);
router.post("/mark-attendance-present", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "update"), AttendanceController.markAttendancePresent);
// Bulk attendance upload (xlsx: one row per employee, one column per date).
// Matches rows by numeric Employee ID against the admin/manager's own team,
// and stamps Attendance.status directly per the mapping in bulkMarkAttendance.
router.post("/bulk-mark-attendance", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "update"), attendanceBulk.single("file"), AttendanceController.bulkMarkAttendance);
router.get("/user-attendance", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AttendanceController.userAttendance);
router.get("/attendance-book", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AttendanceController.AttendanceBook);
// Excel export of the admin/manager's own team's attendance (childIds only).
// Query: startDate/endDate (default: current month), userId (optional — one
// team member instead of the whole team).
router.get("/attendance-report/export", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AttendanceController.exportAttendanceReport);
exports.default = router;
