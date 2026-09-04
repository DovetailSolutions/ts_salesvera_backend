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
exports.calculateDrivingDistanceKm = exports.getSalesPersonTravelSummary = exports.recordTravelSegment = exports.isPlausibleLeg = exports.MAX_PLAUSIBLE_ROAD_SPEED_KMH = exports.parseDistanceStringToKm = exports.calculateDrivingDistance = exports.isValidCoordinate = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const googleRoutes_service_1 = require("../../services/googleRoutes.service");
Object.defineProperty(exports, "calculateDrivingDistance", { enumerable: true, get: function () { return googleRoutes_service_1.calculateDrivingDistance; } });
Object.defineProperty(exports, "isValidCoordinate", { enumerable: true, get: function () { return googleRoutes_service_1.isValidCoordinate; } });
const parseDistanceStringToKm = (value) => {
    if (!value)
        return 0;
    const match = String(value).trim().match(/^([\d.]+)\s*(km|m)$/i);
    if (!match)
        return 0;
    const num = Number(match[1]);
    if (Number.isNaN(num))
        return 0;
    return match[2].toLowerCase() === "m" ? num / 1000 : num;
};
exports.parseDistanceStringToKm = parseDistanceStringToKm;
// A road leg can't physically be driven faster than ordinary highway speeds
// allow. Above this average implied speed, the problem is the GPS fix (e.g.
// a network/IP-based fallback location miles from the real spot), not the
// Google Maps distance — so it must not be trusted as a paid distance any
// more than a failed API call would be.
exports.MAX_PLAUSIBLE_ROAD_SPEED_KMH = 120;
const isPlausibleLeg = (distanceKm, elapsedMs) => {
    if (!(distanceKm > 0))
        return true;
    if (elapsedMs <= 0)
        return false;
    const elapsedHours = elapsedMs / 3600000;
    return distanceKm / elapsedHours <= exports.MAX_PLAUSIBLE_ROAD_SPEED_KMH;
};
exports.isPlausibleLeg = isPlausibleLeg;
// Record an explicit travel segment in sales_person_travel_logs
const recordTravelSegment = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, companyId, attendanceId = null, fromType, fromId = null, fromLatitude, fromLongitude, fromTimestamp = new Date(), toType, toId = null, toLatitude, toLongitude, toTimestamp = new Date(), } = params;
    if (!(0, googleRoutes_service_1.isValidCoordinate)(fromLatitude, fromLongitude) || !(0, googleRoutes_service_1.isValidCoordinate)(toLatitude, toLongitude)) {
        console.warn("recordTravelSegment: Invalid coordinates, skipping log creation");
        return null;
    }
    const result = yield (0, googleRoutes_service_1.calculateDrivingDistance)(fromLatitude, fromLongitude, toLatitude, toLongitude);
    let distanceMeters = 0;
    let distanceKm = 0;
    let travelDuration = null;
    if (result.success && result.distanceMeters !== undefined) {
        distanceMeters = result.distanceMeters;
        distanceKm = result.distanceKm || Number((distanceMeters / 1000).toFixed(3));
        travelDuration = result.duration || null;
    }
    const log = yield dbConnection_1.SalesPersonTravelLog.create({
        userId,
        companyId,
        attendanceId,
        fromType,
        fromId,
        fromLatitude: String(fromLatitude),
        fromLongitude: String(fromLongitude),
        fromTimestamp: fromTimestamp ? new Date(fromTimestamp) : new Date(),
        toType,
        toId,
        toLatitude: String(toLatitude),
        toLongitude: String(toLongitude),
        toTimestamp: toTimestamp ? new Date(toTimestamp) : new Date(),
        distanceMeters,
        distanceKm,
        travelDuration,
    });
    return { log, result };
});
exports.recordTravelSegment = recordTravelSegment;
// Daily travel summary (self-service and admin views share this)
const getSalesPersonTravelSummary = (userId, date) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const startOfDay = new Date(`${date}T00:00:00.000+05:30`);
    const endOfDay = new Date(`${date}T23:59:59.999+05:30`);
    const attendance = yield dbConnection_1.Attendance.findOne({
        where: { employee_id: userId, date },
        attributes: [
            "id", "date", "status",
            "punch_in", "punch_out",
            "latitude_in", "longitude_in", "latitude_out", "longitude_out",
            "locationNameIn", "locationNameOut",
            "lastMeetingId", "finalLegDistanceKm", "totalTravelDistanceKm",
            "vehicleAllowanceRateApplied", "vehicleAllowance", "distanceCalculationStatus",
        ],
    });
    const meetings = yield dbConnection_1.Meeting.findAll({
        where: {
            userId,
            [sequelize_1.Op.or]: [
                { meetingTimeIn: { [sequelize_1.Op.between]: [startOfDay, endOfDay] } },
                { scheduledTime: { [sequelize_1.Op.between]: [startOfDay, endOfDay] } },
            ],
        },
        attributes: [
            "id", "status", "meetingPurpose", "scheduledTime",
            "meetingTimeIn", "meetingTimeOut",
            "latitude_in", "longitude_in", "latitude_out", "longitude_out",
            "legDistance", "totalDistance",
        ],
        // Meeting locations never need reverse geocoding — the real customer
        // name/address is already on file (spec's "Location Name Priority":
        // customer name beats a geocoded street address every time). Split
        // across two related records: MeetingUser (personName, contact info)
        // and MeetingCompany (the actual companyName + address/city/state —
        // NOT on MeetingUser despite the similarly-named column there, which
        // CreateMeeting never populates).
        include: [
            { model: dbConnection_1.MeetingUser, attributes: ["id", "name", "companyName"], required: false },
            { model: dbConnection_1.MeetingCompany, attributes: ["id", "companyName", "address", "city", "state"], required: false },
        ],
        order: [["meetingTimeIn", "ASC"], ["scheduledTime", "ASC"]],
    });
    // Fetch persisted travel segment logs
    const travelLogs = yield dbConnection_1.SalesPersonTravelLog.findAll({
        where: {
            userId,
            createdAt: { [sequelize_1.Op.between]: [startOfDay, endOfDay] },
        },
        order: [["id", "ASC"]],
    });
    // Build segments representation
    let segments = travelLogs.map((log) => ({
        id: log.id,
        fromType: log.fromType,
        fromId: log.fromId,
        fromLatitude: log.fromLatitude,
        fromLongitude: log.fromLongitude,
        fromTimestamp: log.fromTimestamp,
        toType: log.toType,
        toId: log.toId,
        toLatitude: log.toLatitude,
        toLongitude: log.toLongitude,
        toTimestamp: log.toTimestamp,
        distanceMeters: log.distanceMeters,
        distanceKm: log.distanceKm,
        travelDuration: log.travelDuration,
        distanceDisplay: `${log.distanceKm} km`,
    }));
    // Fallback / fallback format if no travel logs yet but meetings exist
    if (segments.length === 0 && meetings.length > 0) {
        segments = meetings.map((m, idx) => ({
            id: m.id,
            fromType: idx === 0 ? "ATTENDANCE_IN" : "MEETING_OUT",
            fromId: idx === 0 ? null : meetings[idx - 1].id,
            toType: "MEETING_IN",
            toId: m.id,
            distanceKm: (0, exports.parseDistanceStringToKm)(m.legDistance),
            distanceDisplay: m.legDistance || null,
        }));
    }
    // Calculate total daily distance
    let totalDistanceKm = 0;
    if (segments.length > 0) {
        totalDistanceKm = Number(segments.reduce((acc, s) => acc + (Number(s.distanceKm) || 0), 0).toFixed(3));
    }
    else if (attendance && attendance.totalTravelDistanceKm != null) {
        totalDistanceKm = attendance.totalTravelDistanceKm;
    }
    // Fetch company vehicle allowance rate
    let vehicleAllowanceRateApplied = (_a = attendance === null || attendance === void 0 ? void 0 : attendance.vehicleAllowanceRateApplied) !== null && _a !== void 0 ? _a : 10;
    if (attendance) {
        const user = yield dbConnection_1.User.findByPk(userId, { attributes: ["tenantId"] });
        const companyId = user === null || user === void 0 ? void 0 : user.tenantId;
        if (companyId) {
            const company = yield dbConnection_1.Company.findByPk(companyId, { attributes: ["vehicleAllowanceRatePerKm"] });
            if ((company === null || company === void 0 ? void 0 : company.vehicleAllowanceRatePerKm) != null) {
                vehicleAllowanceRateApplied = company.vehicleAllowanceRatePerKm;
            }
        }
    }
    const vehicleAllowance = Number((totalDistanceKm * vehicleAllowanceRateApplied).toFixed(2));
    // ── Human-readable labels (spec items 38/40/57) ───────────────────────
    // Meeting: customer/company name first, "Industrial Area, Mohali"-style
    // address second — never geocoded, MeetingUser already has real data.
    // Attendance: the branch-match/geocoded name persisted at punch time,
    // falling back to "Location unavailable" rather than raw coordinates.
    const meetingLabel = (m) => {
        const mu = m === null || m === void 0 ? void 0 : m.MeetingUser;
        const mc = m === null || m === void 0 ? void 0 : m.MeetingCompany;
        return {
            name: (mc === null || mc === void 0 ? void 0 : mc.companyName) || (mu === null || mu === void 0 ? void 0 : mu.companyName) || (mu === null || mu === void 0 ? void 0 : mu.name) || "Meeting",
            subtitle: [mc === null || mc === void 0 ? void 0 : mc.address, mc === null || mc === void 0 ? void 0 : mc.city, mc === null || mc === void 0 ? void 0 : mc.state].filter(Boolean).join(", ") || null,
        };
    };
    const attendanceLabel = (name) => ({
        name: name || "Location unavailable",
        subtitle: null,
    });
    const meetingsPlain = meetings.map((m) => {
        const plain = m.get({ plain: true });
        plain.location = meetingLabel(m);
        return plain;
    });
    const attendancePlain = attendance ? attendance.get({ plain: true }) : null;
    if (attendancePlain) {
        attendancePlain.locationIn = attendanceLabel(attendancePlain.locationNameIn);
        attendancePlain.locationOut = attendanceLabel(attendancePlain.locationNameOut);
    }
    const meetingById = new Map(meetingsPlain.map((m) => [m.id, m]));
    const describePoint = (type, id) => {
        var _a, _b;
        if (type === "ATTENDANCE_IN")
            return (_a = attendancePlain === null || attendancePlain === void 0 ? void 0 : attendancePlain.locationIn) !== null && _a !== void 0 ? _a : attendanceLabel(null);
        if (type === "ATTENDANCE_OUT")
            return (_b = attendancePlain === null || attendancePlain === void 0 ? void 0 : attendancePlain.locationOut) !== null && _b !== void 0 ? _b : attendanceLabel(null);
        if (id != null && meetingById.has(id))
            return meetingById.get(id).location;
        return { name: "Location unavailable", subtitle: null };
    };
    const segmentsWithLabels = segments.map((s) => (Object.assign(Object.assign({}, s), { from: describePoint(s.fromType, s.fromId), to: describePoint(s.toType, s.toId) })));
    return {
        attendance: attendancePlain,
        meetings: meetingsPlain,
        travelLogs,
        segments: segmentsWithLabels,
        totalDistanceKm,
        vehicleAllowanceRateApplied,
        vehicleAllowance,
        distanceCalculationStatus: (attendance === null || attendance === void 0 ? void 0 : attendance.distanceCalculationStatus) || (segments.length > 0 ? "calculated" : "no_meetings"),
    };
});
exports.getSalesPersonTravelSummary = getSalesPersonTravelSummary;
exports.calculateDrivingDistanceKm = googleRoutes_service_1.calculateDrivingDistance;
