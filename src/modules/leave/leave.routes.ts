import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as LeaveController from "./leave.controller";

// ============================================================
// Leave routes — mounted directly on the /admin router in server.ts, same
// URL paths and same checkPermission gates as before. This module fully
// replaces the leave functions that used to live in admin.ts/router/admin.ts.
// ============================================================
const router = Router();

// Cancels the given leave (restores balance, flips its Attendance rows to
// leaveReject) and marks the requested day present in one call — approveLeave
// refuses to overwrite a leave/leaveApproved/leaveReject row directly.
router.post(
  "/cancel-leave-and-mark-present",
  tokenCheck,
  checkPermission("leave", "approve"),
  checkPermission("attendance", "update"),
  LeaveController.cancelLeaveAndMarkPresent
);

// Admin/manager logging a leave request on behalf of a team member (web
// counterpart to the mobile-only self-service POST /api/leave) — the
// concrete, admin-visible way to walk the full request -> approve/reject ->
// balance -> attendance flow without needing the mobile app.
router.post("/request-leave", tokenCheck, checkPermission("leave", "apply"), LeaveController.createLeaveRequest);

router.patch("/approved-leave", tokenCheck, checkPermission("leave", "approve"), LeaveController.approveLeave);
router.get("/get-leave-list", tokenCheck, checkPermission("leave", "view"), LeaveController.leaveList);
router.get("/leave-request-today", tokenCheck, checkPermission("leave", "view"), LeaveController.getTodayLeaveRequests);

// Per-employee leave balance: admin/manager assign & view balances for their sale_persons.
router.post("/assign-leave-balance", tokenCheck, checkPermission("leave", "manage"), LeaveController.assignLeaveBalance);
router.get("/leave-balance-list", tokenCheck, checkPermission("leave", "view"), LeaveController.getTeamLeaveBalances);
router.get("/leave-balance/:employeeId", tokenCheck, checkPermission("leave", "view"), LeaveController.getEmployeeLeaveBalance);

router.get("/user-leave", tokenCheck, checkPermission("leave", "view"), LeaveController.userLeave);
router.get("/getown-leave", tokenCheck, checkPermission("leave", "view"), LeaveController.ownLeave);

// Company leave-type policy (Step5.jsx of the registration wizard).
// FIX: reading the type list/detail only needs leave:view (anyone who can
// see leave requests/balances needs to know what types exist to render
// them — a manager has leave:view but not leave:manage, so the Balances
// tab's per-type columns and every leave-type dropdown silently came back
// empty for managers). Creating/editing the policy itself stays
// leave:manage-gated — that's the actual sensitive, mutating action.
router.post("/add-leave", tokenCheck, checkPermission("leave", "manage"), LeaveController.addLeave);
router.get("/get-leave", tokenCheck, checkPermission("leave", "view"), LeaveController.getLeave);
router.get("/get-leave/:id", tokenCheck, checkPermission("leave", "view"), LeaveController.getLeaveById);
router.patch("/update-leave/:id", tokenCheck, checkPermission("leave", "manage"), LeaveController.updateLeave);

export default router;
