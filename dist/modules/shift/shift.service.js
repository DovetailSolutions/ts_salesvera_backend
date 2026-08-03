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
exports.getShiftById = exports.listShifts = exports.updateShift = exports.addShift = void 0;
const serviceError_1 = require("../shared/serviceError");
const companyAccess_1 = require("../shared/companyAccess");
const shift_repository_1 = require("./shift.repository");
// ============================================================
// Shift service — validation + orchestration. Byte-for-byte port of the
// previous addShift/updateShift/getShift/getShiftById controller bodies
// (and their two module-local helpers) in admin.ts.
// ============================================================
const validateShiftItem = (s) => {
    if (!(s === null || s === void 0 ? void 0 : s.shiftName) || String(s.shiftName).trim().length < 2)
        return "Shift name is required";
    if (!(s === null || s === void 0 ? void 0 : s.shiftCode) || String(s.shiftCode).trim().length < 2)
        return "Shift code is required";
    if (!(s === null || s === void 0 ? void 0 : s.startTime) || !(s === null || s === void 0 ? void 0 : s.endTime))
        return "Start time and end time are required";
    if (!/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime))
        return "Time must be in HH:mm format";
    if (s.breakMinutes !== undefined && isNaN(Number(s.breakMinutes)))
        return "Break minutes must be a number";
    if (s.workingHours !== undefined && isNaN(Number(s.workingHours)))
        return "Working hours must be a number";
    if (s.lateMarkAfter !== undefined && isNaN(Number(s.lateMarkAfter)))
        return "lateMarkAfter must be a number";
    if (s.halfDayAfter !== undefined && isNaN(Number(s.halfDayAfter)))
        return "halfDayAfter must be a number";
    return null;
};
const buildShiftCreateAttrs = (s, branchId, companyId, ownerUserId) => ({
    shiftName: s.shiftName,
    shiftCode: s.shiftCode,
    startTime: s.startTime,
    endTime: s.endTime,
    fullDayHours: s.fullDayHours,
    nightShift: !!s.nightShift,
    breakMinutes: s.breakMinutes !== undefined ? Number(s.breakMinutes) : 0,
    workingHours: s.workingHours !== undefined ? Number(s.workingHours) : 8,
    lateMarkAfter: s.lateMarkAfter !== undefined ? Number(s.lateMarkAfter) : 0,
    halfDayAfter: s.halfDayAfter !== undefined ? Number(s.halfDayAfter) : 0,
    branchId,
    companyId,
    userId: ownerUserId,
});
const addShift = (userId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const { shifts, branchId, companyId, createdBy, 
    // Company-wide attendance policy — collected in the same wizard step
    // (Step3.jsx) as shifts and sent bundled in this same request by the
    // registration wizard. Wire names differ slightly from the Company DB
    // columns (workingDays -> companyWorkingDays, alternateSaturday -> altSaturday).
    workingDays, halfSaturday, alternateSaturday, officeLocationRequired, geoFencingRequired, overtimeAllowed, lateMarkAfter: companyLateMarkAfter, autoHalfDayAfter: companyAutoHalfDayAfter, } = body;
    if (!branchId || isNaN(Number(branchId)))
        throw new serviceError_1.ServiceError("Valid branchId is required");
    if (!companyId || isNaN(Number(companyId)))
        throw new serviceError_1.ServiceError("Valid companyId is required");
    const ownerUserId = createdBy && !isNaN(Number(createdBy)) ? Number(createdBy) : Number(userId);
    // Duplicate shiftCode is intentionally allowed (see constraintsToDrop in
    // dbConnection.ts — the DB unique constraint was removed on request).
    // Batched shape: { shifts: [...], companyId, branchId, ... } — used by the
    // registration wizard (saveStep3) to create several shifts at once.
    let createdShifts;
    if (Array.isArray(shifts)) {
        if (shifts.length === 0)
            throw new serviceError_1.ServiceError("At least one shift is required");
        for (const s of shifts) {
            const err = validateShiftItem(s);
            if (err)
                throw new serviceError_1.ServiceError(err);
        }
        createdShifts = yield Promise.all(shifts.map((s) => (0, shift_repository_1.createShift)(buildShiftCreateAttrs(s, Number(branchId), Number(companyId), ownerUserId))));
    }
    else {
        // Legacy single-shift shape: { shiftName, shiftCode, ..., companyId,
        // branchId } — still used by AdminSettings.jsx / CompanyDetailEditor.jsx
        // (one addShift call per shift row).
        const err = validateShiftItem(body);
        if (err)
            throw new serviceError_1.ServiceError(err);
        const shift = yield (0, shift_repository_1.createShift)(buildShiftCreateAttrs(body, Number(branchId), Number(companyId), ownerUserId));
        createdShifts = [shift];
    }
    // Only touches fields that were actually sent — callers that don't send
    // any attendance-policy fields (the legacy single-shift call sites, which
    // save company policy via updateCompany separately) leave the company row
    // untouched here.
    const hasCompanySettings = workingDays !== undefined || halfSaturday !== undefined || alternateSaturday !== undefined ||
        officeLocationRequired !== undefined || geoFencingRequired !== undefined ||
        overtimeAllowed !== undefined || companyLateMarkAfter !== undefined || companyAutoHalfDayAfter !== undefined;
    if (hasCompanySettings) {
        if (companyLateMarkAfter !== undefined && isNaN(Number(companyLateMarkAfter))) {
            throw new serviceError_1.ServiceError("lateMarkAfter must be a number");
        }
        if (companyAutoHalfDayAfter !== undefined && isNaN(Number(companyAutoHalfDayAfter))) {
            throw new serviceError_1.ServiceError("autoHalfDayAfter must be a number");
        }
        const company = yield (0, shift_repository_1.findCompanyById)(Number(companyId));
        if (company) {
            const updates = {};
            if (workingDays !== undefined)
                updates.companyWorkingDays = Array.isArray(workingDays) ? workingDays : null;
            if (halfSaturday !== undefined)
                updates.halfSaturday = Boolean(halfSaturday);
            if (alternateSaturday !== undefined)
                updates.altSaturday = Boolean(alternateSaturday);
            if (officeLocationRequired !== undefined)
                updates.officeLocationRequired = Boolean(officeLocationRequired);
            if (geoFencingRequired !== undefined)
                updates.geoFencingRequired = Boolean(geoFencingRequired);
            if (overtimeAllowed !== undefined)
                updates.overtimeAllowed = Boolean(overtimeAllowed);
            if (companyLateMarkAfter !== undefined)
                updates.lateMarkAfter = Number(companyLateMarkAfter);
            if (companyAutoHalfDayAfter !== undefined)
                updates.autoHalfDayAfter = Number(companyAutoHalfDayAfter);
            yield company.update(updates);
        }
    }
    return Array.isArray(shifts) ? createdShifts : createdShifts[0];
});
exports.addShift = addShift;
const updateShift = (id, userId, input) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield (0, shift_repository_1.findShiftOwnedBy)(id, userId);
    if (!shift)
        throw new serviceError_1.ServiceError("Shift not found");
    const { shiftName, shiftCode, startTime, endTime, fullDayHours, nightShift, breakMinutes, workingHours, lateMarkAfter, halfDayAfter, branchId, } = input;
    if (startTime !== undefined && !/^\d{2}:\d{2}$/.test(startTime)) {
        throw new serviceError_1.ServiceError("startTime must be in HH:mm format");
    }
    if (endTime !== undefined && !/^\d{2}:\d{2}$/.test(endTime)) {
        throw new serviceError_1.ServiceError("endTime must be in HH:mm format");
    }
    const s = shift;
    if (shiftName !== undefined)
        s.shiftName = shiftName;
    if (shiftCode !== undefined)
        s.shiftCode = shiftCode;
    if (startTime !== undefined)
        s.startTime = startTime;
    if (endTime !== undefined)
        s.endTime = endTime;
    if (fullDayHours !== undefined)
        s.fullDayHours = Number(fullDayHours);
    if (nightShift !== undefined)
        s.nightShift = !!nightShift;
    if (breakMinutes !== undefined)
        s.breakMinutes = Number(breakMinutes);
    if (workingHours !== undefined)
        s.workingHours = Number(workingHours);
    if (lateMarkAfter !== undefined)
        s.lateMarkAfter = Number(lateMarkAfter);
    if (halfDayAfter !== undefined)
        s.halfDayAfter = Number(halfDayAfter);
    if (branchId !== undefined)
        s.branchId = Number(branchId);
    // companyId is intentionally not editable here.
    yield shift.save();
    return shift;
});
exports.updateShift = updateShift;
const listShifts = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = Math.min(params.limit, 50);
    const offset = (params.page - 1) * limit;
    if (params.companyId) {
        const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(params.companyId), params.userId, params.role);
        if (!allowed)
            throw new serviceError_1.ServiceError("You do not have access to this company", 403);
    }
    const { count, rows } = yield (0, shift_repository_1.findShifts)({
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
exports.listShifts = listShifts;
const getShiftById = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield (0, shift_repository_1.findShiftOwnedBy)(id, userId);
    if (!shift)
        throw new serviceError_1.ServiceError("Shift not found");
    return shift;
});
exports.getShiftById = getShiftById;
