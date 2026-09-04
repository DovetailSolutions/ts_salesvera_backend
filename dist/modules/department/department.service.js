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
const dbConnection_1 = require("../../config/dbConnection");
const department_repository_1 = require("./department.repository");
// A Department must always be attached to a Branch that actually exists —
// and, when a companyId is supplied, to a Branch that actually belongs to
// that company. Neither of these was ever checked: addDepartment/
// updateDepartment accepted any numeric branchId, so a stale/deleted/
// cross-company branchId (or one belonging to another tenant entirely)
// still returned "success" and persisted a Department row that could never
// resolve a real Branch. This looks up the branch once and returns it so
// the caller can also backfill companyId from it when the request omitted one.
const requireValidBranch = (branchId, companyId) => __awaiter(void 0, void 0, void 0, function* () {
    const branch = yield dbConnection_1.Branch.findByPk(Number(branchId));
    if (!branch)
        throw new serviceError_1.ServiceError("Branch not found");
    if (companyId && Number(branch.companyId) !== Number(companyId)) {
        throw new serviceError_1.ServiceError("Branch does not belong to the specified company", 403);
    }
    return branch;
});
// Same company-scoped check listDepartments already uses (hasCompanyAccess),
// applied here so updateDepartment/getDepartmentById stop relying on the
// unreliable per-row userId ownership stamp. Falls back to that legacy
// stamp only for rows with no companyId at all (created before companyId
// was reliably backfilled).
const assertDepartmentAccess = (department, userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (department.companyId) {
        const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(department.companyId), userId, role);
        if (!allowed)
            throw new serviceError_1.ServiceError("Department not found");
        return;
    }
    if (Number(department.userId) !== Number(userId))
        throw new serviceError_1.ServiceError("Department not found");
});
// ============================================================
// Department service — validation + orchestration. Byte-for-byte port of
// the previous addDepartment/updateDepartment/getDepartment/
// getDepartmentById controller bodies in admin.ts.
// ============================================================
const addDepartment = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
    // Validate the branch exists (and, if a companyId was given, that it's
    // actually this company's branch) BEFORE persisting — a Department row
    // must never be created against a dangling/foreign branchId. Backfill
    // companyId from the branch itself when the caller didn't send one, so
    // every Department ends up correctly tenant-scoped instead of null.
    const branch = yield requireValidBranch(branchId, companyId ? Number(companyId) : null);
    const resolvedCompanyId = companyId ? Number(companyId) : ((_a = branch.companyId) !== null && _a !== void 0 ? _a : null);
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
        companyId: resolvedCompanyId,
    });
});
exports.addDepartment = addDepartment;
const updateDepartment = (id, userId, role, input) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const department = yield (0, department_repository_1.findDepartmentById)(id);
    if (!department)
        throw new serviceError_1.ServiceError("Department not found");
    yield assertDepartmentAccess(department, userId, role);
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
    if (branchId !== undefined) {
        // Re-validate on every branch change — moving a department to a
        // different branch is exactly the case that previously let a dangling
        // or cross-company branchId slip in silently.
        yield requireValidBranch(branchId, (_a = d.companyId) !== null && _a !== void 0 ? _a : null);
        d.branchId = Number(branchId);
    }
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
const getDepartmentById = (id, userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    const department = yield (0, department_repository_1.findDepartmentById)(id);
    if (!department)
        throw new serviceError_1.ServiceError("Department not found");
    yield assertDepartmentAccess(department, userId, role);
    return department;
});
exports.getDepartmentById = getDepartmentById;
