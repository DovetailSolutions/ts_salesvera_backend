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
exports.getAllocations = exports.bulkAssignShift = exports.bulkAssignBranches = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const AllocationService = __importStar(require("./allocation.service"));
// ============================================================
// Allocation controller — thin HTTP layer over allocation.service.
// Mounted on /admin in server.ts.
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
const bulkAssignBranches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield AllocationService.bulkAssignBranches(Number(userData === null || userData === void 0 ? void 0 : userData.userId), userData === null || userData === void 0 ? void 0 : userData.role, callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Branches allocated successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.bulkAssignBranches = bulkAssignBranches;
const bulkAssignShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield AllocationService.bulkAssignShift(Number(userData === null || userData === void 0 ? void 0 : userData.userId), userData === null || userData === void 0 ? void 0 : userData.role, callerCompanyId, req.body);
        (0, errorMessage_1.createSuccess)(res, "Shift allocated successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.bulkAssignShift = bulkAssignShift;
// GET /admin/allocations?userIds=1,2,3 — current branch(es)/shift for one or
// more users in a single round trip. Accepts either a comma-separated
// string (the common query-param shape) or repeated userIds[] params.
const getAllocations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const raw = req.query.userIds;
        const userIds = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : raw;
        const result = yield AllocationService.getAllocations(Number(userData === null || userData === void 0 ? void 0 : userData.userId), userData === null || userData === void 0 ? void 0 : userData.role, callerCompanyId, userIds);
        (0, errorMessage_1.createSuccess)(res, "Allocations fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getAllocations = getAllocations;
