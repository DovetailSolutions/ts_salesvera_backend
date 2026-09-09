import { Op, Transaction } from "sequelize";
import { User, Attendance, AttendanceRegularization, AttendanceAuditLog } from "../../config/dbConnection";

// ============================================================
// Thin Sequelize wrappers — no business logic or authorization here, that
// lives in attendanceRegularization.service.ts. Same style as
// attendanceSecurity.repository.ts.
// ============================================================

export const findUserById = (userId: number) =>
  (User as any).findByPk(userId, {
    attributes: ["id", "firstName", "lastName", "email", "role", "status"],
  });

export const findUsersByIds = (userIds: number[]) =>
  (User as any).findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ["id", "firstName", "lastName", "email", "role"],
  });

// ── Regularization requests ─────────────────────────────────────────────
export const findPendingForUserDateType = (userId: number, attendanceDate: string, requestType: string) =>
  (AttendanceRegularization as any).findOne({
    where: { userId, attendanceDate, requestType, status: "pending" },
  });

export const createRequest = (row: {
  userId: number;
  companyId: number | null;
  attendanceId: number | null;
  requestType: string;
  attendanceDate: string;
  requestedPunchIn: Date | null;
  requestedPunchOut: Date | null;
  reason: string | null;
  description: string | null;
  attachmentUrl: string | null;
}) => (AttendanceRegularization as any).create({ ...row, status: "pending", submittedAt: new Date() });

export const findRequestById = (id: number) => (AttendanceRegularization as any).findByPk(id);

// Row-locked read for the approve/reject critical section — see
// attendanceRegularization.service.ts's approve/reject, same pattern as
// attendanceSecurity's findDeviceRequestByIdForUpdate: without FOR UPDATE,
// two concurrent reviews of the same request can both pass the "still
// pending" check before either write lands.
export const findRequestByIdForUpdate = (id: number, transaction: Transaction) =>
  (AttendanceRegularization as any).findByPk(id, { transaction, lock: Transaction.LOCK.UPDATE });

export const findRequests = ({
  userId,
  companyId,
  status,
  requestType,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
}: {
  userId?: number;
  companyId?: number | null;
  status?: string;
  requestType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) => {
  const where: any = {};
  if (userId != null) where.userId = userId;
  if (companyId != null) where.companyId = companyId;
  if (status) where.status = status;
  if (requestType) where.requestType = requestType;
  if (dateFrom || dateTo) {
    where.attendanceDate = {};
    if (dateFrom) where.attendanceDate[Op.gte] = dateFrom;
    if (dateTo) where.attendanceDate[Op.lte] = dateTo;
  }
  const offset = (Math.max(page, 1) - 1) * limit;
  return (AttendanceRegularization as any).findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};

export const updateRequestStatus = (
  id: number,
  status: "approved" | "rejected" | "cancelled",
  reviewedBy: number | null,
  reviewComment: string | null,
  transaction?: Transaction
) =>
  (AttendanceRegularization as any).update(
    { status, reviewedBy, reviewedAt: new Date(), reviewComment },
    { where: { id }, transaction }
  );

export const setRequestAttendanceId = (id: number, attendanceId: number, transaction?: Transaction) =>
  (AttendanceRegularization as any).update({ attendanceId }, { where: { id }, transaction });

// ── Attendance integration — reuses attendance.repository.ts's own
// findAttendanceForDate/createAttendanceRecord would create a second
// dependency edge between modules for one lookup; a direct read here (same
// underlying table/model) keeps this module self-contained while the
// approval flow's WRITE path still goes through the transaction-aware
// helpers below, not attendance.service.ts's punch-in business logic
// (deliberately bypassed — see the service's approve() for why).
export const findAttendanceForDate = (employeeId: number, date: string, transaction?: Transaction) =>
  (Attendance as any).findOne({ where: { employee_id: employeeId, date }, transaction });

export const createAttendanceRecord = (row: any, transaction?: Transaction) =>
  (Attendance as any).create(row, { transaction });

// ── Audit log (reuses the existing attendance_audit_logs table) ─────────
export const createAuditLog = (row: {
  userId: number;
  companyId?: number | null;
  actorId?: number | null;
  eventType: string;
  attendanceId?: number | null;
  regularizationRequestId?: number | null;
  message?: string | null;
  metadata?: Record<string, any> | null;
}) => (AttendanceAuditLog as any).create(row);

export const findAuditLogs = ({
  regularizationRequestId,
  userId,
  page = 1,
  limit = 50,
}: {
  regularizationRequestId?: number;
  userId?: number;
  page?: number;
  limit?: number;
}) => {
  const where: any = {};
  if (regularizationRequestId != null) where.regularizationRequestId = regularizationRequestId;
  if (userId != null) where.userId = userId;
  const offset = (Math.max(page, 1) - 1) * limit;
  return (AttendanceAuditLog as any).findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};
