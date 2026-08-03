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
exports.getBranchById = exports.listBranches = exports.updateBranch = exports.addBranch = void 0;
const serviceError_1 = require("../shared/serviceError");
const companyAccess_1 = require("../shared/companyAccess");
const branch_repository_1 = require("./branch.repository");
const addBranch = (userId, input) => __awaiter(void 0, void 0, void 0, function* () {
    const { branchName, branchCode, branchCity, branchState, branchCountry, postalCode, addressLine1, addressLine2, branchEmail, branchPhone, latitude, longitude, geoRadius, adminId, managerId, companyId, } = input;
    if (!branchName || branchName.trim().length < 2)
        throw new serviceError_1.ServiceError("Branch name is required (min 2 chars)");
    if (!branchCode || branchCode.trim().length < 2)
        throw new serviceError_1.ServiceError("Branch code is required");
    if (!branchCity)
        throw new serviceError_1.ServiceError("Branch city is required");
    if (!branchState)
        throw new serviceError_1.ServiceError("Branch state is required");
    if (!branchCountry)
        throw new serviceError_1.ServiceError("Branch country is required");
    if (!postalCode || postalCode.length < 4)
        throw new serviceError_1.ServiceError("Valid postal code is required");
    if (!addressLine1)
        throw new serviceError_1.ServiceError("Address Line 1 is required");
    if (latitude === undefined || isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90) {
        throw new serviceError_1.ServiceError("Latitude must be between -90 and 90");
    }
    if (longitude === undefined || isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180) {
        throw new serviceError_1.ServiceError("Longitude must be between -180 and 180");
    }
    if (geoRadius === undefined || isNaN(Number(geoRadius)) || Number(geoRadius) <= 0) {
        throw new serviceError_1.ServiceError("Geo radius must be a positive number");
    }
    if (adminId && isNaN(Number(adminId)))
        throw new serviceError_1.ServiceError("adminId must be a number");
    if (managerId && isNaN(Number(managerId)))
        throw new serviceError_1.ServiceError("managerId must be a number");
    // companyId is required — the registration wizard's Step2 previously
    // never sent it at all, so every branch created during onboarding ended
    // up orphaned from its company, silently breaking geofencing/shift/
    // department linkage downstream.
    if (!companyId || isNaN(Number(companyId)))
        throw new serviceError_1.ServiceError("Valid companyId is required");
    return (0, branch_repository_1.createBranch)({
        branchName,
        branchCode,
        branchCity,
        branchState,
        branchCountry,
        postalCode,
        addressLine1,
        addressLine2: addressLine2 || null,
        branchEmail,
        branchPhone,
        latitude: Number(latitude),
        longitude: Number(longitude),
        geoRadius: Number(geoRadius),
        adminId: adminId ? Number(adminId) : null,
        managerId: managerId ? Number(managerId) : null,
        userId,
        companyId: Number(companyId),
    });
});
exports.addBranch = addBranch;
const updateBranch = (id, userId, input) => __awaiter(void 0, void 0, void 0, function* () {
    const branch = yield (0, branch_repository_1.findBranchOwnedBy)(id, userId);
    if (!branch)
        throw new serviceError_1.ServiceError("Branch not found");
    const { branchName, branchCode, branchCity, branchState, branchCountry, postalCode, addressLine1, addressLine2, branchEmail, branchPhone, latitude, longitude, geoRadius, adminId, managerId, } = input;
    if (latitude !== undefined && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
        throw new serviceError_1.ServiceError("Latitude must be between -90 and 90");
    }
    if (longitude !== undefined && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
        throw new serviceError_1.ServiceError("Longitude must be between -180 and 180");
    }
    if (geoRadius !== undefined && (isNaN(Number(geoRadius)) || Number(geoRadius) <= 0)) {
        throw new serviceError_1.ServiceError("Geo radius must be a positive number");
    }
    const b = branch;
    if (branchName !== undefined)
        b.branchName = branchName;
    if (branchCode !== undefined)
        b.branchCode = branchCode;
    if (branchCity !== undefined)
        b.branchCity = branchCity;
    if (branchState !== undefined)
        b.branchState = branchState;
    if (branchCountry !== undefined)
        b.branchCountry = branchCountry;
    if (postalCode !== undefined)
        b.postalCode = postalCode;
    if (addressLine1 !== undefined)
        b.addressLine1 = addressLine1;
    if (addressLine2 !== undefined)
        b.addressLine2 = addressLine2;
    if (branchEmail !== undefined)
        b.branchEmail = branchEmail;
    if (branchPhone !== undefined)
        b.branchPhone = branchPhone;
    if (latitude !== undefined)
        b.latitude = Number(latitude);
    if (longitude !== undefined)
        b.longitude = Number(longitude);
    if (geoRadius !== undefined)
        b.geoRadius = Number(geoRadius);
    if (adminId !== undefined)
        b.adminId = adminId || null;
    if (managerId !== undefined)
        b.managerId = managerId || null;
    // companyId is intentionally not editable here — re-parenting a branch to
    // a different company is not a supported operation from this form.
    yield branch.save();
    return branch;
});
exports.updateBranch = updateBranch;
const listBranches = (params) => __awaiter(void 0, void 0, void 0, function* () {
    if (params.companyId) {
        const allowed = yield (0, companyAccess_1.hasCompanyAccess)(Number(params.companyId), params.userId, params.role);
        if (!allowed)
            throw new serviceError_1.ServiceError("You do not have access to this company", 403);
    }
    const { count, rows } = yield (0, branch_repository_1.findBranches)({
        userId: params.userId,
        companyId: params.companyId,
        search: params.search,
        limit: params.limit,
        offset: (params.page - 1) * params.limit,
    });
    return {
        total: count,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(count / params.limit),
        data: rows,
    };
});
exports.listBranches = listBranches;
const getBranchById = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const branch = yield (0, branch_repository_1.findBranchOwnedBy)(id, userId);
    if (!branch)
        throw new serviceError_1.ServiceError("Branch not found");
    return branch;
});
exports.getBranchById = getBranchById;
