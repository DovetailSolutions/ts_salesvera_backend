import { Op, UniqueConstraintError } from "sequelize";
import { sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { assertCanAct } from "../geoFencing/geoFencing.service";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { getCompanyAdminIds, getCompanyScopedChildUserIdsFast, getDirectCreator } from "../shared/userHierarchy";
import { getISTDateString, parseISTTime } from "../shared/dateUtils";
import { ATTENDANCE_REGULARIZATION_DAYS } from "../../config/env";
import * as Repo from "./attendanceRegularization.repository";

// ============================================================
// Attendance Regularization — Sale Person-initiated correction requests for
// missed/incorrect attendance (missed punch-in/out, client visit, WFH,
// technical glitch, other), reviewed by Admin/Manager. Modeled directly on
// attendanceSecurity.service.ts's device-change-request workflow (same
// row-locked approve/reject, same assertCanAct authorization reuse, same
// audit-log + notification pattern) — deliberately not a new architecture.
//
// IMPORTANT DECISION (documented per the spec's explicit ask, see §35):
// approving a request does NOT re-run attendance.service.ts's normal punch
// pipeline (geo-fencing, device security, shift-window checks). This is an
// administrative override — the whole point is to correct attendance for
// exactly the cases where those real-time checks already failed or don't
// apply (a technical glitch, WFH, a client visit with no device nearby).
// What IS still always enforced regardless: authorization (assertCanAct),
// company/tenant isolation, request-status transitions, and audit logging
// — see approveRequest/rejectRequest below.
// ============================================================

export const REQUEST_TYPES = [
  "MISSED_PUNCH_IN",
  "MISSED_PUNCH_OUT",
  "MISSED_BOTH",
  "CLIENT_VISIT",
  "WORK_FROM_HOME",
  "TECHNICAL_GLITCH",
  "OTHER",
] as const;

// Friendly UI labels — the database enum value is never shown to a user
// directly (see §5).
export const REQUEST_TYPE_LABELS: Record<string, string> = {
  MISSED_PUNCH_IN: "Missed Punch In",
  MISSED_PUNCH_OUT: "Missed Punch Out",
  MISSED_BOTH: "Missed Punch In & Punch Out",
  CLIENT_VISIT: "Client Visit",
  WORK_FROM_HOME: "Work From Home",
  TECHNICAL_GLITCH: "Technical Glitch",
  OTHER: "Other",
};

const MAX_REASON_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
// Fixed business rule — admin reviews/manages requests but never creates
// one; enforced here too (defense in depth) alongside the route-level
// authorizeCreateRegularization gate. super_admin is intentionally not
// listed either — same as before this fix, unchanged.
const ELIGIBLE_ROLES = ["sale_person", "manager"];

const toPublicRequest = (row: any) => {
  const plain = row.get ? row.get({ plain: true }) : row;
  return { ...plain, requestTypeLabel: REQUEST_TYPE_LABELS[plain.requestType] ?? plain.requestType };
};

// ── Validation ────────────────────────────────────────────────────────────
const validateAndNormalize = (body: any): {
  requestType: string;
  attendanceDate: string;
  requestedPunchIn: Date | null;
  requestedPunchOut: Date | null;
  reason: string;
  description: string | null;
} => {
  const requestType = String(body?.requestType || "").toUpperCase();
  if (!REQUEST_TYPES.includes(requestType as any)) {
    throw new ServiceError(`Invalid request type. Must be one of: ${REQUEST_TYPES.join(", ")}`);
  }

  const attendanceDate = String(body?.attendanceDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) || Number.isNaN(new Date(attendanceDate).getTime())) {
    throw new ServiceError("A valid attendanceDate (YYYY-MM-DD) is required");
  }
  const today = getISTDateString();
  if (attendanceDate > today) {
    throw new ServiceError("Cannot request regularization for a future date");
  }
  const earliestAllowed = getISTDateString(new Date(Date.now() - ATTENDANCE_REGULARIZATION_DAYS * 86400000));
  if (attendanceDate < earliestAllowed) {
    throw new ServiceError(
      `Regularization requests are only allowed within the last ${ATTENDANCE_REGULARIZATION_DAYS} days (on or after ${earliestAllowed})`
    );
  }

  const reason = String(body?.reason || "").trim();
  if (!reason) throw new ServiceError("A reason is required");
  if (reason.length > MAX_REASON_LENGTH) throw new ServiceError(`Reason must be under ${MAX_REASON_LENGTH} characters`);

  const descriptionRaw = body?.description != null ? String(body.description).trim() : null;
  if (descriptionRaw && descriptionRaw.length > MAX_DESCRIPTION_LENGTH) {
    throw new ServiceError(`Description must be under ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  const description = descriptionRaw || null;

  // A bare "HH:mm" means "that wall-clock time in IST", the same assumption
  // dateUtils.ts's parseISTTime already documents for shift start/end times
  // — parsed via its explicit "+05:30" offset construction, NOT
  // OS-timezone-dependent (unlike `new Date(\`${date}T${time}:00\`)`, which
  // would silently mean a different real-world instant on any server whose
  // OS timezone isn't already IST). A full ISO datetime (already carrying
  // its own offset/Z) is passed straight to the standard Date constructor.
  const parseTime = (value: any, label: string): Date | null => {
    if (value == null || value === "") return null;
    try {
      const asDate = /^\d{2}:\d{2}(:\d{2})?$/.test(String(value)) ? parseISTTime(attendanceDate, String(value)) : new Date(value);
      if (Number.isNaN(asDate.getTime())) throw new Error("invalid");
      return asDate;
    } catch {
      throw new ServiceError(`Invalid ${label} time`);
    }
  };

  let requestedPunchIn = parseTime(body?.requestedPunchIn, "punch-in");
  let requestedPunchOut = parseTime(body?.requestedPunchOut, "punch-out");

  switch (requestType) {
    case "MISSED_PUNCH_IN":
      if (!requestedPunchIn) throw new ServiceError("Requested punch-in time is required for a missed punch-in");
      requestedPunchOut = null;
      break;
    case "MISSED_PUNCH_OUT":
      if (!requestedPunchOut) throw new ServiceError("Requested punch-out time is required for a missed punch-out");
      requestedPunchIn = null;
      break;
    case "MISSED_BOTH":
    case "CLIENT_VISIT":
      if (!requestedPunchIn || !requestedPunchOut) {
        throw new ServiceError("Both punch-in and punch-out times are required for this request type");
      }
      break;
    case "TECHNICAL_GLITCH":
      if (!requestedPunchIn && !requestedPunchOut) {
        throw new ServiceError("At least one expected punch time is required");
      }
      break;
    case "WORK_FROM_HOME":
      // No specific times tracked for WFH — approval marks the day present
      // without punch times (see approveRequest's WFH branch).
      requestedPunchIn = null;
      requestedPunchOut = null;
      break;
    case "OTHER":
      // Both optional.
      break;
  }

  if (requestedPunchIn && requestedPunchOut && requestedPunchIn.getTime() >= requestedPunchOut.getTime()) {
    throw new ServiceError("Punch-in time must be before punch-out time");
  }

  return { requestType, attendanceDate, requestedPunchIn, requestedPunchOut, reason, description };
};

// ── Create ────────────────────────────────────────────────────────────────
export const createRequest = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  body: any,
  attachmentUrl: string | null
) => {
  if (!ELIGIBLE_ROLES.includes(String(callerRole))) {
    throw new ServiceError("Your role cannot submit attendance regularization requests", 403);
  }

  const normalized = validateAndNormalize(body);

  // Duplicate-prevention pre-check (defense in depth — the partial unique
  // index idx_areg_one_pending_per_date_type, migration 0020, is the actual
  // guarantee under concurrent submissions, same pattern as
  // attendanceSecurity's device-change dedup).
  const existingPending = await Repo.findPendingForUserDateType(callerId, normalized.attendanceDate, normalized.requestType);
  if (existingPending) {
    throw new ServiceError(
      "You already have a pending regularization request for this date and type",
      409,
      { code: "REGULARIZATION_DUPLICATE", requestId: existingPending.id }
    );
  }

  const existingAttendance = await Repo.findAttendanceForDate(callerId, normalized.attendanceDate);

  let created;
  try {
    created = await Repo.createRequest({
      userId: callerId,
      companyId: callerCompanyId,
      attendanceId: existingAttendance ? existingAttendance.id : null,
      requestType: normalized.requestType,
      attendanceDate: normalized.attendanceDate,
      requestedPunchIn: normalized.requestedPunchIn,
      requestedPunchOut: normalized.requestedPunchOut,
      reason: normalized.reason,
      description: normalized.description,
      attachmentUrl,
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const winner = await Repo.findPendingForUserDateType(callerId, normalized.attendanceDate, normalized.requestType);
      throw new ServiceError(
        "You already have a pending regularization request for this date and type",
        409,
        { code: "REGULARIZATION_DUPLICATE", requestId: winner?.id }
      );
    }
    throw err;
  }

  Repo.createAuditLog({
    userId: callerId,
    companyId: callerCompanyId,
    actorId: callerId,
    eventType: "REQUEST_CREATED",
    attendanceId: existingAttendance ? existingAttendance.id : null,
    regularizationRequestId: created.id,
    metadata: { requestType: normalized.requestType, attendanceDate: normalized.attendanceDate },
  });

  notifyRegularizationCreated(callerId, callerRole, callerCompanyId, created.id, normalized.requestType, normalized.attendanceDate);

  return toPublicRequest(created);
};

// ── Cancel (self, own pending request only) ──────────────────────────────
export const cancelRequest = async (callerId: number, requestId: number) => {
  const request = await Repo.findRequestById(requestId);
  if (!request) throw new ServiceError("Regularization request not found", 404);
  if (request.userId !== callerId) throw new ServiceError("You can only cancel your own request", 403);
  if (request.status !== "pending") throw new ServiceError(`This request has already been ${request.status}`, 400);

  await Repo.updateRequestStatus(requestId, "cancelled", callerId, null);
  Repo.createAuditLog({
    userId: callerId,
    companyId: request.companyId,
    actorId: callerId,
    eventType: "REQUEST_CANCELLED",
    regularizationRequestId: requestId,
  });
  return { requestId, status: "cancelled" as const };
};

// ── Self-service list ────────────────────────────────────────────────────
export const getMyRequests = async (userId: number, opts: { page?: number; limit?: number; status?: string }) => {
  const { rows, count } = await Repo.findRequests({ userId, status: opts.status, page: opts.page, limit: opts.limit });
  return { rows: rows.map(toPublicRequest), total: count };
};

// ── Admin/Manager list — company-scoped, same pattern as
// attendanceSecurity.service.ts's getDeviceRequests, EXCEPT for the
// manager branch below, which is deliberately narrower.
//
// attendanceSecurity's getDeviceRequests scopes "everyone but super_admin"
// to companyId alone — i.e. a manager sees the whole company. That's a
// legitimate, deliberate, existing convention for that module, but the
// Regularization feature spec explicitly requires a Manager's list to be
// "My + My Team" only (never another manager's team), with M4/M5 as
// acceptance tests — so this function additionally scopes the manager
// case to their own company-scoped hierarchy (reusing the exact same
// getCompanyScopedChildUserIdsFast helper assertCanAct already uses to
// authorize approve/reject), rather than the whole company. Admin and
// super_admin are unchanged.
// ─────────────────────────────────────────────────────────────────────────
export const getRequests = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  opts: { status?: string; requestType?: string; userId?: number; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
) => {
  let companyId: number | undefined = callerRole === "super_admin" ? undefined : (callerCompanyId ?? undefined);
  let userIdFilter: any = opts.userId;

  if (callerRole === "manager") {
    // Own company-scoped team (sale persons, and any managers under this
    // manager) — never another manager's team, never another company's.
    const teamIds = await getCompanyScopedChildUserIdsFast(callerId, callerCompanyId);

    if (opts.userId != null) {
      // A specific user was requested — never trust it blindly (client-
      // supplied userId is exactly the IDOR vector §37 calls out). Only
      // allow it if that user is actually on this manager's team.
      if (!teamIds.includes(opts.userId)) {
        throw new ServiceError("You are not authorized to view this user's regularization requests", 403);
      }
      userIdFilter = opts.userId;
    } else {
      // No specific user requested — "Team Requests" means the manager's
      // own subordinates, NOT the manager's own submissions (those are
      // covered separately by /attendance-regularization/my, matching the
      // UI's distinct "My Regularizations" vs "Team Regularizations"
      // sections). An empty team correctly yields an empty Op.in (no rows).
      userIdFilter = { [Op.in]: teamIds };
    }
    // companyId is still applied too (defense in depth) — teamIds is
    // already company-scoped, but keeping both narrows the query to the
    // exact same guarantee attendanceSecurity relies on.
  }

  const { rows, count } = await Repo.findRequests({
    companyId,
    status: opts.status,
    requestType: opts.requestType,
    userId: userIdFilter,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    page: opts.page,
    limit: opts.limit,
  });

  const userIds: number[] = Array.from(new Set(rows.map((r: any) => r.userId)));
  const users = userIds.length > 0 ? await Repo.findUsersByIds(userIds) : [];
  const userById = new Map(users.map((u: any) => [u.id, u]));
  const enriched = rows.map((r: any) => ({ ...toPublicRequest(r), user: userById.get(r.userId) ?? null }));

  return { rows: enriched, total: count };
};

export const getRequestDetail = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  requestId: number
) => {
  const request = await Repo.findRequestById(requestId);
  if (!request) throw new ServiceError("Regularization request not found", 404);

  const targetUser = await Repo.findUserById(request.userId);
  if (!targetUser) throw new ServiceError("User not found", 404);

  // Self-owner may always view their own request; anyone else needs
  // reviewer authorization over that Sale Person.
  if (request.userId !== callerId) {
    await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });
  }

  const originalAttendance = request.attendanceId ? await Repo.findAttendanceForDate(request.userId, request.attendanceDate) : null;
  const { rows: auditLog } = await Repo.findAuditLogs({ regularizationRequestId: requestId, limit: 20 });

  return { request: toPublicRequest(request), targetUser, originalAttendance, auditLog };
};

