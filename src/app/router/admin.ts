import { Router } from "express";
const router = Router();
import * as AdminController from "../controller/admin";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import getUploadMiddleware from "../../config/fileUploads";
const profile = getUploadMiddleware("image");
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
const csv = getUploadMiddleware("csv")


router.post("/register", AdminController.Register);
router.post("/login", AdminController.Login);
router.get("/getProfile", tokenCheck, AdminController.GetProfile);
router.patch("/updateProfile", tokenCheck, profile.single("profile"), AdminController.UpdateProfile);
router.patch("/updatepassword", tokenCheck, AdminController.UpdatePassword);
router.get("/mysaleperson", tokenCheck, AdminController.MySalePerson);
router.post('/assign-salesman',tokenCheck, AdminController.assignSalesman);
router.get("/getalluser", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), AdminController.GetAllUser)
router.get('/getusermeeting',tokenCheck,AdminController.getMeeting)
router.post("/addcategory", tokenCheck, AdminController.AddCategory);
router.get("/getcategory", tokenCheck, AdminController.getcategory);
router.get("/getcategory-with-subcategories", tokenCheck, AdminController.getCategoryWithSubCategories);
router.get("/getcategoy/:id", tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload",tokenCheck,csv.single("csv"),AdminController.BulkUploads)
// FIX: attendance view routes require attendance:view permission.
router.get("/get-attendance", tokenCheck, checkPermission("attendance", "view"), AdminController.getAttendance);
// FIX: approve/reject requires leave:approve; listing all leave requests requires leave:view.
router.patch("/approved-leave", tokenCheck, checkPermission("leave", "approve"), AdminController.approveLeave);
router.get("/get-leave-list", tokenCheck, checkPermission("leave", "view"), AdminController.leaveList)
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
router.delete("/deletecompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), AdminController.deleteCompany);
router.get("/getowncompany",  tokenCheck, AdminController.getOwnCompany);


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
// router.patch("/update-leave/:id", tokenCheck, AdminController.updateLeave);
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
router.post("/addinvoice",         tokenCheck, checkPermission("invoice", "create"), AdminController.addInvoice);
router.get("/getinvoice",          tokenCheck, checkPermission("invoice", "view"),   AdminController.getInvoice);
router.post("/updateinvoice/:id",  tokenCheck, checkPermission("invoice", "update"), AdminController.updateInvoice);

router.get("/get-record-sale",tokenCheck,AdminController.getRecordSale);


// FIX: report routes now require explicit permissions.
//      Generating/updating a report requires report:export; reading requires report:view.
router.post("/add-report",        tokenCheck, checkPermission("report", "export"), AdminController.addReport);
router.get("/get-report",         tokenCheck, checkPermission("report", "view"),   AdminController.getReport);
router.get("/get-report-details", tokenCheck, checkPermission("report", "view"),   AdminController.getReportDetails);
router.post("/update-report",     tokenCheck, checkPermission("report", "export"), AdminController.updateReport);
// router.delete("/delete-report/:id",tokenCheck,AdminController.deleteReport);


router.patch("/assign-admin/:id", tokenCheck, AdminController.assignAdmin);

 









export default router;
