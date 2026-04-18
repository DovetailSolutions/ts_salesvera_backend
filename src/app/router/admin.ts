import { Router } from "express";
const router = Router();
import * as AdminController from "../controller/admin";
import { tokenCheck } from "../../config/jwtVerify";
import getUploadMiddleware from "../../config/fileUploads";
const profile = getUploadMiddleware("image");
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
const csv = getUploadMiddleware("csv")


router.post("/register", AdminController.Register);
router.post("/login", AdminController.Login);
router.get("/getProfile", tokenCheck, AdminController.GetProfile);
router.patch("/updatepassword", tokenCheck, AdminController.UpdatePassword);
router.get("/mysaleperson", tokenCheck, AdminController.MySalePerson);
router.post('/assign-salesman',tokenCheck, AdminController.assignSalesman);
router.get("/getalluser",tokenCheck,AdminController.GetAllUser)
router.get('/getusermeeting',tokenCheck,AdminController.getMeeting)
router.post("/addcategory", tokenCheck, AdminController.AddCategory);
router.get("/getcategory", tokenCheck, AdminController.getcategory);
router.get("/getcategoy/:id", tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload",tokenCheck,csv.single("csv"),AdminController.BulkUploads)
router.get("/get-attendance", tokenCheck, AdminController.getAttendance);
router.patch("/approved-leave",tokenCheck,AdminController.approveLeave);
router.get("/get-leave-list",tokenCheck,AdminController.leaveList)
router.get("/get-expense",tokenCheck,AdminController.GetExpense);
router.get("/admin-manager",tokenCheck,AdminController.test);
router.patch('/approved-expense', tokenCheck, AdminController.UpdateExpense)
router.get("/user-attendance",tokenCheck,AdminController.userAttendance)
router.get('/user-leave',tokenCheck,AdminController.userLeave)
router.get('/user-expense',tokenCheck,AdminController.userExpense)
router.get("/attendance-book", tokenCheck, AdminController.AttendanceBook);
router.post("/create-client", tokenCheck, AdminController.createClient);
router.post("/assign-meeting", tokenCheck, AdminController.assignMeeting);
router.get("/getown-leave",tokenCheck,AdminController.ownLeave)
router.post("/add/quotation",AdminController.addQuotation);


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
router.get("/getquotationpdflist",tokenCheck,AdminController.getQuotationPdfList)
router.get("/downloadquotationpdf/:id",tokenCheck,AdminController.downloadQuotationPdf);
router.post("/addquotationpdf",tokenCheck,AdminController.addQuotationPdf)


router.get("/fuel-expense", tokenCheck, AdminController.getMeetingDistance);
router.get("/get-fuel-expense",tokenCheck,AdminController.getFuelExpense)

//>>>>>>>>>>>>>>>>>>>>>>>>add company >>>>>>>>>>>>>>>


router.post("/addcompany",tokenCheck,AdminController.addCompany);
router.get("/getcompany",tokenCheck,AdminController.getCompany);
router.get("/getcompany/:id",tokenCheck,AdminController.getCompanyById);
router.patch("/updatecompany/:id",tokenCheck,AdminController.updateCompany);
router.delete("/deletecompany/:id",tokenCheck,AdminController.deleteCompany);


//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post("/addbranch",tokenCheck,AdminController.addBranch);
router.get("/getbranch",tokenCheck,AdminController.getBranch);
router.get("/getbranch/:id",tokenCheck,AdminController.getBranchById);
// router.patch("/updatebranch/:id",tokenCheck,AdminController.updateBranch);
// router.delete("/deletebranch/:id",tokenCheck,AdminController.deleteBranch);


router.post("/addshift",tokenCheck,AdminController.addShift);
router.get("/getshift",tokenCheck,AdminController.getShift);
router.get("/getshift/:id",tokenCheck,AdminController.getShiftById);



//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post("/adddepartment",tokenCheck,AdminController.addDepartment);
router.get("/getdepartment",tokenCheck,AdminController.getDepartment);
router.get("/getdepartment/:id",tokenCheck,AdminController.getDepartmentById);
// router.patch("/updatedepartment/:id",tokenCheck,AdminController.updateDepartment);
// router.delete("/deletedepartment/:id",tokenCheck,AdminController.deleteDepartment);

//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post("/addholiday",tokenCheck,AdminController.addHoliday);
router.get("/getholiday",tokenCheck,AdminController.getHoliday);
router.get("/getholiday/:id",tokenCheck,AdminController.getHolidayById);
// router.patch("/updateholiday/:id",tokenCheck,AdminController.updateHoliday);
// router.delete("/deleteholiday/:id",tokenCheck,AdminController.deleteHoliday);



router.post("/addquotation",tokenCheck,AdminController.addQuotation2)
router.get("/getquotationlist",tokenCheck,AdminController.getQuotationPdfList2)
router.post('/updatequotation/:id',tokenCheck,AdminController.updateQuotation)


//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


router.post("/add-leave",tokenCheck, AdminController.addLeave);
router.get("/get-leave", tokenCheck, AdminController.getLeave);
router.get("/get-leave/:id", tokenCheck, AdminController.getLeaveById);
// router.patch("/update-leave/:id", tokenCheck, AdminController.updateLeave);
// router.delete("/delete-leave/:id", tokenCheck, AdminController.deleteLeave);


router.post("/add-bank",tokenCheck,AdminController.addCompanyBank);
// router.get("/get-bank",tokenCheck,AdminController.getBank);
// router.get("/get-bank/:id",tokenCheck,AdminController.getBankById);
// router.patch("/update-bank/:id",tokenCheck,AdminController.updateBank);
// router.delete("/delete-bank/:id",tokenCheck,AdminController.deleteBank);



router.get("/get-client",tokenCheck,AdminController.getClient);
router.post("/update-client/:id",tokenCheck,AdminController.updateClient);

router.post("/category/:id",tokenCheck,AdminController.CategoryStatus);
router.post("/sub-category/:id",tokenCheck,AdminController.SubCategoryStatus);


router.post("/addinvoice",tokenCheck,AdminController.addInvoice);
router.get("/getinvoice",tokenCheck,AdminController.getInvoice);
router.post("/updateinvoice/:id",tokenCheck,AdminController.updateInvoice);

router.get("/get-record-sale",tokenCheck,AdminController.getRecordSale);


router.post("/add-report",tokenCheck,AdminController.addReport);
router.get("/get-report",tokenCheck,AdminController.getReport);
router.get("/get-report-details", tokenCheck, AdminController.getReportById);
router.post("/update-report",tokenCheck,AdminController.updateReport);
// router.delete("/delete-report/:id",tokenCheck,AdminController.deleteReport);

 









export default router;
