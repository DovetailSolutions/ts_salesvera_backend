import { Router } from "express";
const router = Router();
import * as AdminController from "../controller/admin";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission, checkInvoiceCreatePermission, checkInvoiceUpdatePermission, checkInvoiceViewPermission } from "../../config/checkPermission";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import getUploadMiddleware from "../../config/fileUploads";
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
const csv = getUploadMiddleware("csv")

// Auth routes (register/login/logout/getProfile/updateProfile/
// updatepassword/forgot-password/verify-otp/reset-password) now live in
// src/modules/auth/, mounted in server.ts — same URL paths as before.
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
// Attendance routes (get-attendance/mark-attendance-present/
// bulk-mark-attendance/user-attendance/attendance-book) now live in
// src/modules/attendance/, mounted in server.ts — same URL paths as before.
// Leave routes (cancel-leave-and-mark-present/approved-leave/get-leave-list/
// leave-request-today/assign-leave-balance/leave-balance-list/
// leave-balance/:employeeId/user-leave/getown-leave/add-leave/get-leave/
// get-leave/:id/update-leave/:id) now live in src/modules/leave/, mounted
// in server.ts — same URL paths as before.
// FIX: expense routes now require explicit permissions.
router.get("/get-expense",       tokenCheck, checkPermission("expense", "view"),    AdminController.GetExpense);
router.get("/admin-manager",tokenCheck,AdminController.test);
router.patch('/approved-expense', tokenCheck, checkPermission("expense", "approve"), AdminController.UpdateExpense)
router.get('/user-expense', tokenCheck, checkPermission("expense", "view"), AdminController.userExpense)
router.post("/create-client", tokenCheck, AdminController.createClient);
router.post("/assign-meeting", tokenCheck, AdminController.assignMeeting);
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
router.patch("/assign-employee-shift", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.assignEmployeeShift);
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Holiday routes (add/get/get-by-id/update) now live in
// src/modules/holiday/holiday.routes.ts, mounted in server.ts — same URL
// paths, extracted out of this file as the first slice of the modular
// backend architecture (see src/modules/README or the architecture plan).
// FIX: quotation CRUD routes require quotation permissions.
router.post("/addquotation",       tokenCheck, checkPermission("quotation", "create"), AdminController.addQuotation2)
router.get("/getquotationlist",    tokenCheck, checkPermission("quotation", "view"),   AdminController.getQuotationPdfList2)
router.post('/updatequotation/:id',tokenCheck, checkPermission("quotation", "update"), AdminController.updateQuotation)
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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

router.get("/getalluser",tokenCheck,AdminController.GetAllUser)

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getusermeeting',tokenCheck,AdminController.getMeeting)
router.get("/dashboard-summary", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getDashboardSummary);
router.get("/top-performers", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.getTopPerformers);
 









export default router;
