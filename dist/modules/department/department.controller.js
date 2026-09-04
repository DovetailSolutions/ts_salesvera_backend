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
exports.getDepartmentById = exports.getDepartment = exports.updateDepartment = exports.addDepartment = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const DepartmentService = __importStar(require("./department.service"));
// ============================================================
// Department controller — thin HTTP layer, extracted verbatim from
// admin.ts's addDepartment/updateDepartment/getDepartment/getDepartmentById.
// ============================================================
const addDepartment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const department = yield DepartmentService.addDepartment(Number(userData.userId), req.body);
        return (0, errorMessage_1.createSuccess)(res, "Department added successfully", department);
    }
    catch (error) {
        if (error instanceof serviceError_1.ServiceError)
            return (0, errorMessage_1.badRequest)(res, error.message);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addDepartment = addDepartment;
const updateDepartment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const { id } = req.params || {};
        if (!id || isNaN(Number(id))) {
            return (0, errorMessage_1.badRequest)(res, "Valid department id is required");
        }
        const updated = yield DepartmentService.updateDepartment(Number(id), Number(userData.userId), userData.role, req.body);
        return (0, errorMessage_1.createSuccess)(res, "Department updated successfully", updated);
    }
    catch (error) {
        if (error instanceof serviceError_1.ServiceError)
            return (0, errorMessage_1.badRequest)(res, error.message);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateDepartment = updateDepartment;
const getDepartment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const result = yield DepartmentService.listDepartments({
            userId: Number(userData.userId),
            role: userData.role,
            page,
            limit,
            search: req.query.search || "",
            branchId: req.query.branchId,
            companyId: req.query.companyId,
        });
        return (0, errorMessage_1.createSuccess)(res, "Departments fetched successfully", result);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getDepartment = getDepartment;
const getDepartmentById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Department id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Department id must be a number");
        }
        const department = yield DepartmentService.getDepartmentById(Number(req.params.id), Number(userData.userId), userData.role);
        return (0, errorMessage_1.createSuccess)(res, "Department fetched successfully", department);
    }
    catch (error) {
        if (error instanceof serviceError_1.ServiceError)
            return (0, errorMessage_1.badRequest)(res, error.message);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getDepartmentById = getDepartmentById;
