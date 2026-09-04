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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseGeocode = exports.geocodeAddress = exports.checkUserGeoFencing = exports.saveConfigForUser = exports.getConfigForUser = exports.getMyConfig = void 0;
const dbConnection_1 = require("../../config/dbConnection");
const axios_1 = __importDefault(require("axios"));
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
const geo_1 = require("../shared/geo");
const tokenCheck_1 = require("../../config/tokenCheck");
const GeoFencingRepo = __importStar(require("./geoFencing.repository"));
// ============================================================
// Per-user attendance geo-fencing.
//
// IMPORTANT: this module only ever governs attendance punch-in/punch-out
// (see checkUserGeoFencing, called from attendance.service.ts). It must
// never be used to gate login, dashboards, or any other route — that's a
// hard product requirement, not just a convention.
//
// Hierarchy — who may view/configure whose geo-fencing:
//   super_admin -> admin                      (global, no company scoping)
//   admin       -> manager, sale_person        (same company, and only when
//                                               the admin's OWN config is
//                                               itself enabled — see
//                                               assertCanConfigure below)
// manager and sale_person cannot configure anyone's geo-fencing (spec: no
// implicit cascade — would need a future, explicit RBAC grant to change).
// ============================================================
const GEO_ASSIGNABLE_TARGET_ROLES = {
    super_admin: ["admin"],
    admin: ["manager", "sale_person"],
};
const MAX_RADIUS_METERS = 500000; // 500km — generous upper bound, guards against fat-finger entry
const toPublicConfig = (row, userId) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return ({
        userId,
        enabled: (_a = row === null || row === void 0 ? void 0 : row.enabled) !== null && _a !== void 0 ? _a : false,
        latitude: (_b = row === null || row === void 0 ? void 0 : row.latitude) !== null && _b !== void 0 ? _b : null,
        longitude: (_c = row === null || row === void 0 ? void 0 : row.longitude) !== null && _c !== void 0 ? _c : null,
        radius: (_d = row === null || row === void 0 ? void 0 : row.radius) !== null && _d !== void 0 ? _d : null,
        radiusUnit: (_e = row === null || row === void 0 ? void 0 : row.radiusUnit) !== null && _e !== void 0 ? _e : "m",
        locationName: (_f = row === null || row === void 0 ? void 0 : row.locationName) !== null && _f !== void 0 ? _f : null,
        landmark: (_g = row === null || row === void 0 ? void 0 : row.landmark) !== null && _g !== void 0 ? _g : null,
        address: (_h = row === null || row === void 0 ? void 0 : row.address) !== null && _h !== void 0 ? _h : null,
        city: (_j = row === null || row === void 0 ? void 0 : row.city) !== null && _j !== void 0 ? _j : null,
        createdAt: (_k = row === null || row === void 0 ? void 0 : row.createdAt) !== null && _k !== void 0 ? _k : null,
        updatedAt: (_l = row === null || row === void 0 ? void 0 : row.updatedAt) !== null && _l !== void 0 ? _l : null,
    });
};
const radiusInMeters = (radius, unit) => (unit === "km" ? radius * 1000 : radius);
// ── Self-service: view own config (any authenticated role) ─────────────────
const getMyConfig = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const row = yield GeoFencingRepo.findConfigByUserId(userId);
    return toPublicConfig(row, userId);
});
exports.getMyConfig = getMyConfig;
// ── View a specific user's config (super_admin/admin only) ─────────────────
const getConfigForUser = (callerId, callerRole, callerCompanyId, targetUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const targetUser = yield GeoFencingRepo.findUserById(targetUserId);
    if (!targetUser)
        throw new serviceError_1.ServiceError("User not found", 404);
    yield assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });
    const row = yield GeoFencingRepo.findConfigByUserId(targetUserId);
    return {
        config: toPublicConfig(row, targetUserId),
        targetUser: {
            id: targetUser.id,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            email: targetUser.email,
            role: targetUser.role,
        },
    };
});
exports.getConfigForUser = getConfigForUser;
// ── Configure a specific user's geo-fencing (super_admin/admin only) ───────
const saveConfigForUser = (callerId, callerRole, callerCompanyId, targetUserId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const targetUser = yield GeoFencingRepo.findUserById(targetUserId);
    if (!targetUser)
        throw new serviceError_1.ServiceError("User not found", 404);
    yield assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: true });
    if ((body === null || body === void 0 ? void 0 : body.isGeofenceRequired) !== undefined) {
        targetUser.isGeofenceRequired = Boolean(body.isGeofenceRequired);
        yield targetUser.save();
    }
    const enabled = !!(body === null || body === void 0 ? void 0 : body.enabled);
    let latitude = null;
    let longitude = null;
    let radius = null;
    let radiusUnit = (body === null || body === void 0 ? void 0 : body.radiusUnit) === "km" ? "km" : "m";
    const rawRadius = (body === null || body === void 0 ? void 0 : body.radius) != null ? body.radius : body === null || body === void 0 ? void 0 : body.radiusMeters;
    if ((body === null || body === void 0 ? void 0 : body.radius) == null && (body === null || body === void 0 ? void 0 : body.radiusMeters) != null) {
        radiusUnit = "m";
    }
    if (enabled) {
        latitude = Number(body === null || body === void 0 ? void 0 : body.latitude);
        longitude = Number(body === null || body === void 0 ? void 0 : body.longitude);
        radius = Number(rawRadius);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new serviceError_1.ServiceError("A valid latitude (-90 to 90) is required to enable geo-fencing");
        }
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new serviceError_1.ServiceError("A valid longitude (-180 to 180) is required to enable geo-fencing");
        }
        if (!Number.isFinite(radius) || radius <= 0) {
            throw new serviceError_1.ServiceError("Radius must be a positive number to enable geo-fencing");
        }
        if (radiusInMeters(radius, radiusUnit) > MAX_RADIUS_METERS) {
            throw new serviceError_1.ServiceError(`Radius is too large — must be at most ${MAX_RADIUS_METERS / 1000}km`);
        }
    }
    else if ((body === null || body === void 0 ? void 0 : body.latitude) != null || (body === null || body === void 0 ? void 0 : body.longitude) != null || (body === null || body === void 0 ? void 0 : body.radius) != null) {
        // Disabled, but caller still supplied coordinates (e.g. editing before
        // re-enabling) — keep them if individually valid, but never let a
        // malformed value silently persist.
        const lat = Number(body.latitude);
        const lng = Number(body.longitude);
        const rad = Number(body.radius);
        latitude = Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null;
        longitude = Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null;
        radius = Number.isFinite(rad) && rad > 0 ? rad : null;
    }
    // Resolve the target's own company for the audit column — admin targets
    // always share the caller's company (enforced in assertCanAct); a
    // super_admin configuring an admin has no single "caller company" to
    // fall back to, so resolve the admin's company directly.
    const resolvedCompanyId = callerCompanyId != null ? callerCompanyId : yield resolveTargetCompanyId(targetUser);
    const saved = yield GeoFencingRepo.upsertConfig(targetUserId, resolvedCompanyId, callerId, {
        enabled,
        latitude,
        longitude,
        radius,
        radiusUnit,
        locationName: (body === null || body === void 0 ? void 0 : body.locationName) !== undefined ? body.locationName : undefined,
        landmark: (body === null || body === void 0 ? void 0 : body.landmark) !== undefined ? body.landmark : undefined,
        address: (body === null || body === void 0 ? void 0 : body.address) !== undefined ? body.address : undefined,
        city: (body === null || body === void 0 ? void 0 : body.city) !== undefined ? body.city : undefined,
    });
    return toPublicConfig(saved, targetUserId);
});
exports.saveConfigForUser = saveConfigForUser;
// ── Authorization gate shared by GET/PUT above ──────────────────────────────
const assertCanAct = (callerId, callerRole, callerCompanyId, targetUser, opts) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedRoles = GEO_ASSIGNABLE_TARGET_ROLES[String(callerRole)] || [];
    if (allowedRoles.length === 0 || !allowedRoles.includes(String(targetUser.role))) {
        throw new serviceError_1.ServiceError(`As ${callerRole || "your role"} you cannot manage geo-fencing for a ${targetUser.role}`, 403);
    }
    if (callerRole === "admin") {
        // Tenant isolation — admin may only reach managers/sale_persons inside
        // their OWN company-scoped team, never another company's.
        const teamIds = yield (0, userHierarchy_1.getCompanyScopedChildUserIds)(callerId, callerCompanyId);
        if (!teamIds.includes(Number(targetUser.id))) {
            throw new serviceError_1.ServiceError("This user is not on your team, or belongs to another company", 403);
        }
        // Parent/child capability gate: an admin can only CONFIGURE (not just
        // view) their team's geo-fencing once super_admin has enabled it for
        // the admin's own account.
        if (opts.requireOwnCapability) {
            const ownConfig = yield GeoFencingRepo.findConfigByUserId(callerId);
            if (!(ownConfig === null || ownConfig === void 0 ? void 0 : ownConfig.enabled)) {
                throw new serviceError_1.ServiceError("Geo-Fencing has not been enabled for your account yet. Ask your Super Admin to enable it before configuring your team.", 403);
            }
        }
    }
    // super_admin: role check above is sufficient — global reach, no company
    // scoping and no capability gate (nothing above super_admin to grant one).
});
const resolveTargetCompanyId = (targetUser) => __awaiter(void 0, void 0, void 0, function* () {
    // Best-effort only — used solely to stamp the audit companyId column on
    // a super_admin-authored row; never used for authorization.
    try {
        return yield (0, tokenCheck_1.resolveCompanyId)(Number(targetUser.id), String(targetUser.role), null);
    }
    catch (_a) {
        return null;
    }
});
// ============================================================
// checkUserGeoFencing — called from attendance.service.ts on every
// punch-in/punch-out. NEVER call this from anywhere outside the attendance
// punch flow — it must not become a general access gate.
//
// Returns { enforced: false } when the user has no geo-fencing configured
// (or it's turned off) — punch proceeds normally, no location required.
// Throws ServiceError with the exact user-facing copy when enforced and the
// punch should be rejected.
// ============================================================
const checkUserGeoFencing = (userId, latitude, longitude) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if Admin set isGeofenceRequired = false for this user
    const user = yield dbConnection_1.User.findByPk(userId, { attributes: ["id", "isGeofenceRequired"] });
    if (user && user.isGeofenceRequired === false) {
        return { enforced: false, bypassed: true };
    }
    const config = (yield GeoFencingRepo.findConfigByUserId(userId));
    if (!(config === null || config === void 0 ? void 0 : config.enabled))
        return { enforced: false };
    // Config enabled but incomplete (shouldn't happen — saveConfigForUser
    // requires all three when enabling) — fail open rather than block
    // attendance over a data problem, matching the existing branch-geofence
    // philosophy ("missing config never blocks a punch").
    if (config.latitude == null || config.longitude == null || !config.radius) {
        return { enforced: false };
    }
    if (latitude == null || longitude == null || latitude === "" || longitude === "") {
        throw new serviceError_1.ServiceError("Unable to determine your current location. Please try again.");
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new serviceError_1.ServiceError("Unable to determine your current location. Please try again.");
    }
    const distanceMeters = (0, geo_1.haversineMeters)(lat, lng, Number(config.latitude), Number(config.longitude));
    const radiusMeters = radiusInMeters(Number(config.radius), config.radiusUnit);
    if (distanceMeters > radiusMeters) {
        throw new serviceError_1.ServiceError("You are outside the allowed attendance area. Please move inside the geo-fenced location and try again.");
    }
    return { enforced: true, verified: true, distanceMeters, radiusMeters };
});
exports.checkUserGeoFencing = checkUserGeoFencing;
const geocodeAddress = (address) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    if (!address || !address.trim())
        throw new serviceError_1.ServiceError("Address is required");
    const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
    if (apiKey) {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${apiKey}`;
            const response = yield axios_1.default.get(url);
            if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.status) === "OK" && ((_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.results) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                const result = response.data.results[0];
                return {
                    latitude: Number(result.geometry.location.lat).toFixed(6),
                    longitude: Number(result.geometry.location.lng).toFixed(6),
                    formattedAddress: result.formatted_address,
                    source: "google",
                };
            }
        }
        catch (err) {
            console.warn("Backend Google geocoding error:", err);
        }
    }
    try {
        const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}`;
        const response = yield axios_1.default.get(osmUrl, {
            headers: { "User-Agent": "SalesVera-Backend/1.0" },
        });
        if (Array.isArray(response.data) && response.data.length > 0) {
            const item = response.data[0];
            return {
                latitude: Number(item.lat).toFixed(6),
                longitude: Number(item.lon).toFixed(6),
                formattedAddress: item.display_name,
                source: "osm",
            };
        }
    }
    catch (err) {
        console.warn("Backend OSM geocoding error:", err);
    }
    throw new serviceError_1.ServiceError("Could not find coordinates for that address. Please try a different location.");
});
exports.geocodeAddress = geocodeAddress;
const reverseGeocode = (lat, lng) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
        throw new serviceError_1.ServiceError("Valid latitude and longitude are required");
    }
    const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
    if (apiKey) {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
            const response = yield axios_1.default.get(url);
            if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.status) === "OK" && ((_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.results) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                const result = response.data.results[0];
                let city = "";
                let landmark = "";
                for (const comp of result.address_components || []) {
                    if (comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")) {
                        city = comp.long_name;
                    }
                    if (comp.types.includes("point_of_interest") || comp.types.includes("premise") || comp.types.includes("sublocality")) {
                        if (!landmark)
                            landmark = comp.long_name;
                    }
                }
                return {
                    formattedAddress: result.formatted_address,
                    locationName: ((_e = (_d = result.address_components) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.long_name) || result.formatted_address.split(",")[0],
                    landmark: landmark || null,
                    city: city || null,
                    source: "google",
                };
            }
        }
        catch (err) {
            console.warn("Backend Google reverse-geocoding error:", err);
        }
    }
    try {
        const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        const response = yield axios_1.default.get(osmUrl, {
            headers: { "User-Agent": "SalesVera-Backend/1.0" },
        });
        if (response.data && response.data.display_name) {
            const d = response.data;
            const addr = d.address || {};
            const city = addr.city || addr.town || addr.village || addr.county || "";
            const locationName = addr.amenity || addr.building || addr.road || d.display_name.split(",")[0];
            const landmark = addr.suburb || addr.neighbourhood || "";
            return {
                formattedAddress: d.display_name,
                locationName,
                landmark: landmark || null,
                city: city || null,
                source: "osm",
            };
        }
    }
    catch (err) {
        console.warn("Backend OSM reverse-geocoding error:", err);
    }
    return { formattedAddress: `${lat}, ${lng}`, locationName: `${lat}, ${lng}`, landmark: null, city: null };
});
exports.reverseGeocode = reverseGeocode;
