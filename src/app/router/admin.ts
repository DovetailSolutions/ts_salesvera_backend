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
router.get('/getusermeeting',AdminController.getMeeting)
router.post("/addcategory", tokenCheck, AdminController.AddCategory);
router.get("/getcategory", tokenCheck, AdminController.getcategory);
router.get("/getcategoy/:id", tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload",tokenCheck,csv.array("csv"),AdminController.BulkUploads)
router.get("/get-attendance", tokenCheck, AdminController.getAttendance);
router.patch("/approved-leave",tokenCheck,AdminController.approveLeave);
router.get("/get-leave-list",tokenCheck,AdminController.leaveList)
router.get("/get-expense",tokenCheck,AdminController.GetExpense);
router.get("/admin-manager",tokenCheck,AdminController.test);
router.patch('/approved-expense', tokenCheck, AdminController.UpdateExpense)









// meeting apis 


export default router;
