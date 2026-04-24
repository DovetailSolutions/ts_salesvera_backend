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
const router = (0, express_1.Router)();
const Controller = __importStar(require("../controller/user"));
const NotificationController = __importStar(require("../controller/notification"));
const jwtVerify2_1 = require("../../config/jwtVerify2");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const profile = (0, fileUploads_1.default)("image");
const meeting = (0, fileUploads_1.default)("image");
const expense = (0, fileUploads_1.default)("expense");
router.post("/register", Controller.Register);
router.post("/login", Controller.Login);
router.get("/getprofile", jwtVerify2_1.tokenCheck, Controller.GetProfile);
router.patch("/updateprofile", jwtVerify2_1.tokenCheck, profile.single("profile"), Controller.UpdateProfile);
router.get("/mysaleperson", jwtVerify2_1.tokenCheck, Controller.MySalePerson);
router.post("/createmeeting", jwtVerify2_1.tokenCheck, meeting.array("image"), Controller.CreateMeeting);
router.get("/clientmeeting", jwtVerify2_1.tokenCheck, Controller.getLastMeeting);
router.post("/endmeeting", jwtVerify2_1.tokenCheck, Controller.EndMeeting);
router.get("/getmeetinglist", jwtVerify2_1.tokenCheck, Controller.GetMeetingList);
router.post("/scheduledupdate", jwtVerify2_1.tokenCheck, Controller.scheduled);
router.post("/logout", jwtVerify2_1.tokenCheck, Controller.Logout);
router.get("/getcategory", Controller.getCategory);
// Attendance Summary
router.post("/attendance/punch-in", jwtVerify2_1.tokenCheck, Controller.AttendancePunchIn);
router.post("/attendance/punch-out", jwtVerify2_1.tokenCheck, Controller.AttendancePunchOut);
router.get("/attendance/today", jwtVerify2_1.tokenCheck, Controller.getTodayAttendance);
router.get("/attendancelist", jwtVerify2_1.tokenCheck, Controller.AttendanceList);
router.post("/leave", jwtVerify2_1.tokenCheck, Controller.requestLeave);
router.get("/leave-list", jwtVerify2_1.tokenCheck, Controller.LeaveList);
//Expense
router.post("/expense", jwtVerify2_1.tokenCheck, expense.array("billImage"), Controller.CreateExpense);
router.get("/getexpense", jwtVerify2_1.tokenCheck, Controller.GetExpense);
router.get("/refreshtoken", jwtVerify2_1.tokenCheck, Controller.ReFressToken);
router.patch("/updatepassword", jwtVerify2_1.tokenCheck, Controller.UpdatePassword);
// router.get("/getquotation",tokenCheck,Controller.getQuotation)
router.post("/getquotationpdf", jwtVerify2_1.tokenCheck, Controller.getQuotationPdf);
router.get("/getquotationpdflist", jwtVerify2_1.tokenCheck, Controller.getQuotationPdfList);
router.get("/downloadquotationpdf/:id", jwtVerify2_1.tokenCheck, Controller.downloadQuotationPdf);
router.get("/getsubcategory/:id", jwtVerify2_1.tokenCheck, Controller.getSubCategory);
router.post("/addquotation", jwtVerify2_1.tokenCheck, Controller.addQuotation);
router.post('/updatequotation/:id', jwtVerify2_1.tokenCheck, Controller.updateQuotation);
router.get("/getcompany", jwtVerify2_1.tokenCheck, Controller.getCompany);
router.get("/getcompanydetails/:id", jwtVerify2_1.tokenCheck, Controller.getCompanyDetails);
router.post("/addinvoice", jwtVerify2_1.tokenCheck, Controller.addInvoice);
router.get("/getinvoice", jwtVerify2_1.tokenCheck, Controller.getInvoice);
//  router.post("/quotationToInvoice/:id",tokenCheck,Controller.quotationToInvoice);
// record  sale
router.post("/recordsale", jwtVerify2_1.tokenCheck, Controller.recordSale);
router.get("/getrecordsale", jwtVerify2_1.tokenCheck, Controller.getRecordSale);
router.get("/getrecordsale/:id", jwtVerify2_1.tokenCheck, Controller.getRecordSaleById);
router.patch("/updaterecordsale/:id", jwtVerify2_1.tokenCheck, Controller.updateRecordSale);
router.delete("/deleterecordsale/:id", jwtVerify2_1.tokenCheck, Controller.deleteRecordSale);
// ── Notifications ─────────────────────────────────────────────────────────
router.get("/notifications", jwtVerify2_1.tokenCheck, NotificationController.getNotifications);
router.get("/notifications/unread-count", jwtVerify2_1.tokenCheck, NotificationController.getUnreadCount);
router.patch("/notifications/read-all", jwtVerify2_1.tokenCheck, NotificationController.markAllAsRead);
router.patch("/notifications/:id/read", jwtVerify2_1.tokenCheck, NotificationController.markAsRead);
router.delete("/notifications/clear-all", jwtVerify2_1.tokenCheck, NotificationController.clearAllNotifications);
router.delete("/notifications/:id", jwtVerify2_1.tokenCheck, NotificationController.deleteNotification);
// router.post("/notifications/test",           tokenCheck, NotificationController.testNotification);
router.post("/create-client", jwtVerify2_1.tokenCheck, Controller.createClient);
router.get("/tally-report", jwtVerify2_1.tokenCheck, Controller.getTallyReport);
// router.post("/forgot-password", Controller.forgotPassword);
// router.post("/verify-opt", Controller.verifyOtp);
// router.post("/reset-password", Controller.changePassword);
exports.default = router;
