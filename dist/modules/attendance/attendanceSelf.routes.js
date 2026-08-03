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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tokenCheck_1 = require("../../config/tokenCheck");
const checkPermission_1 = require("../../config/checkPermission");
const AttendanceController = __importStar(require("./attendance.controller"));
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
const tokenCheck = (0, tokenCheck_1.createTokenCheck)(["user", "admin", "manager", "sale_person"]);
const router = (0, express_1.Router)();
router.post("/attendance/punch-in", tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "create"), AttendanceController.AttendancePunchIn);
router.post("/attendance/punch-out", tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "update"), AttendanceController.AttendancePunchOut);
router.get("/attendance/today", tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AttendanceController.getTodayAttendance);
router.get("/attendancelist", tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AttendanceController.AttendanceList);
exports.default = router;
