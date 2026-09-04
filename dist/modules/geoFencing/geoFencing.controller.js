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
exports.reverseGeocode = exports.toggleRequirementForUser = exports.geocodeAddress = exports.saveForUser = exports.getForUser = exports.getMy = void 0;
const serviceError_1 = require("../shared/serviceError");
const GeoFencingService = __importStar(require("./geoFencing.service"));
const handleServiceError = (res, error) => {
    if (error instanceof serviceError_1.ServiceError) {
        return res.status(error.status).json({ success: false, message: error.message });
    }
    const message = error instanceof Error ? error.message : "Something went wrong";
    return res.status(400).json({ success: false, message });
};
const getMy = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const config = yield GeoFencingService.getMyConfig(Number(userData.userId));
        res.status(200).json({ success: true, message: "Geo-fencing config fetched", data: config });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getMy = getMy;
const getForUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield GeoFencingService.getConfigForUser(Number(userData.userId), userData.role, callerCompanyId, Number(req.params.userId));
        res.status(200).json({ success: true, message: "Geo-fencing config fetched", data: result });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getForUser = getForUser;
const saveForUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const result = yield GeoFencingService.saveConfigForUser(Number(userData.userId), userData.role, callerCompanyId, Number(req.params.userId), req.body);
        res.status(200).json({ success: true, message: "Geo-fencing config saved", data: result });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.saveForUser = saveForUser;
const geocodeAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const address = String(req.query.address || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.address) || "");
        const result = yield GeoFencingService.geocodeAddress(address);
        res.status(200).json({ success: true, message: "Address geocoded successfully", data: result });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.geocodeAddress = geocodeAddress;
const toggleRequirementForUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const callerCompanyId = (userData === null || userData === void 0 ? void 0 : userData.companyId) ? Number(userData.companyId) : null;
        const { isGeofenceRequired } = req.body || {};
        const result = yield GeoFencingService.saveConfigForUser(Number(userData.userId), userData.role, callerCompanyId, Number(req.params.userId), { isGeofenceRequired, enabled: isGeofenceRequired });
        res.status(200).json({ success: true, message: `Geofence requirement updated to ${isGeofenceRequired ? "Required" : "Not Required (Exempted)"}`, data: result });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.toggleRequirementForUser = toggleRequirementForUser;
const reverseGeocode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const lat = Number(req.query.lat || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.lat));
        const lng = Number(req.query.lng || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.lng));
        const result = yield GeoFencingService.reverseGeocode(lat, lng);
        res.status(200).json({ success: true, message: "Reverse geocoded successfully", data: result });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.reverseGeocode = reverseGeocode;
