import { Router } from "express";
const router = Router();
import * as Controller from "../controller/user";
import * as NotificationController from "../controller/notification";
import { tokenCheck } from "../../config/jwtVerify2";
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
router.get("/getcategory", Controller.getCategory);

// Attendance Summary
router.post("/attendance/punch-in", tokenCheck, Controller.AttendancePunchIn);
router.post("/attendance/punch-out", tokenCheck, Controller.AttendancePunchOut);
router.get("/attendance/today", tokenCheck, Controller.getTodayAttendance);
router.get("/attendancelist", tokenCheck, Controller.AttendanceList);
router.post("/leave", tokenCheck, Controller.requestLeave);
router.get("/leave-list", tokenCheck, Controller.LeaveList);
//Expense
router.post(
  "/expense",
  tokenCheck,
  expense.array("billImage"),
  Controller.CreateExpense
);
router.get("/getexpense",tokenCheck,Controller.GetExpense);
router.get("/refreshtoken",tokenCheck,Controller.ReFressToken);
router.patch("/updatepassword", tokenCheck, Controller.UpdatePassword);
// router.get("/getquotation",tokenCheck,Controller.getQuotation)
router.post("/getquotationpdf",tokenCheck,Controller.getQuotationPdf)
router.get("/getquotationpdflist",tokenCheck,Controller.getQuotationPdfList)
router.get("/downloadquotationpdf/:id",tokenCheck,Controller.downloadQuotationPdf)
router.get("/getsubcategory/:id",tokenCheck,Controller.getSubCategory)
router.post("/addquotation",tokenCheck,Controller.addQuotation)

router.post('/updatequotation/:id',tokenCheck,Controller.updateQuotation)

router.get("/getcompany",tokenCheck,Controller.getCompany);

router.get("/getcompanydetails/:id",tokenCheck,Controller.getCompanyDetails);

router.post("/addinvoice",tokenCheck,Controller.addInvoice);
router.get("/getinvoice",tokenCheck,Controller.getInvoice);

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


router.post("/create-client", tokenCheck, Controller.createClient);
router.get("/tally-report",tokenCheck,Controller.getTallyReport)
// router.post("/forgot-password", Controller.forgotPassword);
// router.post("/verify-opt", Controller.verifyOtp);
// router.post("/reset-password", Controller.changePassword);


export default router;
