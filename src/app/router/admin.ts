import { Router } from "express";
const router = Router();
import * as AdminController from "../controller/admin";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission, checkInvoiceCreatePermission, checkInvoiceUpdatePermission, checkInvoiceViewPermission } from "../../config/checkPermission";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import getUploadMiddleware from "../../config/fileUploads";
const profile = getUploadMiddleware("image");
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
const csv = getUploadMiddleware("csv")


router.post("/register", AdminController.Register);
router.post("/login", AdminController.Login);
router.post("/logout", tokenCheck, AdminController.Logout);
router.get("/getProfile", tokenCheck, AdminController.GetProfile);
router.patch("/updateProfile", tokenCheck, profile.single("profile"), AdminController.UpdateProfile);
router.patch("/updatepassword", tokenCheck, AdminController.UpdatePassword);
router.get("/mysaleperson", tokenCheck, AdminController.MySalePerson);
router.post('/assign-salesman',tokenCheck, AdminController.assignSalesman);
router.post("/addcategory", tokenCheck, AdminController.AddCategory);
router.get("/getcategory", tokenCheck, AdminController.getcategory);
router.get("/getcategory-with-subcategories", tokenCheck, AdminController.getCategoryWithSubCategories);
router.get("/getcategoy/:id", tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload",tokenCheck,csv.single("csv"),AdminController.BulkUploads)
router.post("/bulk-add-saleperson", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), csv.single("csv"), AdminController.BulkAddSalePerson)
// FIX: attendance view routes require attendance:view permission.
router.get("/get-attendance", tokenCheck, checkPermission("attendance", "view"), AdminController.getAttendance);
router.post("/mark-attendance-present", tokenCheck, checkPermission("attendance", "update"), AdminController.markAttendancePresent);
// Cancels the given leave (restores balance, flips its Attendance rows to leaveReject)
// then marks the given date present in one call — needed since mark-attendance-present
// refuses to overwrite a leave/leaveApproved/leaveReject row directly.
router.post("/cancel-leave-and-mark-present", tokenCheck, checkPermission("leave", "approve"), checkPermission("attendance", "update"), AdminController.cancelLeaveAndMarkPresent);
// FIX: approve/reject requires leave:approve; listing all leave requests requires leave:view.
router.patch("/approved-leave", tokenCheck, checkPermission("leave", "approve"), AdminController.approveLeave);
router.get("/get-leave-list", tokenCheck, checkPermission("leave", "view"), AdminController.leaveList)
router.get("/leave-request-today", tokenCheck, checkPermission("leave", "view"), AdminController.getTodayLeaveRequests)
// Per-employee leave balance: admin/manager assign & view balances for their sale_persons.
router.post("/assign-leave-balance", tokenCheck, checkPermission("leave", "manage"), AdminController.assignLeaveBalance);
router.get("/leave-balance-list", tokenCheck, checkPermission("leave", "view"), AdminController.getTeamLeaveBalances);
router.get("/leave-balance/:employeeId", tokenCheck, checkPermission("leave", "view"), AdminController.getEmployeeLeaveBalance);
// FIX: expense routes now require explicit permissions.
router.get("/get-expense",       tokenCheck, checkPermission("expense", "view"),    AdminController.GetExpense);
router.get("/admin-manager",tokenCheck,AdminController.test);
router.patch('/approved-expense', tokenCheck, checkPermission("expense", "approve"), AdminController.UpdateExpense)
router.get("/user-attendance", tokenCheck, checkPermission("attendance", "view"), AdminController.userAttendance)
// FIX: viewing a specific user's leave history requires leave:view.
router.get('/user-leave', tokenCheck, checkPermission("leave", "view"), AdminController.userLeave)
router.get('/user-expense', tokenCheck, checkPermission("expense", "view"), AdminController.userExpense)
router.get("/attendance-book", tokenCheck, checkPermission("attendance", "view"), AdminController.AttendanceBook);
router.post("/create-client", tokenCheck, AdminController.createClient);
router.post("/assign-meeting", tokenCheck, AdminController.assignMeeting);
// FIX: admin viewing their own leave requests also requires leave:view.
router.get("/getown-leave", tokenCheck, checkPermission("leave", "view"), AdminController.ownLeave)
// FIX: was missing tokenCheck entirely — added both tokenCheck and quotation:create.
router.post("/add/quotation", tokenCheck, checkPermission("quotation", "create"), AdminController.addQuotation);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post(
    "/addSubCategory",
    tokenCheck,
    AdminController.addSubCategory
);
router.patch(
    "/updateSubCategory/:id",
    tokenCheck,
    AdminController.updateSubCategory
);
router.get("/getsubcategory/:id",tokenCheck,AdminController.getSubCategory)
// FIX: quotation PDF routes require quotation permissions.
router.get("/getquotationpdflist",      tokenCheck, checkPermission("quotation", "view"),   AdminController.getQuotationPdfList)
router.get("/downloadquotationpdf/:id", tokenCheck, checkPermission("quotation", "view"),   AdminController.downloadQuotationPdf);
router.post("/addquotationpdf",         tokenCheck, checkPermission("quotation", "create"), AdminController.addQuotationPdf)
router.get("/fuel-expense", tokenCheck, AdminController.getMeetingDistance);
router.get("/get-fuel-expense",tokenCheck,AdminController.getFuelExpense)
//>>>>>>>>>>>>>>>>>>>>>>>>add company >>>>>>>>>>>>>>>
router.post("/addcompany",    tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.addCompany);
router.get("/getcompany",     tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.getCompany);
router.get("/getcompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.getCompanyById);
router.patch("/updatecompany/:id",  tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.updateCompany);
router.post("/assign-company-manager/:id",  tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.assignCompanyManager);
router.delete("/remove-company-manager",    tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.removeCompanyManager);
router.get("/company-managers/:id",         tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.getCompanyManagers);
router.get("/my-companies",    tokenCheck, AdminController.getMyCompanies);
router.post("/switch-company", tokenCheck, AdminController.switchCompany);
router.delete("/deletecompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.deleteCompany);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/addbranch",    tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.addBranch);
router.get("/getbranch",     tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getBranch);
router.get("/getbranch/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getBranchById);
// router.patch("/updatebranch/:id",tokenCheck,AdminController.updateBranch);
// router.delete("/deletebranch/:id",tokenCheck,AdminController.deleteBranch);
router.post("/addshift",    tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.addShift);
router.get("/getshift",     tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getShift);
router.get("/getshift/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getShiftById);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/adddepartment",    tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.addDepartment);
router.get("/getdepartment",     tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getDepartment);
router.get("/getdepartment/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getDepartmentById);
// router.patch("/updatedepartment/:id",tokenCheck,AdminController.updateDepartment);
// router.delete("/deletedepartment/:id",tokenCheck,AdminController.deleteDepartment);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post("/addholiday",    tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.addHoliday);
router.get("/getholiday",     tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getHoliday);
router.get("/getholiday/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getHolidayById);
// router.patch("/updateholiday/:id",tokenCheck,AdminController.updateHoliday);
// router.delete("/deleteholiday/:id",tokenCheck,AdminController.deleteHoliday);
// FIX: quotation CRUD routes require quotation permissions.
router.post("/addquotation",       tokenCheck, checkPermission("quotation", "create"), AdminController.addQuotation2)
router.get("/getquotationlist",    tokenCheck, checkPermission("quotation", "view"),   AdminController.getQuotationPdfList2)
router.post('/updatequotation/:id',tokenCheck, checkPermission("quotation", "update"), AdminController.updateQuotation)
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// FIX: creating/viewing company leave policies (types, rules) requires leave:manage.
//      Without this a manager/sale_person could read or write company policy config.
router.post("/add-leave", tokenCheck, checkPermission("leave", "manage"), AdminController.addLeave);
router.get("/get-leave", tokenCheck, checkPermission("leave", "manage"), AdminController.getLeave);
router.get("/get-leave/:id", tokenCheck, checkPermission("leave", "manage"), AdminController.getLeaveById);
router.patch("/update-leave/:id", tokenCheck, checkPermission("leave", "manage"), AdminController.updateLeave);
// router.delete("/delete-leave/:id", tokenCheck, AdminController.deleteLeave);
router.post("/add-bank", tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.addCompanyBank);
// router.get("/get-bank",tokenCheck,AdminController.getBank);
// router.get("/get-bank/:id",tokenCheck,AdminController.getBankById);
// router.patch("/update-bank/:id",tokenCheck,AdminController.updateBank);
// router.delete("/delete-bank/:id",tokenCheck,AdminController.deleteBank);



router.get("/get-client",tokenCheck,AdminController.getClient);
router.post("/update-client/:id",tokenCheck,AdminController.updateClient);
router.post("/category/:id",tokenCheck,AdminController.CategoryStatus);
router.post("/sub-category/:id",tokenCheck,AdminController.SubCategoryStatus);


// FIX: invoice routes now require explicit permissions.
// Draft invoices require proformainvoice:create; all other statuses require invoice:create (unchanged).
// getinvoice passes with EITHER invoice:view or proformainvoice:view (checkInvoiceViewPermission) —
// a user with only proformainvoice:view can still hit the route to see their drafts; the controller
// further filters which rows (draft vs non-draft) are actually returned. updateinvoice checks the
// invoice's CURRENT status — draft rows require proformainvoice:update, others require invoice:update.
router.post("/addinvoice",         tokenCheck, checkInvoiceCreatePermission(), AdminController.addInvoice);
router.get("/getinvoice",          tokenCheck, checkInvoiceViewPermission(),   AdminController.getInvoice);
router.post("/updateinvoice/:id",  tokenCheck, checkInvoiceUpdatePermission(), AdminController.updateInvoice);
router.get("/get-record-sale",tokenCheck,AdminController.getRecordSale);
// FIX: report routes now require explicit permissions.
//      Generating/updating a report requires report:export; reading requires report:view.
router.post("/add-report",        tokenCheck, checkPermission("report", "export"), AdminController.addReport);
router.get("/get-report",         tokenCheck, checkPermission("report", "view"),   AdminController.getReport);
router.get("/get-report-details", tokenCheck, checkPermission("report", "view"),   AdminController.getReportDetails);
router.post("/update-report",     tokenCheck, checkPermission("report", "export"), AdminController.updateReport);
// router.delete("/delete-report/:id",tokenCheck,AdminController.deleteReport);


router.patch("/assign-admin/:id", tokenCheck, AdminController.assignAdmin);
router.get("/getowncompany",  tokenCheck, AdminController.getOwnCompany);

router.get("/getalluser",tokenCheck,AdminController.GetAllUser)

router.post("/forgot-password", AdminController.forgotPassword);
router.post("/verify-otp", AdminController.verifyOtp);
router.post("/reset-password", AdminController.changePassword);
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getusermeeting',tokenCheck,AdminController.getMeeting)
router.get("/dashboard-summary", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getDashboardSummary);
router.get("/top-performers", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getTopPerformers);
 









export default router;
