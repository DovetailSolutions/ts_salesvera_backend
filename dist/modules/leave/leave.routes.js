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
const jwtVerify_1 = require("../../config/jwtVerify");
const checkPermission_1 = require("../../config/checkPermission");
const LeaveController = __importStar(require("./leave.controller"));
// ============================================================
// Leave routes — mounted directly on the /admin router in server.ts, same
// URL paths and same checkPermission gates as before. This module fully
// replaces the leave functions that used to live in admin.ts/router/admin.ts.
// ============================================================
const router = (0, express_1.Router)();
// Cancels the given leave (restores balance, flips its Attendance rows to
// leaveReject) and marks the requested day present in one call — approveLeave
// refuses to overwrite a leave/leaveApproved/leaveReject row directly.
router.post("/cancel-leave-and-mark-present", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "approve"), (0, checkPermission_1.checkPermission)("attendance", "update"), LeaveController.cancelLeaveAndMarkPresent);
// Admin/manager logging a leave request on behalf of a team member (web
// counterpart to the mobile-only self-service POST /api/leave) — the
// concrete, admin-visible way to walk the full request -> approve/reject ->
// balance -> attendance flow without needing the mobile app.
router.post("/request-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "apply"), LeaveController.createLeaveRequest);
router.patch("/approved-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "approve"), LeaveController.approveLeave);
router.get("/get-leave-list", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.leaveList);
router.get("/leave-request-today", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.getTodayLeaveRequests);
// Per-employee leave balance: admin/manager assign & view balances for their sale_persons.
router.post("/assign-leave-balance", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "manage"), LeaveController.assignLeaveBalance);
router.get("/leave-balance-list", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.getTeamLeaveBalances);
router.get("/leave-balance/:employeeId", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.getEmployeeLeaveBalance);
router.get("/user-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.userLeave);
router.get("/getown-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.ownLeave);
// Company leave-type policy (Step5.jsx of the registration wizard).
// FIX: reading the type list/detail only needs leave:view (anyone who can
// see leave requests/balances needs to know what types exist to render
// them — a manager has leave:view but not leave:manage, so the Balances
// tab's per-type columns and every leave-type dropdown silently came back
// empty for managers). Creating/editing the policy itself stays
// leave:manage-gated — that's the actual sensitive, mutating action.
router.post("/add-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "manage"), LeaveController.addLeave);
router.get("/get-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.getLeave);
router.get("/get-leave/:id", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), LeaveController.getLeaveById);
router.patch("/update-leave/:id", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "manage"), LeaveController.updateLeave);
exports.default = router;
