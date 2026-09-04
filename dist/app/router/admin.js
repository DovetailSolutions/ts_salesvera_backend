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
const AdminController = __importStar(require("../controller/admin"));
const UserController = __importStar(require("../controller/user"));
const NotificationController = __importStar(require("../controller/notification"));
const jwtVerify_1 = require("../../config/jwtVerify");
const checkPermission_1 = require("../../config/checkPermission");
const rbac_1 = require("../middlewear/rbac");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const meeting = (0, fileUploads_1.default)("image");
const expense = (0, fileUploads_1.default)("expense");
const csv = (0, fileUploads_1.default)("csv");
// Auth routes (register/login/logout/getProfile/updateProfile/
// updatepassword/forgot-password/verify-otp/reset-password) now live in
// src/modules/auth/, mounted in server.ts — same URL paths as before.
// Both /admin/mysaleperson (web) and /api/mysaleperson (mobile, user.ts
// router) now serve the exact same handler — they used to be two
// independently-maintained copies that drifted apart (this one had no
// company scoping and no ownership check on an arbitrary managerId).
router.get("/mysaleperson", jwtVerify_1.tokenCheck, UserController.MySalePerson);
router.post('/assign-salesman', jwtVerify_1.tokenCheck, AdminController.assignSalesman);
router.post("/addcategory", jwtVerify_1.tokenCheck, AdminController.AddCategory);
router.get("/getcategory", jwtVerify_1.tokenCheck, AdminController.getcategory);
router.get("/getcategory-with-subcategories", jwtVerify_1.tokenCheck, AdminController.getCategoryWithSubCategories);
router.get("/getcategoy/:id", jwtVerify_1.tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", jwtVerify_1.tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", jwtVerify_1.tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload", jwtVerify_1.tokenCheck, csv.single("csv"), AdminController.BulkUploads);
router.post("/bulk-add-saleperson", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), csv.single("csv"), AdminController.BulkAddSalePerson);
// Attendance routes (get-attendance/mark-attendance-present/
// bulk-mark-attendance/user-attendance/attendance-book) now live in
// src/modules/attendance/, mounted in server.ts — same URL paths as before.
// Leave routes (cancel-leave-and-mark-present/approved-leave/get-leave-list/
// leave-request-today/assign-leave-balance/leave-balance-list/
// leave-balance/:employeeId/user-leave/getown-leave/add-leave/get-leave/
// get-leave/:id/update-leave/:id) now live in src/modules/leave/, mounted
// in server.ts — same URL paths as before.
// FIX: expense routes now require explicit permissions.
router.get("/get-expense", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("expense", "view"), AdminController.GetExpense);
router.get("/admin-manager", jwtVerify_1.tokenCheck, AdminController.test);
// User Management page: admin/super_admin toggle controlling whether a
// sale_person's own GET /api/getprofile includes the company's full branch
// list (default off).
router.patch("/users/:userId/branch-visibility", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)("super_admin", "admin"), AdminController.UpdateBranchVisibility);
router.patch('/approved-expense', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("expense", "approve"), AdminController.UpdateExpense);
router.get('/user-expense', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("expense", "view"), AdminController.userExpense);
router.post("/create-client", jwtVerify_1.tokenCheck, AdminController.createClient);
router.post("/assign-meeting", jwtVerify_1.tokenCheck, AdminController.assignMeeting);
// FIX: was missing tokenCheck entirely — added both tokenCheck and quotation:create.
router.post("/add/quotation", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "create"), AdminController.addQuotation);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/addSubCategory", jwtVerify_1.tokenCheck, AdminController.addSubCategory);
router.patch("/updateSubCategory/:id", jwtVerify_1.tokenCheck, AdminController.updateSubCategory);
router.get("/getsubcategory/:id", jwtVerify_1.tokenCheck, AdminController.getSubCategory);
// FIX: quotation PDF routes require quotation permissions.
router.get("/getquotationpdflist", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "view"), AdminController.getQuotationPdfList);
router.get("/downloadquotationpdf/:id", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "view"), AdminController.downloadQuotationPdf);
router.post("/addquotationpdf", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "create"), AdminController.addQuotationPdf);
router.get("/fuel-expense", jwtVerify_1.tokenCheck, AdminController.getMeetingDistance);
router.get("/get-fuel-expense", jwtVerify_1.tokenCheck, AdminController.getFuelExpense);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Company routes (addcompany/getcompany/getcompany/:id/updatecompany/:id/
// assign-company-manager/:id/remove-company-manager/company-managers/:id/
// my-companies/switch-company/deletecompany/:id/add-bank/getowncompany) now
// live in src/modules/company/, mounted in server.ts — same URL paths.
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Branch/Shift/Department CRUD now live in src/modules/{branch,shift,
// department}/ — see each module's *.routes.ts, mounted in server.ts.
// Same URL paths as before. "assign-employee-shift" stays here — it's a
// cross-domain employee-assignment concern, not pure Shift/Department CRUD.
router.patch("/assign-employee-shift", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.assignEmployeeShift);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Holiday routes (add/get/get-by-id/update) now live in
// src/modules/holiday/holiday.routes.ts, mounted in server.ts — same URL
// paths, extracted out of this file as the first slice of the modular
// backend architecture (see src/modules/README or the architecture plan).
// FIX: quotation CRUD routes require quotation permissions.
router.post("/addquotation", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "create"), AdminController.addQuotation2);
router.get("/getquotationlist", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "view"), AdminController.getQuotationPdfList2);
router.post('/updatequotation/:id', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "update"), AdminController.updateQuotation);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// router.get("/get-bank",tokenCheck,AdminController.getBank);
// router.get("/get-bank/:id",tokenCheck,AdminController.getBankById);
// router.patch("/update-bank/:id",tokenCheck,AdminController.updateBank);
// router.delete("/delete-bank/:id",tokenCheck,AdminController.deleteBank);
router.get("/get-client", jwtVerify_1.tokenCheck, AdminController.getClient);
router.get("/get-client-details/:id", jwtVerify_1.tokenCheck, AdminController.getClientDetails);
router.get("/client-details/:id", jwtVerify_1.tokenCheck, AdminController.getClientDetails);
router.post("/update-client/:id", jwtVerify_1.tokenCheck, AdminController.updateClient);
router.post("/category/:id", jwtVerify_1.tokenCheck, AdminController.CategoryStatus);
router.post("/sub-category/:id", jwtVerify_1.tokenCheck, AdminController.SubCategoryStatus);
// FIX: invoice routes now require explicit permissions.
// Draft invoices require proformainvoice:create; all other statuses require invoice:create (unchanged).
// getinvoice passes with EITHER invoice:view or proformainvoice:view (checkInvoiceViewPermission) —
// a user with only proformainvoice:view can still hit the route to see their drafts; the controller
// further filters which rows (draft vs non-draft) are actually returned. updateinvoice checks the
// invoice's CURRENT status — draft rows require proformainvoice:update, others require invoice:update.
router.post("/addinvoice", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkInvoiceCreatePermission)(), AdminController.addInvoice);
router.get("/getinvoice", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkInvoiceViewPermission)(), AdminController.getInvoice);
router.post("/updateinvoice/:id", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkInvoiceUpdatePermission)(), AdminController.updateInvoice);
router.get("/get-record-sale", jwtVerify_1.tokenCheck, AdminController.getRecordSale);
// FIX: report routes now require explicit permissions.
//      Generating/updating a report requires report:export; reading requires report:view.
router.post("/add-report", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "export"), AdminController.addReport);
router.get("/get-report", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "view"), AdminController.getReport);
router.get("/get-report-details", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "view"), AdminController.getReportDetails);
router.post("/update-report", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "export"), AdminController.updateReport);
// router.delete("/delete-report/:id",tokenCheck,AdminController.deleteReport);
router.patch("/assign-admin/:id", jwtVerify_1.tokenCheck, AdminController.assignAdmin);
router.get("/getalluser", jwtVerify_1.tokenCheck, AdminController.GetAllUser);
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getusermeeting', jwtVerify_1.tokenCheck, AdminController.getMeeting);
router.get('/getmeetingdetails/:id', jwtVerify_1.tokenCheck, AdminController.getMeetingDetails);
router.get("/dashboard-summary", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getDashboardSummary);
router.get("/top-performers", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getTopPerformers);
// ── Notifications (admin-surface) ───────────────────────────────────────
// Same controller as /api/notifications (user.ts) — that surface's
// tokenCheck (jwtVerify2) only allows user/manager/sale_person, so admin
// and super_admin accounts 401 on every call there. The web admin panel's
// notification bell needs this to work for those two roles too.
router.get("/notifications", jwtVerify_1.tokenCheck, NotificationController.getNotifications);
router.get("/notifications/unread-count", jwtVerify_1.tokenCheck, NotificationController.getUnreadCount);
router.patch("/notifications/read-all", jwtVerify_1.tokenCheck, NotificationController.markAllAsRead);
router.patch("/notifications/:id/read", jwtVerify_1.tokenCheck, NotificationController.markAsRead);
router.delete("/notifications/clear-all", jwtVerify_1.tokenCheck, NotificationController.clearAllNotifications);
router.delete("/notifications/:id", jwtVerify_1.tokenCheck, NotificationController.deleteNotification);
exports.default = router;
