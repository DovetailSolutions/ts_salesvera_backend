import { Op } from "sequelize";
import { Attendance, Meeting, MeetingUser, MeetingCompany, Company, SalesPersonTravelLog, User } from "../../config/dbConnection";
import { calculateDrivingDistance, isValidCoordinate, DrivingDistanceResult } from "../../services/googleRoutes.service";

export { isValidCoordinate, calculateDrivingDistance, DrivingDistanceResult };

export const parseDistanceStringToKm = (value: string | null | undefined): number => {
  if (!value) return 0;
  const match = String(value).trim().match(/^([\d.]+)\s*(km|m)$/i);
  if (!match) return 0;
  const num = Number(match[1]);
  if (Number.isNaN(num)) return 0;
  return match[2].toLowerCase() === "m" ? num / 1000 : num;
};

// A road leg can't physically be driven faster than ordinary highway speeds
// allow. Above this average implied speed, the problem is the GPS fix (e.g.
// a network/IP-based fallback location miles from the real spot), not the
// Google Maps distance — so it must not be trusted as a paid distance any
// more than a failed API call would be.
export const MAX_PLAUSIBLE_ROAD_SPEED_KMH = 120;

export const isPlausibleLeg = (distanceKm: number, elapsedMs: number): boolean => {
  if (!(distanceKm > 0)) return true;
  if (elapsedMs <= 0) return false;
  const elapsedHours = elapsedMs / 3_600_000;
  return distanceKm / elapsedHours <= MAX_PLAUSIBLE_ROAD_SPEED_KMH;
};

