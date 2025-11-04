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
const Controller = __importStar(require("../controller/user"));
const jwtVerify2_1 = require("../../config/jwtVerify2");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const profile = (0, fileUploads_1.default)("image");
const meeting = (0, fileUploads_1.default)("image");
const expense = (0, fileUploads_1.default)("expense");
router.post("/register", Controller.Register);
router.post("/login", Controller.Login);
router.get("/getprofile", jwtVerify2_1.tokenCheck, Controller.GetProfile);
router.patch("/updateprofile", jwtVerify2_1.tokenCheck, profile.single("profile"), Controller.UpdateProfile);
router.get("/mysaleperson", jwtVerify2_1.tokenCheck, Controller.MySalePerson);
router.post("/createmeeting", jwtVerify2_1.tokenCheck, meeting.array("image"), Controller.CreateMeeting);
router.post("/endmeeting", jwtVerify2_1.tokenCheck, Controller.EndMeeting);
router.get("/getmeetinglist", jwtVerify2_1.tokenCheck, Controller.GetMeetingList);
router.post("/scheduledupdate", jwtVerify2_1.tokenCheck, Controller.scheduled);
router.post("/logout", jwtVerify2_1.tokenCheck, Controller.Logout);
router.get("/getctegory", jwtVerify2_1.tokenCheck, Controller.getCategory);
// Attendance Summary
router.post("/attendance/punch-in", jwtVerify2_1.tokenCheck, Controller.AttendancePunchIn);
router.post("/attendance/punch-out", jwtVerify2_1.tokenCheck, Controller.AttendancePunchOut);
router.get("/attendance/today", jwtVerify2_1.tokenCheck, Controller.getTodayAttendance);
router.get("/attendancelist", jwtVerify2_1.tokenCheck, Controller.AttendanceList);
router.post("/leave", jwtVerify2_1.tokenCheck, Controller.requestLeave);
//Expense
router.post("/expense", jwtVerify2_1.tokenCheck, expense.array("billImage"), Controller.CreateExpense);
exports.default = router;
