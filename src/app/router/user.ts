import { Router } from "express";
const router = Router();
import * as Controller from "../controller/user";
import * as NotificationController from "../controller/notification";
import * as PermissionController from "../controller/permission";
import * as AdminController from "../controller/admin";
import * as LeaveController from "../../modules/leave/leave.controller";
import * as AttendanceController from "../../modules/attendance/attendance.controller";
import * as MeetingController from "../../modules/meeting/meeting.controller";
import { tokenCheck } from "../../config/jwtVerify2";
import { checkPermission, checkInvoiceCreatePermission, checkInvoiceViewPermission } from "../../config/checkPermission";
import { authorizeRoles } from "../middlewear/rbac";
import getUploadMiddleware from "../../config/fileUploads";
const profile = getUploadMiddleware("image");
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
const attendanceBulk = getUploadMiddleware("attendance-bulk");
router.post("/register", Controller.Register);
router.post("/login", Controller.Login);
router.get("/getprofile", tokenCheck, Controller.GetProfile);
router.patch(
  "/updateprofile",
  tokenCheck,
  profile.single("profile"),
  Controller.UpdateProfile
);
router.get("/mysaleperson", tokenCheck, Controller.MySalePerson);
router.post(
  "/createmeeting",
  tokenCheck,
  meeting.array("image"),
  Controller.CreateMeeting
); 
router.get("/clientmeeting",tokenCheck,Controller.getLastMeeting)
router.post("/endmeeting", tokenCheck, Controller.EndMeeting);
router.get("/getmeetinglist", tokenCheck, Controller.GetMeetingList);
router.post("/scheduledupdate", tokenCheck, Controller.scheduled);
router.post("/logout", tokenCheck, Controller.Logout);
router.get("/getcategory", tokenCheck, Controller.getCategory);

// Attendance routes (punch-in/punch-out/today/attendancelist) now live in
// src/modules/attendance/, mounted in server.ts — same URL paths as before.
// FIX: leave routes now require explicit leave permissions —
//      without leave:apply / leave:view the request is rejected with 403.
router.post("/leave", tokenCheck, checkPermission("leave", "apply"), Controller.requestLeave);
router.get("/leave-list", tokenCheck, checkPermission("leave", "view"), Controller.LeaveList);
router.get("/my-leave-balance", tokenCheck, checkPermission("leave", "view"), Controller.myLeaveBalance);
// Expense
// FIX: expense routes now require explicit permissions.
router.post(
  "/expense",
  tokenCheck,
  checkPermission("expense", "create"),
  expense.any(),
  Controller.CreateExpense
);
router.get("/getexpense", tokenCheck, checkPermission("expense", "view"), Controller.GetExpense);
router.get("/refreshtoken",tokenCheck,Controller.ReFressToken);
router.get("/my-permissions", tokenCheck, PermissionController.getMyPermissions);
router.patch("/updatepassword", tokenCheck, Controller.UpdatePassword);
// Quotation
// FIX: quotation routes now require explicit permissions.
// router.get("/getquotation",tokenCheck,Controller.getQuotation)
router.post("/getquotationpdf",          tokenCheck, checkPermission("quotation", "view"),   Controller.getQuotationPdf)
router.get("/getquotationpdflist",        tokenCheck, checkPermission("quotation", "view"),   Controller.getQuotationPdfList)
router.get("/downloadquotationpdf/:id",   tokenCheck, checkPermission("quotation", "view"),   Controller.downloadQuotationPdf)
router.get("/getsubcategory/:id",         tokenCheck, Controller.getSubCategory)
router.post("/addquotation",              tokenCheck, checkPermission("quotation", "create"), Controller.addQuotation)
router.post('/updatequotation/:id',       tokenCheck, checkPermission("quotation", "update"), Controller.updateQuotation)

router.get("/getcompany",tokenCheck,Controller.getCompany);

router.get("/getcompanydetails/:id",tokenCheck,Controller.getCompanyDetails);
router.get("/getBranchall", tokenCheck, Controller.getBranchall);

// Invoice
// FIX: invoice routes now require explicit permissions.
// Draft invoices require invoice:proforma; all other statuses require invoice:create (unchanged).
router.post("/addinvoice", tokenCheck, checkInvoiceCreatePermission(), Controller.addInvoice);
router.get("/getinvoice",  tokenCheck, checkInvoiceViewPermission(),   Controller.getInvoice);

//  router.post("/quotationToInvoice/:id",tokenCheck,Controller.quotationToInvoice);

// record  sale
router.post("/recordsale",tokenCheck,Controller.recordSale);
router.get("/getrecordsale",tokenCheck,Controller.getRecordSale);
router.get("/getrecordsale/:id",tokenCheck,Controller.getRecordSaleById);
router.patch("/updaterecordsale/:id",tokenCheck,Controller.updateRecordSale);
router.delete("/deleterecordsale/:id",tokenCheck,Controller.deleteRecordSale);

