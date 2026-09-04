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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAttendanceLocationName = exports.reverseGeocode = exports.resolveBranchLocationName = void 0;
const axios_1 = __importDefault(require("axios"));
const dbConnection_1 = require("../../config/dbConnection");
const geo_1 = require("../shared/geo");
// ============================================================
// Human-readable location names for the travel timeline (see spec items
// 38/39/57): "Dovetail Solutions Office, Mohali" instead of raw lat/lng.
//
// Priority used by resolveAttendanceLocationName (item 57's list, minus the
// customer/meeting-name step — that one only applies to meeting points,
// handled directly in travelDistance.service.ts from MeetingUser's own
// name/companyName/address, never geocoded):
//   1. A company branch within 300m -> "<branchName>, <branchCity>"
//   2. Google reverse geocoding -> a real street address
//   3. null (caller falls back to "Location unavailable")
// Never throws — a geocoding failure must never break the rest of the
// travel history (spec item 39).
// ============================================================
const BRANCH_MATCH_RADIUS_METERS = 300;
const resolveBranchLocationName = (lat, lng, companyId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!companyId)
        return null;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum))
        return null;
    const branches = yield dbConnection_1.Branch.findAll({
        where: { companyId },
        attributes: ["branchName", "branchCity", "latitude", "longitude"],
    });
    for (const branch of branches) {
        if (branch.latitude == null || branch.longitude == null)
            continue;
        const distance = (0, geo_1.haversineMeters)(latNum, lngNum, Number(branch.latitude), Number(branch.longitude));
        if (distance <= BRANCH_MATCH_RADIUS_METERS) {
            return branch.branchCity && branch.branchCity !== branch.branchName
                ? `${branch.branchName}, ${branch.branchCity}`
                : branch.branchName;
        }
    }
    return null;
});
exports.resolveBranchLocationName = resolveBranchLocationName;
const reverseGeocode = (lat, lng) => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = process.env.GOOGLE_MAP_API_KEY;
    if (!apiKey)
        return null;
    try {
        const response = yield axios_1.default.get("https://maps.googleapis.com/maps/api/geocode/json", {
            params: { latlng: `${lat},${lng}`, key: apiKey },
            timeout: 8000,
        });
        const data = response.data;
        if ((data === null || data === void 0 ? void 0 : data.status) !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
            return null;
        }
        // Prefer a locality-level result over the maximally-precise "plus code"/
        // premise result Google often returns first — "Sector 34, Chandigarh"
        // reads better in a timeline than a specific rooftop address.
        const preferred = data.results.find((r) => { var _a, _b; return ((_a = r.types) === null || _a === void 0 ? void 0 : _a.includes("sublocality")) || ((_b = r.types) === null || _b === void 0 ? void 0 : _b.includes("locality")); }) ||
            data.results[0];
        return preferred.formatted_address || null;
    }
    catch (error) {
        console.error("reverseGeocode: request failed", error === null || error === void 0 ? void 0 : error.message);
        return null;
    }
});
exports.reverseGeocode = reverseGeocode;
const resolveAttendanceLocationName = (lat, lng, companyId) => __awaiter(void 0, void 0, void 0, function* () {
    const branchName = yield (0, exports.resolveBranchLocationName)(lat, lng, companyId);
    if (branchName)
        return branchName;
    return (0, exports.reverseGeocode)(lat, lng);
});
exports.resolveAttendanceLocationName = resolveAttendanceLocationName;
