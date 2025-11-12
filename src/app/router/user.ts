import { Router } from "express";
const router = Router();
import * as Controller from "../controller/user";
import { tokenCheck } from "../../config/jwtVerify2";
import getUploadMiddleware from "../../config/fileUploads";
const profile = getUploadMiddleware("image");
const meeting = getUploadMiddleware("image");
const expense = getUploadMiddleware("expense");
router.post("/register", Controller.Register);
router.post("/login", Controller.Login);
router.get("/getprofile", tokenCheck, Controller.GetProfile);
router.patch(
  "/updateprofile",
  tokenCheck,
  profile.single("profile"),
  Controller.UpdateProfile
);
router.get("/mysaleperson", tokenCheck, Controller.MySalePerson);

router.post(
  "/createmeeting",
  tokenCheck,
  meeting.array("image"),
  Controller.CreateMeeting
);
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
//Expense
router.post(
  "/expense",
  tokenCheck,
  expense.array("billImage"),
  Controller.CreateExpense
);
router.get("/refreshtoken",tokenCheck,Controller.ReFressToken);

export default router;