// ── Notifications ─────────────────────────────────────────────────────────
router.get("/notifications",                 tokenCheck, NotificationController.getNotifications);
router.get("/notifications/unread-count",    tokenCheck, NotificationController.getUnreadCount);
router.patch("/notifications/read-all",      tokenCheck, NotificationController.markAllAsRead);
router.patch("/notifications/:id/read",      tokenCheck, NotificationController.markAsRead);
router.delete("/notifications/clear-all",    tokenCheck, NotificationController.clearAllNotifications);
router.delete("/notifications/:id",          tokenCheck, NotificationController.deleteNotification);
// router.post("/notifications/test",           tokenCheck, NotificationController.testNotification);


router.post("/create-client", tokenCheck, Controller.createClient);
// FIX: tally report requires report:view permission.
router.get("/tally-report", tokenCheck, checkPermission("report", "view"), Controller.getTallyReport)
router.post("/forgot-password", Controller.forgotPassword);
router.post("/verify-otp", Controller.verifyOtp);
router.post("/reset-password", Controller.changePassword);
router.get("/dashboardmobile",tokenCheck,Controller.getDashboardMobile)

router.get("/getsalesPerformance",tokenCheck,Controller.getSalesPerformance)
router.get("/getbranch",tokenCheck,Controller.getBranchall)

// ============================================================
// Manager mobile — team oversight, mounted flat on this SAME /api
// surface sale_person's mobile app already uses (jwtVerify2 already
// allows role "manager" here) — no separate route family/prefix, no
// new namespace for the mobile team to integrate against. Two kinds
// of addition:
//
//  1. Existing self-service routes above (mysaleperson, getexpense,
//     leave-list, dashboardmobile) were made role-aware in-place —
//     see the role branch inside their controller functions in
//     src/app/controller/user.ts. A sale_person calling them gets the
//     EXACT same behavior as before; a manager gets the team-scoped
//     version of the same endpoint. No new routes needed for those.
//
//  2. The routes below are genuinely new — sale_person has no
//     equivalent capability at all (approve/assign/mark-for-someone-
//     else/schedule-for-someone-else) — so there's nothing existing to
//     extend. Named to match their /admin/* counterparts exactly
//     (same controller functions, same scoping, same checkPermission
//     gates) so behavior is predictable and consistent with the rest
//     of this file's naming. Every one is additionally restricted to
//     role:"manager" (authorizeRoles) — a sale_person token gets a
//     clean 403, not a confusing empty result.
// ============================================================

router.get("/top-performers", tokenCheck, authorizeRoles("manager"), AdminController.getTopPerformers);

// ── Attendance (team) ────────────────────────────────────────────────────────
router.get("/get-attendance", tokenCheck, authorizeRoles("manager"), checkPermission("attendance", "view"), AttendanceController.getAttendance);
router.get("/user-attendance", tokenCheck, authorizeRoles("manager"), checkPermission("attendance", "view"), AttendanceController.userAttendance);
router.get("/attendance-book", tokenCheck, authorizeRoles("manager"), checkPermission("attendance", "view"), AttendanceController.AttendanceBook);
router.post("/mark-attendance-present", tokenCheck, authorizeRoles("manager"), checkPermission("attendance", "update"), AttendanceController.markAttendancePresent);
router.post(
  "/bulk-mark-attendance",
  tokenCheck,
  authorizeRoles("manager"),
  checkPermission("attendance", "update"),
  attendanceBulk.single("file"),
  AttendanceController.bulkMarkAttendance
);

// ── Leave (team) ──────────────────────────────────────────────────────────────
router.patch("/approved-leave", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "approve"), LeaveController.approveLeave);
router.get("/user-leave", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "view"), LeaveController.userLeave);
router.get("/leave-request-today", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "view"), LeaveController.getTodayLeaveRequests);
router.get("/leave-balance-list", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "view"), LeaveController.getTeamLeaveBalances);
router.get("/leave-balance/:employeeId", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "view"), LeaveController.getEmployeeLeaveBalance);
router.post("/request-leave", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "apply"), LeaveController.createLeaveRequest);
router.post(
  "/cancel-leave-and-mark-present",
  tokenCheck,
  authorizeRoles("manager"),
  checkPermission("leave", "approve"),
  checkPermission("attendance", "update"),
  LeaveController.cancelLeaveAndMarkPresent
);
router.post("/assign-leave-balance", tokenCheck, authorizeRoles("manager"), checkPermission("leave", "manage"), LeaveController.assignLeaveBalance);

// ── Expense (team) ────────────────────────────────────────────────────────────
router.get("/user-expense", tokenCheck, authorizeRoles("manager"), checkPermission("expense", "view"), AdminController.userExpense);
router.patch("/approved-expense", tokenCheck, authorizeRoles("manager"), checkPermission("expense", "approve"), AdminController.UpdateExpense);

// ── Meetings (team) ───────────────────────────────────────────────────────────
router.post("/meetings/schedule", tokenCheck, authorizeRoles("manager"), checkPermission("meeting", "schedule"), MeetingController.scheduleMeeting);
router.patch("/meetings/:id/reschedule", tokenCheck, authorizeRoles("manager"), checkPermission("meeting", "update"), MeetingController.rescheduleMeeting);
router.get("/meetings/dashboard", tokenCheck, authorizeRoles("manager"), checkPermission("meeting", "view"), MeetingController.getMeetingDashboard);

export default router;
