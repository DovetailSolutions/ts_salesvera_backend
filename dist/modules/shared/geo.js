"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineMeters = void 0;
// Haversine great-circle distance in meters. Extracted from
// attendance.service.ts (previously a private local function there) so the
// new per-user geo-fencing module can reuse the exact same formula instead
// of re-deriving it — a subtly wrong distance calc between two "copies" of
// this function would be worse than no code-sharing at all.
const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
exports.haversineMeters = haversineMeters;
