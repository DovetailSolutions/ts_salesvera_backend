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
exports.calculateDrivingDistance = exports.isValidCoordinate = void 0;
const axios_1 = __importDefault(require("axios"));
const isValidCoordinate = (lat, lng) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (lat === null || lat === undefined || lng === null || lng === undefined)
        return false;
    if (Number.isNaN(latNum) || Number.isNaN(lngNum))
        return false;
    return latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
};
exports.isValidCoordinate = isValidCoordinate;
const calculateDrivingDistance = (originLat, originLng, destLat, destLng) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!(0, exports.isValidCoordinate)(originLat, originLng) || !(0, exports.isValidCoordinate)(destLat, destLng)) {
        return { success: false, error: "Invalid coordinates provided" };
    }
    const oLat = Number(originLat);
    const oLng = Number(originLng);
    const dLat = Number(destLat);
    const dLng = Number(destLng);
    const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("calculateDrivingDistance: GOOGLE_MAP_API_KEY is not set in environment");
        return { success: false, error: "Google Maps API Key not configured" };
    }
    // 1. Try Google Compute Routes API (v2) with FieldMask Header
    try {
        const response = yield axios_1.default.post("https://routes.googleapis.com/directions/v2:computeRoutes", {
            origin: {
                location: {
                    latLng: {
                        latitude: oLat,
                        longitude: oLng,
                    },
                },
            },
            destination: {
                location: {
                    latLng: {
                        latitude: dLat,
                        longitude: dLng,
                    },
                },
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
        }, {
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
            },
            timeout: 10000,
        });
        const route = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.routes) === null || _b === void 0 ? void 0 : _b[0];
        if (route && typeof route.distanceMeters === "number") {
            const distanceMeters = route.distanceMeters;
            const distanceKm = Number((distanceMeters / 1000).toFixed(3));
            const duration = route.duration || null;
            return { success: true, distanceMeters, distanceKm, km: distanceKm, duration };
        }
    }
    catch (err) {
        console.warn("Google Compute Routes API error, falling back to Distance Matrix:", ((_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.data) || (err === null || err === void 0 ? void 0 : err.message));
    }
    // 2. Fallback to Google Distance Matrix API if Compute Routes API fails
    try {
        const matrixRes = yield axios_1.default.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
            params: {
                origins: `${oLat},${oLng}`,
                destinations: `${dLat},${dLng}`,
                key: apiKey,
            },
            timeout: 10000,
        });
        const element = (_g = (_f = (_e = (_d = matrixRes.data) === null || _d === void 0 ? void 0 : _d.rows) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.elements) === null || _g === void 0 ? void 0 : _g[0];
        if (((_h = matrixRes.data) === null || _h === void 0 ? void 0 : _h.status) === "OK" && (element === null || element === void 0 ? void 0 : element.status) === "OK") {
            const distanceMeters = element.distance.value;
            const distanceKm = Number((distanceMeters / 1000).toFixed(3));
            const duration = ((_j = element.duration) === null || _j === void 0 ? void 0 : _j.text) || null;
            return { success: true, distanceMeters, distanceKm, duration };
        }
    }
    catch (err) {
        console.error("Google Distance Matrix API fallback failed:", err === null || err === void 0 ? void 0 : err.message);
    }
    return { success: false, error: "Failed to calculate driving distance between points" };
});
exports.calculateDrivingDistance = calculateDrivingDistance;
