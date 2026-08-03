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
exports.getHolidayById = exports.listHolidays = exports.updateHoliday = exports.createHolidays = void 0;
const serviceError_1 = require("../shared/serviceError");
const companyAccess_1 = require("../shared/companyAccess");
const holiday_repository_1 = require("./holiday.repository");
const createHolidays = (userId, holidays, companyId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!Array.isArray(holidays) || holidays.length === 0) {
        throw new serviceError_1.ServiceError("holidays array is required");
    }
    const holidayData = [];
    for (const item of holidays) {
        const { holidayName, holidayDate, holidayType, branchId, description, adminId, managerId } = item;
        if (!holidayName || holidayName.trim().length < 2) {
            throw new serviceError_1.ServiceError("Holiday name is required");
        }
        if (!holidayDate || String(holidayDate).trim().length < 2) {
            throw new serviceError_1.ServiceError("Holiday date is required");
        }
        if (!holidayType || holidayType.trim().length < 2) {
            throw new serviceError_1.ServiceError("Holiday type is required");
        }
        if (!Array.isArray(branchId) || branchId.length === 0) {
            throw new serviceError_1.ServiceError("branchId must be a non-empty array");
        }
        for (const branch of branchId) {
            if (isNaN(Number(branch))) {
                throw new serviceError_1.ServiceError("Invalid branchId value");
            }
            holidayData.push({
                holidayName: String(holidayName),
                holidayDate,
                holidayType: String(holidayType),
                branchId: Number(branch),
                description: description || null,
                adminId: adminId ? Number(adminId) : null,
                managerId: managerId ? Number(managerId) : null,
                userId: Number(userId),
                companyId: companyId ? Number(companyId) : null,
            });
        }
    }
    return (0, holiday_repository_1.bulkCreateHolidays)(holidayData);
});
exports.createHolidays = createHolidays;
// Note: a Holiday row has a single branchId (createHolidays creates one row
// per selected branch), but the settings-page form represents "Applicable
// Branches" as an array per holiday entry (shared multi-select UI). If an
// array comes through here, only the first branch is applied to this
// existing row — changing which/how many branches a saved holiday applies
// to isn't supported via update; delete and re-add for that.
const updateHoliday = (id, userId, input) => __awaiter(void 0, void 0, void 0, function* () {
    const holiday = yield (0, holiday_repository_1.findHolidayOwnedBy)(id, userId);
    if (!holiday) {
        throw new serviceError_1.ServiceError("Holiday not found");
    }
    const { holidayName, holidayDate, holidayType, branchId, description } = input;
    const resolvedBranchId = Array.isArray(branchId) ? branchId[0] : branchId;
    if (resolvedBranchId !== undefined && isNaN(Number(resolvedBranchId))) {
        throw new serviceError_1.ServiceError("Invalid branchId value");
    }
    if (holidayName !== undefined)
        holiday.holidayName = holidayName;
    if (holidayDate !== undefined)
        holiday.holidayDate = holidayDate;
    if (holidayType !== undefined)
        holiday.holidayType = holidayType;
    if (resolvedBranchId !== undefined)
        holiday.branchId = Number(resolvedBranchId);
    if (description !== undefined)
        holiday.description = description;
    // companyId is intentionally not editable here.
    yield holiday.save();
    return holiday;
});
exports.updateHoliday = updateHoliday;
const listHolidays = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = Math.min(params.limit, 50);
    const offset = (params.page - 1) * limit;
    if (params.companyId) {
        const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(params.companyId), params.userId, params.role);
        if (!allowed)
            throw new serviceError_1.ServiceError("You do not have access to this company", 403);
    }
    const { count, rows } = yield (0, holiday_repository_1.findHolidays)({
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
exports.listHolidays = listHolidays;
const getHolidayById = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const holiday = yield (0, holiday_repository_1.findHolidayOwnedBy)(id, userId);
    if (!holiday) {
        throw new serviceError_1.ServiceError("Holiday not found");
    }
    return holiday;
});
exports.getHolidayById = getHolidayById;
