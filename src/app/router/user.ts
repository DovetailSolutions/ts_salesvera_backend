import { Router } from "express";
const router = Router();
import * as Controller from "../controller/user";
import { tokenCheck } from "../../config/jwtVerify2";
import getUploadMiddleware from "../../config/fileUploads";
// const uploadPdf = getUploadMiddleware("pdf", 50, 1); // 50 MB max, 1 file

router.post("/register", Controller.Register);
router.post("/login", Controller.Login);
router.get("/getprofile", tokenCheck, Controller.GetProfile);
router.patch("/updateprofile", tokenCheck, Controller.UpdateProfile);

router.get("/mysaleperson", tokenCheck, Controller.MySalePerson);
router.post("/createmeeting", tokenCheck, Controller.CreateMeeting);
router.post("/endmeeting", tokenCheck, Controller.EndMeeting);
router.get("/getmeetinglist", tokenCheck, Controller.GetMeetingList);
router.post("/scheduledupdate", tokenCheck, Controller.scheduled);
router.post("/logout", tokenCheck, Controller.Logout);
router.get("/getctegory", tokenCheck, Controller.getCategory);
// Attendance Summary

router.post("/attendance/punch-in", tokenCheck, Controller.AttendancePunchIn);

router.post("/attendance/punch-out", tokenCheck, Controller.AttendancePunchOut);

router.get("/attendance/today", tokenCheck, Controller.getTodayAttendance);

router.get("/attendancelist", tokenCheck, Controller.AttendanceList);

router.post("/leave", tokenCheck, Controller.requestLeave);

export default router;
