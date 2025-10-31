import { Router } from "express";
const router = Router();
import * as AdminController from "../controller/admin";
import { tokenCheck } from "../../config/jwtVerify";
import getUploadMiddleware from "../../config/fileUploads";
// const uploadPdf = getUploadMiddleware("pdf", 50, 1); // 50 MB max, 1 file

router.post("/register", AdminController.Register);
router.post("/login", AdminController.Login);
router.get("/getProfile", tokenCheck, AdminController.GetProfile);
router.patch("/updatepassword", tokenCheck, AdminController.UpdatePassword);

router.post("/addcategory", tokenCheck, AdminController.AddCategory);
router.get("/getcategory", tokenCheck, AdminController.getcategory);
router.get("/getcategoy/:id", tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", tokenCheck, AdminController.DeleteCategory);

// meeting apis 


export default router;
