"use strict";
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
exports.getDepartmentById = exports.listDepartments = exports.updateDepartment = exports.addDepartment = void 0;
const serviceError_1 = require("../shared/serviceError");
const companyAccess_1 = require("../shared/companyAccess");
const department_repository_1 = require("./department.repository");
// ============================================================
// Department service — validation + orchestration. Byte-for-byte port of
// the previous addDepartment/updateDepartment/getDepartment/
// getDepartmentById controller bodies in admin.ts.
// ============================================================
const addDepartment = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { deptName, deptCode, deptHead, branchId, shiftId, maxHeadcount, halfSaturday, workingDays, customWorkingDays, adminId, managerId, companyId, } = body;
    if (!deptName || deptName.trim().length < 2)
        throw new serviceError_1.ServiceError("Department name is required");
    if (!deptCode || deptCode.trim().length < 2)
        throw new serviceError_1.ServiceError("Department code is required");
    if (!deptHead || deptHead.trim().length < 2)
        throw new serviceError_1.ServiceError("Department head is required");
    if (!branchId || isNaN(Number(branchId)))
        throw new serviceError_1.ServiceError("Valid branchId is required");
    // shiftId is optional — Step4.jsx's UI explicitly offers "Inherit / No
    // Default" as a valid choice (no shift assigned).
    if (shiftId !== undefined && shiftId !== null && shiftId !== "" && isNaN(Number(shiftId))) {
        throw new serviceError_1.ServiceError("shiftId must be a number");
    }
    if (!maxHeadcount || isNaN(Number(maxHeadcount)))
        throw new serviceError_1.ServiceError("Valid maxHeadcount is required");
    return (0, department_repository_1.createDepartment)({
        deptName,
        deptCode,
        deptHead,
        branchId,
        shiftId: shiftId || null,
        maxHeadcount,
        halfSaturday,
        workingDays: Array.isArray(workingDays) ? workingDays : null,
        customWorkingDays: !!customWorkingDays,
        adminId,
        managerId,
        userId,
        companyId: companyId || null,
    });
});
exports.addDepartment = addDepartment;
const updateDepartment = (id, userId, input) => __awaiter(void 0, void 0, void 0, function* () {
    const department = yield (0, department_repository_1.findDepartmentOwnedBy)(id, userId);
    if (!department)
        throw new serviceError_1.ServiceError("Department not found");
    const { deptName, deptCode, deptHead, branchId, shiftId, maxHeadcount, halfSaturday, workingDays, customWorkingDays, } = input;
    if (shiftId !== undefined && shiftId !== null && shiftId !== "" && isNaN(Number(shiftId))) {
        throw new serviceError_1.ServiceError("shiftId must be a number");
    }
    const d = department;
    if (deptName !== undefined)
        d.deptName = deptName;
    if (deptCode !== undefined)
        d.deptCode = deptCode;
    if (deptHead !== undefined)
        d.deptHead = deptHead;
    if (branchId !== undefined)
        d.branchId = Number(branchId);
    if (shiftId !== undefined)
        d.shiftId = shiftId || null;
    if (maxHeadcount !== undefined)
        d.maxHeadcount = Number(maxHeadcount);
    if (halfSaturday !== undefined)
        d.halfSaturday = !!halfSaturday;
    if (workingDays !== undefined)
        d.workingDays = Array.isArray(workingDays) ? workingDays : null;
    if (customWorkingDays !== undefined)
        d.customWorkingDays = !!customWorkingDays;
    // companyId is intentionally not editable here.
    yield department.save();
    return department;
});
exports.updateDepartment = updateDepartment;
const listDepartments = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = Math.min(params.limit, 50);
    const offset = (params.page - 1) * limit;
    if (params.companyId) {
        const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(params.companyId), params.userId, params.role);
        if (!allowed)
            throw new serviceError_1.ServiceError("You do not have access to this company", 403);
    }
    const { count, rows } = yield (0, department_repository_1.findDepartments)({
        userId: params.userId,
        search: params.search,
        branchId: params.branchId,
        companyId: params.companyId,
        limit,
        offset,
    });
    return {
        total: count,
        page: params.page,
        limit,
        totalPages: Math.ceil(count / limit),
        data: rows,
    };
});
exports.listDepartments = listDepartments;
const getDepartmentById = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const department = yield (0, department_repository_1.findDepartmentOwnedBy)(id, userId);
    if (!department)
        throw new serviceError_1.ServiceError("Department not found");
    return department;
});
exports.getDepartmentById = getDepartmentById;