// ── Approve ───────────────────────────────────────────────────────────────
export const approveRequest = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  requestId: number,
  comment?: string
) => {
  const preCheck = await Repo.findRequestById(requestId);
  if (!preCheck) throw new ServiceError("Regularization request not found", 404);
  const targetUser = await Repo.findUserById(preCheck.userId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  // Sale person can never approve — ELIGIBLE_ROLES for review is exactly
  // GEO_ASSIGNABLE_TARGET_ROLES's caller side (admin/manager/super_admin),
  // enforced by assertCanAct itself (a sale_person caller has no allowed
  // target roles at all, so this throws 403 unconditionally for them —
  // also blocks a Sale Person "approving" their own request).
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  const result = await sequelize.transaction(async (t) => {
    const locked = await Repo.findRequestByIdForUpdate(requestId, t);
    if (!locked) throw new ServiceError("Regularization request not found", 404);
    if (locked.status !== "pending") {
      throw new ServiceError("This request has already been reviewed", 409, {
        code: "REGULARIZATION_ALREADY_REVIEWED",
        status: locked.status,
      });
    }

    let attendance = await Repo.findAttendanceForDate(locked.userId, locked.attendanceDate, t);
    const originalPunchIn = attendance?.punch_in ?? null;
    const originalPunchOut = attendance?.punch_out ?? null;

    const nextPunchIn = locked.requestedPunchIn ?? originalPunchIn;
    const nextPunchOut = locked.requestedPunchOut ?? originalPunchOut;
    // WFH has no punch times at all — approval marks the day present
    // without inventing times (see validateAndNormalize's WFH branch and
    // §35's documented exception).
    const isWorkFromHome = locked.requestType === "WORK_FROM_HOME";
    const status = isWorkFromHome ? "present" : nextPunchOut ? "out" : "present";
    // Deliberately NOT attendance.service.ts's full shift-overlap
    // computeShiftOverlapHours logic (§35) — a simple elapsed-time figure
    // is enough for an administrative correction; it's clearly
    // distinguishable from a normal day via attendanceSource anyway.
    const workingHours =
      nextPunchIn && nextPunchOut ? Math.round(((nextPunchOut.getTime() - nextPunchIn.getTime()) / 3600000) * 100) / 100 : null;

    if (attendance) {
      attendance.originalPunchIn = originalPunchIn;
      attendance.originalPunchOut = originalPunchOut;
      attendance.punch_in = nextPunchIn as any;
      attendance.punch_out = nextPunchOut as any;
      attendance.status = status as any;
      attendance.working_hours = workingHours as any;
      attendance.attendanceSource = "REGULARIZATION";
      attendance.regularizedFromRequestId = locked.id;
      await attendance.save({ transaction: t });
    } else {
      attendance = await Repo.createAttendanceRecord(
        {
          employee_id: locked.userId,
          date: locked.attendanceDate,
          punch_in: nextPunchIn,
          punch_out: nextPunchOut,
          status,
          working_hours: workingHours,
          late: false,
          attendanceSource: "REGULARIZATION",
          originalPunchIn: null,
          originalPunchOut: null,
          regularizedFromRequestId: locked.id,
        },
        t
      );
    }

    await Repo.setRequestAttendanceId(requestId, attendance.id, t);
    await Repo.updateRequestStatus(requestId, "approved", callerId, comment ?? null, t);

    return { attendance, originalPunchIn, originalPunchOut, nextPunchIn, nextPunchOut };
  });

  Repo.createAuditLog({
    userId: preCheck.userId,
    companyId: preCheck.companyId,
    actorId: callerId,
    eventType: "REQUEST_APPROVED",
    attendanceId: result.attendance.id,
    regularizationRequestId: requestId,
    message: comment ?? null,
  });
  Repo.createAuditLog({
    userId: preCheck.userId,
    companyId: preCheck.companyId,
    actorId: callerId,
    eventType: "ATTENDANCE_REGULARIZED",
    attendanceId: result.attendance.id,
    regularizationRequestId: requestId,
    metadata: {
      oldValue: { punchIn: result.originalPunchIn, punchOut: result.originalPunchOut },
      newValue: { punchIn: result.nextPunchIn, punchOut: result.nextPunchOut },
    },
  });

  notifyRegularizationReviewed(preCheck.userId, requestId, true, comment);

  return { requestId, status: "approved" as const, attendanceId: result.attendance.id };
};

// ── Reject ────────────────────────────────────────────────────────────────
export const rejectRequest = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  requestId: number,
  comment: string
) => {
  const trimmedComment = String(comment || "").trim();
  if (!trimmedComment) throw new ServiceError("A rejection reason is required");

  const preCheck = await Repo.findRequestById(requestId);
  if (!preCheck) throw new ServiceError("Regularization request not found", 404);
  const targetUser = await Repo.findUserById(preCheck.userId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  await sequelize.transaction(async (t) => {
    const locked = await Repo.findRequestByIdForUpdate(requestId, t);
    if (!locked) throw new ServiceError("Regularization request not found", 404);
    if (locked.status !== "pending") {
      throw new ServiceError("This request has already been reviewed", 409, {
        code: "REGULARIZATION_ALREADY_REVIEWED",
        status: locked.status,
      });
    }
    await Repo.updateRequestStatus(requestId, "rejected", callerId, trimmedComment, t);
  });

  Repo.createAuditLog({
    userId: preCheck.userId,
    companyId: preCheck.companyId,
    actorId: callerId,
    eventType: "REQUEST_REJECTED",
    regularizationRequestId: requestId,
    message: trimmedComment,
  });

  notifyRegularizationReviewed(preCheck.userId, requestId, false, trimmedComment);

  return { requestId, status: "rejected" as const };
};

// ── Notifications — reuses the existing sendNotification pipeline (DB +
// Socket.IO "notification" event), same as attendanceSecurity.service.ts.
// Fire-and-forget: a notification failure must never block the request
// that triggered it. ─────────────────────────────────────────────────────
// Recipients: company admins always (existing behavior, unchanged) — PLUS,
// when the requester is a sale_person, their direct manager too (§22's
// "Sale Person → Manager → Admin" hierarchy), reusing getDirectCreator
// (userHierarchy.ts) rather than inventing a second hierarchy lookup. A
// Set dedupes the rare case where the direct creator IS the admin (no
// manager in between) so that admin isn't notified twice.
const notifyRegularizationCreated = (
  userId: number,
  requesterRole: string | undefined,
  companyId: number | null,
  requestId: number,
  requestType: string,
  attendanceDate: string
): void => {
  (async () => {
    const [user, adminIds, directCreator] = await Promise.all([
      Repo.findUserById(userId),
      getCompanyAdminIds(companyId),
      requesterRole === "sale_person" ? getDirectCreator(userId) : Promise.resolve(null),
    ]);

    const receiverIds = new Set<number>(adminIds);
    if (directCreator) receiverIds.add(directCreator.id);
    if (receiverIds.size === 0) return;

    const userLabel = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : `User #${userId}`;
    const label = REQUEST_TYPE_LABELS[requestType] ?? requestType;
    await Promise.all(
      Array.from(receiverIds).map((receiverId) =>
        sendNotification({
          receiverId,
          senderId: userId,
          type: NotificationType.SYSTEM,
          title: "Attendance Regularization Request",
          body: `${userLabel} submitted a "${label}" regularization request for ${attendanceDate}.`,
          data: { kind: "attendance_regularization_request", requestId, userId },
        })
      )
    );
  })().catch((err) => console.error("attendanceRegularization: admin notification failed:", err));
};

const notifyRegularizationReviewed = (userId: number, requestId: number, approved: boolean, comment?: string | null): void => {
  sendNotification({
    receiverId: userId,
    type: NotificationType.SYSTEM,
    title: approved ? "Regularization Approved" : "Regularization Rejected",
    body: approved
      ? "Your attendance regularization request has been approved and your attendance has been updated."
      : `Your attendance regularization request was rejected.${comment ? ` Reason: ${comment}` : ""}`,
    data: { kind: "attendance_regularization_reviewed", requestId, approved },
  }).catch((err) => console.error("attendanceRegularization: user notification failed:", err));
};
