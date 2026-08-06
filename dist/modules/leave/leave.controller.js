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
exports.updateLeave = exports.getLeaveById = exports.getLeave = exports.addLeave = exports.ownLeave = exports.userLeave = exports.cancelLeaveAndMarkPresent = exports.getTodayLeaveRequests = exports.leaveList = exports.getTeamLeaveBalances = exports.getEmployeeLeaveBalance = exports.assignLeaveBalance = exports.approveLeave = exports.createLeaveRequest = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const dateUtils_1 = require("../shared/dateUtils");
const LeaveService = __importStar(require("./leave.service"));
// ============================================================
// Leave controller — thin HTTP layer, extracted verbatim from admin.ts's
// approveLeave/assignLeaveBalance/getEmployeeLeaveBalance/
// getTeamLeaveBalances/leaveList/getTodayLeaveRequests/
// cancelLeaveAndMarkPresent/userLeave/ownLeave/addLeave/getLeave/
// getLeaveById/updateLeave.
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
const getPagination = (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
const createLeaveRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const leave = yield LeaveService.createLeaveRequest(Number(userData === null || userData === void 0 ? void 0 : userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Leave requested successfully", leave);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.createLeaveRequest = createLeaveRequest;
const approveLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const leave = yield LeaveService.approveLeave(Number(userData === null || userData === void 0 ? void 0 : userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Status updated", leave);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.approveLeave = approveLeave;
const assignLeaveBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.assignLeaveBalance(Number(userData === null || userData === void 0 ? void 0 : userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Leave balance assigned successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.assignLeaveBalance = assignLeaveBalance;
const getEmployeeLeaveBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { employeeId } = req.params;
        // FIX: was new Date().getFullYear() (OS-local getter) — not guaranteed
        // to equal the IST calendar year on the production host. Derived from
        // getISTDateString() instead so a request in the Dec 31/Jan 1 IST-vs-
        // UTC gap can't default to the wrong year's leave balance.
        const year = Number(req.query.year) || Number((0, dateUtils_1.getISTDateString)().slice(0, 4));
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.getEmployeeLeaveBalance(Number(userData === null || userData === void 0 ? void 0 : userData.userId), employeeId, year, callerCompanyId);
        (0, errorMessage_1.createSuccess)(res, "Leave balance fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getEmployeeLeaveBalance = getEmployeeLeaveBalance;
const getTeamLeaveBalances = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        // FIX: was new Date().getFullYear() (OS-local getter) — not guaranteed
        // to equal the IST calendar year on the production host. Derived from
        // getISTDateString() instead so a request in the Dec 31/Jan 1 IST-vs-
        // UTC gap can't default to the wrong year's leave balance.
        const year = Number(req.query.year) || Number((0, dateUtils_1.getISTDateString)().slice(0, 4));
        const { page, limit, offset } = getPagination(req);
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.getTeamLeaveBalances(Number(userData === null || userData === void 0 ? void 0 : userData.userId), year, page, limit, offset, callerCompanyId);
        (0, errorMessage_1.createSuccess)(res, "Team leave balances fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getTeamLeaveBalances = getTeamLeaveBalances;
const leaveList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { status } = req.query;
        const { page, limit, offset } = getPagination(req);
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.leaveList(Number(userData.userId), status, page, limit, offset, callerCompanyId);
        res.status(200).json({
            success: true,
            message: "Leaves fetched successfully",
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.leaveList = leaveList;
const getTodayLeaveRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.getTodayLeaveRequests(Number(userData.userId), callerCompanyId);
        res.status(200).json({
            success: true,
            message: "Today's leave requests fetched successfully",
            data: result,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getTodayLeaveRequests = getTodayLeaveRequests;
const cancelLeaveAndMarkPresent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.cancelLeaveAndMarkPresent(Number(userData.userId), callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Leave cancelled and attendance marked present", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.cancelLeaveAndMarkPresent = cancelLeaveAndMarkPresent;
const userLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId) {
            (0, errorMessage_1.badRequest)(res, "UserId is required", 400);
            return;
        }
        const userData = req.userData;
        const { page, limit, offset } = getPagination(req);
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield LeaveService.userLeave(Number(userData === null || userData === void 0 ? void 0 : userData.userId), userId, page, limit, offset, callerCompanyId);
        (0, errorMessage_1.createSuccess)(res, "User leave fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.userLeave = userLeave;
const ownLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { page, limit, offset } = getPagination(req);
        const result = yield LeaveService.ownLeave(Number(userData === null || userData === void 0 ? void 0 : userData.userId), page, limit, offset);
        if (result.isEmpty) {
            (0, errorMessage_1.badRequest)(res, "No leaves found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Leave fetched successfully", {
            leave: result.leave,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.ownLeave = ownLeave;
const addLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const leaves = yield LeaveService.addLeave(Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, "Leaves added successfully", leaves);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.addLeave = addLeave;
const getLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const result = yield LeaveService.getLeave(Number(userData.userId), userData.role, req.query);
        (0, errorMessage_1.createSuccess)(res, "Leaves fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getLeave = getLeave;
const getLeaveById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        const leave = yield LeaveService.getLeaveById(id, Number(userData.userId), userData.role);
        (0, errorMessage_1.createSuccess)(res, "Leave fetched successfully", leave);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getLeaveById = getLeaveById;
const updateLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        const leave = yield LeaveService.updateLeave(id, Number(userData.userId), userData.role, req.body);
        (0, errorMessage_1.createSuccess)(res, "Leave updated successfully", leave);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.updateLeave = updateLeave;
