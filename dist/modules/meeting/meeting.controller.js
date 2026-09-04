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
exports.getNewClientsDashboardDetails = exports.getMeetingDashboardDetails = exports.getMeetingDashboard = exports.rescheduleMeeting = exports.scheduleMeeting = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const MeetingService = __importStar(require("./meeting.service"));
const handleServiceError = (res, error) => {
    if (error instanceof serviceError_1.ServiceError) {
        if (error.status === 403)
            return (0, errorMessage_1.forbidden)(res, error.message);
        return (0, errorMessage_1.badRequest)(res, error.message);
    }
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return (0, errorMessage_1.badRequest)(res, errorMessage);
};
const scheduleMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { targetUserId, meetingUserId, meetingPurpose, categoryId, subCategoryId, scheduledTime } = req.body || {};
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const meeting = yield MeetingService.scheduleMeeting(Number(userData.userId), userData.role, callerCompanyId, {
            targetUserId: Number(targetUserId),
            meetingUserId: Number(meetingUserId),
            meetingPurpose,
            categoryId: categoryId ? Number(categoryId) : null,
            subCategoryId: subCategoryId ? Number(subCategoryId) : null,
            scheduledTime,
        });
        (0, errorMessage_1.createSuccess)(res, "Meeting scheduled successfully", meeting);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.scheduleMeeting = scheduleMeeting;
const rescheduleMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { scheduledTime } = req.body || {};
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const meeting = yield MeetingService.rescheduleMeeting(Number(userData.userId), userData.role, callerCompanyId, Number(req.params.id), scheduledTime);
        (0, errorMessage_1.createSuccess)(res, "Meeting rescheduled successfully", meeting);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.rescheduleMeeting = rescheduleMeeting;
const getMeetingDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const dashboard = yield MeetingService.getMeetingDashboard(Number(userData.userId), userData.role, callerCompanyId);
        (0, errorMessage_1.createSuccess)(res, "Meeting dashboard fetched successfully", dashboard);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getMeetingDashboard = getMeetingDashboard;
const getMeetingDashboardDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const type = String(req.query.type || "total");
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);
        const userId = req.query.userId ? Number(req.query.userId) : undefined;
        const result = yield MeetingService.getMeetingDashboardDetails(Number(userData.userId), userData.role, callerCompanyId, type, page, limit, userId);
        res.status(200).json({
            success: true,
            message: "Meeting dashboard details fetched successfully",
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getMeetingDashboardDetails = getMeetingDashboardDetails;
const getNewClientsDashboardDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);
        const result = yield MeetingService.getNewClientsDetails(Number(userData.userId), userData.role, callerCompanyId, page, limit);
        res.status(200).json({
            success: true,
            message: "New clients fetched successfully",
            data: result.data,
            pagination: result.pagination,
        });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getNewClientsDashboardDetails = getNewClientsDashboardDetails;