// Record an explicit travel segment in sales_person_travel_logs
export const recordTravelSegment = async (params: {
  userId: number;
  companyId: number;
  attendanceId?: number | null;
  fromType: "ATTENDANCE_IN" | "MEETING_OUT" | "MEETING";
  fromId?: number | null;
  fromLatitude: string;
  fromLongitude: string;
  fromTimestamp?: Date | null;
  toType: "MEETING_IN" | "MEETING" | "ATTENDANCE_OUT";
  toId?: number | null;
  toLatitude: string;
  toLongitude: string;
  toTimestamp?: Date | null;
}) => {
  const {
    userId,
    companyId,
    attendanceId = null,
    fromType,
    fromId = null,
    fromLatitude,
    fromLongitude,
    fromTimestamp = new Date(),
    toType,
    toId = null,
    toLatitude,
    toLongitude,
    toTimestamp = new Date(),
  } = params;

  if (!isValidCoordinate(fromLatitude, fromLongitude) || !isValidCoordinate(toLatitude, toLongitude)) {
    console.warn("recordTravelSegment: Invalid coordinates, skipping log creation");
    return null;
  }

  const result = await calculateDrivingDistance(fromLatitude, fromLongitude, toLatitude, toLongitude);
  let distanceMeters = 0;
  let distanceKm = 0;
  let travelDuration: string | null = null;

  if (result.success && result.distanceMeters !== undefined) {
    distanceMeters = result.distanceMeters;
    distanceKm = result.distanceKm || Number((distanceMeters / 1000).toFixed(3));
    travelDuration = result.duration || null;
  }

  const log = await SalesPersonTravelLog.create({
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
};

// Daily travel summary (self-service and admin views share this)
export const getSalesPersonTravelSummary = async (userId: number, date: string) => {
  const startOfDay = new Date(`${date}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${date}T23:59:59.999+05:30`);

  const attendance = await Attendance.findOne({
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

  const meetings = await Meeting.findAll({
    where: {
      userId,
      [Op.or]: [
        { meetingTimeIn: { [Op.between]: [startOfDay, endOfDay] } },
        { scheduledTime: { [Op.between]: [startOfDay, endOfDay] } },
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
      { model: MeetingUser, attributes: ["id", "name", "companyName"], required: false },
      { model: MeetingCompany, attributes: ["id", "companyName", "address", "city", "state"], required: false },
    ],
    order: [["meetingTimeIn", "ASC"], ["scheduledTime", "ASC"]],
  });

  // Fetch persisted travel segment logs
  const travelLogs = await SalesPersonTravelLog.findAll({
    where: {
      userId,
      createdAt: { [Op.between]: [startOfDay, endOfDay] },
    },
    order: [["id", "ASC"]],
  });

  // Build segments representation
  let segments: any[] = travelLogs.map((log: any) => ({
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
    segments = meetings.map((m: any, idx: number) => ({
      id: m.id,
      fromType: idx === 0 ? "ATTENDANCE_IN" : "MEETING_OUT",
      fromId: idx === 0 ? null : meetings[idx - 1].id,
      toType: "MEETING_IN",
      toId: m.id,
      distanceKm: parseDistanceStringToKm(m.legDistance),
      distanceDisplay: m.legDistance || null,
    }));
  }

  // Calculate total daily distance
  let totalDistanceKm: number = 0;
  if (segments.length > 0) {
    totalDistanceKm = Number(
      segments.reduce((acc: number, s: any) => acc + (Number(s.distanceKm) || 0), 0).toFixed(3)
    );
  } else if (attendance && attendance.totalTravelDistanceKm != null) {
    totalDistanceKm = attendance.totalTravelDistanceKm;
  }

  // Fetch company vehicle allowance rate
  let vehicleAllowanceRateApplied = attendance?.vehicleAllowanceRateApplied ?? 10;
  if (attendance) {
    const user = await User.findByPk(userId, { attributes: ["tenantId"] });
    const companyId = (user as any)?.tenantId;
    if (companyId) {
      const company = await Company.findByPk(companyId, { attributes: ["vehicleAllowanceRatePerKm"] });
      if (company?.vehicleAllowanceRatePerKm != null) {
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
  const meetingLabel = (m: any) => {
    const mu = m?.MeetingUser;
    const mc = m?.MeetingCompany;
    return {
      name: mc?.companyName || mu?.companyName || mu?.name || "Meeting",
      subtitle: [mc?.address, mc?.city, mc?.state].filter(Boolean).join(", ") || null,
    };
  };
  const attendanceLabel = (name: string | null | undefined) => ({
    name: name || "Location unavailable",
    subtitle: null,
  });

  const meetingsPlain = meetings.map((m: any) => {
    const plain = m.get({ plain: true });
    plain.location = meetingLabel(m);
    return plain;
  });

  const attendancePlain: any = attendance ? attendance.get({ plain: true }) : null;
  if (attendancePlain) {
    attendancePlain.locationIn = attendanceLabel(attendancePlain.locationNameIn);
    attendancePlain.locationOut = attendanceLabel(attendancePlain.locationNameOut);
  }

  const meetingById = new Map(meetingsPlain.map((m: any) => [m.id, m]));
  const describePoint = (type: string | null, id: number | null) => {
    if (type === "ATTENDANCE_IN") return attendancePlain?.locationIn ?? attendanceLabel(null);
    if (type === "ATTENDANCE_OUT") return attendancePlain?.locationOut ?? attendanceLabel(null);
    if (id != null && meetingById.has(id)) return (meetingById.get(id) as any).location;
    return { name: "Location unavailable", subtitle: null };
  };

  const segmentsWithLabels = segments.map((s: any) => ({
    ...s,
    from: describePoint(s.fromType, s.fromId),
    to: describePoint(s.toType, s.toId),
  }));

  return {
    attendance: attendancePlain,
    meetings: meetingsPlain,
    travelLogs,
    segments: segmentsWithLabels,
    totalDistanceKm,
    vehicleAllowanceRateApplied,
    vehicleAllowance,
    distanceCalculationStatus: attendance?.distanceCalculationStatus || (segments.length > 0 ? "calculated" : "no_meetings"),
  };
};

export const calculateDrivingDistanceKm = calculateDrivingDistance;
