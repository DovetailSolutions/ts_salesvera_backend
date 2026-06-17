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
const jwtVerify_1 = require("../../config/jwtVerify");
const checkPermission_1 = require("../../config/checkPermission");
const rbac_1 = require("../middlewear/rbac");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const profile = (0, fileUploads_1.default)("image");
const meeting = (0, fileUploads_1.default)("image");
const expense = (0, fileUploads_1.default)("expense");
const csv = (0, fileUploads_1.default)("csv");
router.post("/register", AdminController.Register);
router.post("/login", AdminController.Login);
router.get("/getProfile", jwtVerify_1.tokenCheck, AdminController.GetProfile);
router.patch("/updateProfile", jwtVerify_1.tokenCheck, profile.single("profile"), AdminController.UpdateProfile);
router.patch("/updatepassword", jwtVerify_1.tokenCheck, AdminController.UpdatePassword);
router.get("/mysaleperson", jwtVerify_1.tokenCheck, AdminController.MySalePerson);
router.post('/assign-salesman', jwtVerify_1.tokenCheck, AdminController.assignSalesman);
router.post("/addcategory", jwtVerify_1.tokenCheck, AdminController.AddCategory);
router.get("/getcategory", jwtVerify_1.tokenCheck, AdminController.getcategory);
router.get("/getcategory-with-subcategories", jwtVerify_1.tokenCheck, AdminController.getCategoryWithSubCategories);
router.get("/getcategoy/:id", jwtVerify_1.tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", jwtVerify_1.tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", jwtVerify_1.tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload", jwtVerify_1.tokenCheck, csv.single("csv"), AdminController.BulkUploads);
router.post("/bulk-add-saleperson", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), csv.single("csv"), AdminController.BulkAddSalePerson);
// FIX: attendance view routes require attendance:view permission.
router.get("/get-attendance", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AdminController.getAttendance);
// FIX: approve/reject requires leave:approve; listing all leave requests requires leave:view.
router.patch("/approved-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "approve"), AdminController.approveLeave);
router.get("/get-leave-list", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), AdminController.leaveList);
// FIX: expense routes now require explicit permissions.
router.get("/get-expense", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("expense", "view"), AdminController.GetExpense);
router.get("/admin-manager", jwtVerify_1.tokenCheck, AdminController.test);
router.patch('/approved-expense', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("expense", "approve"), AdminController.UpdateExpense);
router.get("/user-attendance", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AdminController.userAttendance);
// FIX: viewing a specific user's leave history requires leave:view.
router.get('/user-leave', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), AdminController.userLeave);
router.get('/user-expense', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("expense", "view"), AdminController.userExpense);
router.get("/attendance-book", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("attendance", "view"), AdminController.AttendanceBook);
router.post("/create-client", jwtVerify_1.tokenCheck, AdminController.createClient);
router.post("/assign-meeting", jwtVerify_1.tokenCheck, AdminController.assignMeeting);
// FIX: admin viewing their own leave requests also requires leave:view.
router.get("/getown-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "view"), AdminController.ownLeave);
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
//>>>>>>>>>>>>>>>>>>>>>>>>add company >>>>>>>>>>>>>>>
router.post("/addcompany", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.addCompany);
router.get("/getcompany", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.getCompany);
router.get("/getcompany/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.getCompanyById);
router.patch("/updatecompany/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.updateCompany);
router.delete("/deletecompany/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.deleteCompany);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/addbranch", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.addBranch);
router.get("/getbranch", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getBranch);
router.get("/getbranch/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getBranchById);
// router.patch("/updatebranch/:id",tokenCheck,AdminController.updateBranch);
// router.delete("/deletebranch/:id",tokenCheck,AdminController.deleteBranch);
router.post("/addshift", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.addShift);
router.get("/getshift", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getShift);
router.get("/getshift/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getShiftById);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/adddepartment", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.addDepartment);
router.get("/getdepartment", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getDepartment);
router.get("/getdepartment/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getDepartmentById);
// router.patch("/updatedepartment/:id",tokenCheck,AdminController.updateDepartment);
// router.delete("/deletedepartment/:id",tokenCheck,AdminController.deleteDepartment);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/addholiday", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.addHoliday);
router.get("/getholiday", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getHoliday);
router.get("/getholiday/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), AdminController.getHolidayById);
// router.patch("/updateholiday/:id",tokenCheck,AdminController.updateHoliday);
// router.delete("/deleteholiday/:id",tokenCheck,AdminController.deleteHoliday);
// FIX: quotation CRUD routes require quotation permissions.
router.post("/addquotation", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "create"), AdminController.addQuotation2);
router.get("/getquotationlist", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "view"), AdminController.getQuotationPdfList2);
router.post('/updatequotation/:id', jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("quotation", "update"), AdminController.updateQuotation);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// FIX: creating/viewing company leave policies (types, rules) requires leave:manage.
//      Without this a manager/sale_person could read or write company policy config.
router.post("/add-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "manage"), AdminController.addLeave);
router.get("/get-leave", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "manage"), AdminController.getLeave);
router.get("/get-leave/:id", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("leave", "manage"), AdminController.getLeaveById);
// router.patch("/update-leave/:id", tokenCheck, AdminController.updateLeave);
// router.delete("/delete-leave/:id", tokenCheck, AdminController.deleteLeave);
router.post("/add-bank", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), AdminController.addCompanyBank);
// router.get("/get-bank",tokenCheck,AdminController.getBank);
// router.get("/get-bank/:id",tokenCheck,AdminController.getBankById);
// router.patch("/update-bank/:id",tokenCheck,AdminController.updateBank);
// router.delete("/delete-bank/:id",tokenCheck,AdminController.deleteBank);
router.get("/get-client", jwtVerify_1.tokenCheck, AdminController.getClient);
router.post("/update-client/:id", jwtVerify_1.tokenCheck, AdminController.updateClient);
router.post("/category/:id", jwtVerify_1.tokenCheck, AdminController.CategoryStatus);
router.post("/sub-category/:id", jwtVerify_1.tokenCheck, AdminController.SubCategoryStatus);
// FIX: invoice routes now require explicit permissions.
router.post("/addinvoice", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("invoice", "create"), AdminController.addInvoice);
router.get("/getinvoice", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("invoice", "view"), AdminController.getInvoice);
router.post("/updateinvoice/:id", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("invoice", "update"), AdminController.updateInvoice);
router.get("/get-record-sale", jwtVerify_1.tokenCheck, AdminController.getRecordSale);
// FIX: report routes now require explicit permissions.
//      Generating/updating a report requires report:export; reading requires report:view.
router.post("/add-report", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "export"), AdminController.addReport);
router.get("/get-report", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "view"), AdminController.getReport);
router.get("/get-report-details", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "view"), AdminController.getReportDetails);
router.post("/update-report", jwtVerify_1.tokenCheck, (0, checkPermission_1.checkPermission)("report", "export"), AdminController.updateReport);
// router.delete("/delete-report/:id",tokenCheck,AdminController.deleteReport);
router.patch("/assign-admin/:id", jwtVerify_1.tokenCheck, AdminController.assignAdmin);
router.get("/getowncompany", jwtVerify_1.tokenCheck, AdminController.getOwnCompany);
router.get("/getalluser", jwtVerify_1.tokenCheck, AdminController.GetAllUser);
router.post("/forgot-password", AdminController.forgotPassword);
router.post("/verify-otp", AdminController.verifyOtp);
router.post("/reset-password", AdminController.changePassword);
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getusermeeting', jwtVerify_1.tokenCheck, AdminController.getMeeting);
exports.default = router;
