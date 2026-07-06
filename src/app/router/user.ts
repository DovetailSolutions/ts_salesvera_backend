import { Router } from "express";
const router = Router();
import * as Controller from "../controller/user";
import * as NotificationController from "../controller/notification";
import * as PermissionController from "../controller/permission";
import { tokenCheck } from "../../config/jwtVerify2";
import { checkPermission, checkInvoiceCreatePermission } from "../../config/checkPermission";
import getUploadMiddleware from "../../config/fileUploads";
const profile = getUploadMiddleware("image");
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
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

// Attendance Summary
// FIX: attendance routes now require explicit permissions.
router.post("/attendance/punch-in",  tokenCheck, checkPermission("attendance", "create"), Controller.AttendancePunchIn);
router.post("/attendance/punch-out", tokenCheck, checkPermission("attendance", "update"), Controller.AttendancePunchOut);
router.get("/attendance/today",      tokenCheck, checkPermission("attendance", "view"),   Controller.getTodayAttendance);
router.get("/attendancelist",        tokenCheck, checkPermission("attendance", "view"),   Controller.AttendanceList);
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
router.get("/getinvoice",  tokenCheck, checkPermission("invoice", "view"),   Controller.getInvoice);

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


export default router;
