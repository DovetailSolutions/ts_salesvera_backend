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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceList = exports.getTodayAttendance = exports.AttendancePunchOut = exports.AttendancePunchIn = exports.bulkMarkAttendance = exports.exportAttendanceReport = exports.AttendanceBook = exports.userAttendance = exports.markAttendancePresent = exports.getAttendance = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const Middleware = __importStar(require("../../app/middlewear/comman"));
const dbConnection_1 = require("../../config/dbConnection");
const AttendanceService = __importStar(require("./attendance.service"));
// ============================================================
// Attendance controller — thin HTTP layer, extracted verbatim from
// admin.ts's getAttendance/markAttendancePresent/bulkMarkAttendance/
// userAttendance/AttendanceBook and user.ts's AttendancePunchIn/
// AttendancePunchOut/getTodayAttendance/AttendanceList.
// ============================================================
const handleServiceError = (res, error) => {
    if (error instanceof serviceError_1.ServiceError) {
        if (error.status === 403)
            return (0, errorMessage_1.forbidden)(res, error.message);
        return (0, errorMessage_1.badRequest)(res, error.message);
    }
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return (0, errorMessage_1.badRequest)(res, errorMessage);
};
// ---- Admin/team-scoped ----
const getAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield AttendanceService.getAttendance(Number(userData.userId), callerCompanyId, req.query);
        res.status(200).json({
            success: true,
            message: "Attendance fetched successfully",
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getAttendance = getAttendance;
const markAttendancePresent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;
        const record = yield AttendanceService.markAttendancePresent(Number(userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Attendance updated", record);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.markAttendancePresent = markAttendancePresent;
const userAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId) {
            (0, errorMessage_1.badRequest)(res, "UserId is required", 400);
            return;
        }
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield AttendanceService.userAttendance(Number(userData.userId), callerCompanyId, userId, req.query);
        (0, errorMessage_1.createSuccess)(res, "User attendance fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.userAttendance = userAttendance;
const AttendanceBook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield AttendanceService.attendanceBook(Number(userData.userId), callerCompanyId, req.query);
        res.status(200).json({
            success: true,
            message: "Attendance loaded",
            data: result,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.AttendanceBook = AttendanceBook;
const exportAttendanceReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const { buffer, filename } = yield AttendanceService.exportAttendanceReportExcel(Number(userData.userId), callerCompanyId, req.query);
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename=${filename}`,
        });
        res.send(buffer);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.exportAttendanceReport = exportAttendanceReport;
const bulkMarkAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const result = yield AttendanceService.bulkMarkAttendance(Number(userData.userId), userData.companyId ? Number(userData.companyId) : undefined, req.file, req.body);
        (0, errorMessage_1.createSuccess)(res, result.applied === 0 ? "No valid attendance rows to apply" : "Bulk attendance applied successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.bulkMarkAttendance = bulkMarkAttendance;
// ---- Self-service (punch in/out, today, list) ----
const AttendancePunchIn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const record = yield AttendanceService.attendancePunchIn(Number(userData === null || userData === void 0 ? void 0 : userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Punch-in recorded successfully", record);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.AttendancePunchIn = AttendancePunchIn;
const AttendancePunchOut = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const record = yield AttendanceService.attendancePunchOut(Number(userData === null || userData === void 0 ? void 0 : userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Punch-out recorded successfully", record);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.AttendancePunchOut = AttendancePunchOut;
const getTodayAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const record = yield AttendanceService.getTodayAttendance(Number(userData === null || userData === void 0 ? void 0 : userData.userId));
        (0, errorMessage_1.createSuccess)(res, "Today attendance fetched successfully", record);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getTodayAttendance = getTodayAttendance;
const AttendanceList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const data = req.query;
        const { data: attendanceRows, pagination } = yield Middleware.withuserlogin(dbConnection_1.Attendance, finalUserId, data);
        res.status(200).json({
            success: true,
            message: "Attendance list fetched successfully",
            data: attendanceRows,
            pagination,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.AttendanceList = AttendanceList;
