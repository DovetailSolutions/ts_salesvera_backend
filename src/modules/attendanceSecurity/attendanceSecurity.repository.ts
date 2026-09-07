import { Op, Transaction } from "sequelize";
import {
  User,
  AttendanceTrustedDevice,
  AttendanceDeviceChangeRequest,
  AttendanceAuditLog,
} from "../../config/dbConnection";

// ============================================================
// Thin Sequelize wrappers for the Attendance Security module — same style
// as geoFencing.repository.ts / attendance.repository.ts. No business logic
// or authorization here; that lives in attendanceSecurity.service.ts.
// ============================================================

export const findUserSecurityFlags = (userId: number) =>
  (User as any).findByPk(userId, {
    attributes: [
      "id",
      "isAttendancePhotoRequired",
      "isDeviceSecurityRequired",
      "isGeofenceRequired",
      "isPunchOutGeofenceRequired",
    ],
  });

export const findUsersByIds = (userIds: number[]) =>
  (User as any).findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ["id", "firstName", "lastName", "email", "role"],
  });

export const findUserById = (userId: number) =>
  (User as any).findByPk(userId, {
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "role",
      "status",
      "isAttendancePhotoRequired",
      "isDeviceSecurityRequired",
      "isGeofenceRequired",
      "isPunchOutGeofenceRequired",
    ],
  });

// ── Trusted device (single row per user) ────────────────────────────────
export const findTrustedDevice = (userId: number) =>
  (AttendanceTrustedDevice as any).findOne({ where: { userId } });

export const createTrustedDevice = (
  userId: number,
  companyId: number | null,
  deviceId: string,
  deviceName?: string | null,
  deviceType?: string | null
) =>
  (AttendanceTrustedDevice as any).create({
    userId,
    companyId,
    deviceId,
    deviceName: deviceName ?? null,
    deviceType: deviceType ?? null,
    registeredAt: new Date(),
    lastSeenAt: new Date(),
  });

// Replace-on-approval: upserts the single trusted-device row for this user.
export const replaceTrustedDevice = async (
  userId: number,
  companyId: number | null,
  deviceId: string,
  deviceName?: string | null,
  deviceType?: string | null
) => {
  const existing = await findTrustedDevice(userId);
  if (existing) {
    existing.deviceId = deviceId;
    existing.deviceName = deviceName ?? null;
    existing.deviceType = deviceType ?? null;
    if (companyId != null) existing.companyId = companyId;
    existing.registeredAt = new Date();
    existing.lastSeenAt = new Date();
    await existing.save();
    return existing;
  }
  return createTrustedDevice(userId, companyId, deviceId, deviceName, deviceType);
};

export const touchTrustedDevice = (id: number) =>
  (AttendanceTrustedDevice as any).update({ lastSeenAt: new Date() }, { where: { id } });

export const deleteTrustedDevice = (userId: number) =>
  (AttendanceTrustedDevice as any).destroy({ where: { userId } });

// ── Device-change requests ───────────────────────────────────────────────
export const findLatestRequestForDevice = (userId: number, deviceId: string) =>
  (AttendanceDeviceChangeRequest as any).findOne({
    where: { userId, requestedDeviceId: deviceId },
    order: [["id", "DESC"]],
  });

export const createDeviceChangeRequest = (
  userId: number,
  companyId: number | null,
  requestedDeviceId: string,
  requestedDeviceName: string | null | undefined,
  requestedDeviceType: string | null | undefined,
  previousDeviceId: string | null
) =>
  (AttendanceDeviceChangeRequest as any).create({
    userId,
    companyId,
    requestedDeviceId,
    requestedDeviceName: requestedDeviceName ?? null,
    requestedDeviceType: requestedDeviceType ?? null,
    previousDeviceId,
    status: "pending",
  });

export const findDeviceRequestById = (id: number) => (AttendanceDeviceChangeRequest as any).findByPk(id);

export const findDeviceRequests = ({
  companyId,
  status,
  page = 1,
  limit = 20,
}: {
  companyId?: number | null;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const where: any = {};
  if (companyId != null) where.companyId = companyId;
  if (status) where.status = status;
  const offset = (Math.max(page, 1) - 1) * limit;
  return (AttendanceDeviceChangeRequest as any).findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};

export const updateDeviceRequestStatus = (
  id: number,
  status: "approved" | "rejected",
  reviewedBy: number,
  reviewNote?: string | null,
  transaction?: Transaction
) =>
  (AttendanceDeviceChangeRequest as any).update(
    { status, reviewedBy, reviewedAt: new Date(), reviewNote: reviewNote ?? null },
    { where: { id }, transaction }
  );

// ── Audit log ─────────────────────────────────────────────────────────────
export const createAuditLog = (row: {
  userId: number;
  companyId?: number | null;
  actorId?: number | null;
  eventType: string;
  attendanceId?: number | null;
  deviceChangeRequestId?: number | null;
  message?: string | null;
  metadata?: Record<string, any> | null;
}) => (AttendanceAuditLog as any).create(row);

export const findAuditLogs = ({
  userId,
  companyId,
  eventType,
  page = 1,
  limit = 50,
}: {
  userId?: number;
  companyId?: number | null;
  eventType?: string;
  page?: number;
  limit?: number;
}) => {
  const where: any = {};
  if (userId != null) where.userId = userId;
  if (companyId != null) where.companyId = companyId;
  if (eventType) where.eventType = eventType;
  const offset = (Math.max(page, 1) - 1) * limit;
  return (AttendanceAuditLog as any).findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};

// ── Bulk settings ─────────────────────────────────────────────────────────
export const bulkUpdateUserSettings = (userIds: number[], settings: Record<string, any>, transaction: Transaction) =>
  (User as any).update(settings, { where: { id: { [Op.in]: userIds } }, transaction });
