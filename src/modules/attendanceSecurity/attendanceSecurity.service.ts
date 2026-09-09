import { UniqueConstraintError } from "sequelize";
import { sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { assertCanAct } from "../geoFencing/geoFencing.service";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { getCompanyAdminIds } from "../shared/userHierarchy";
import * as Repo from "./attendanceSecurity.repository";

// ============================================================
// Attendance Security — photo capture, device binding, and punch-out
// geofencing toggles, plus the device-change approval workflow and audit
// log. Called from attendance.service.ts's attendancePunchIn/
// attendancePunchOut (see the enforcement points there) and from the
// admin-facing attendanceSecurity.routes.ts.
//
// IMPORTANT: like geoFencing.service.ts's checkUserGeoFencing, the two
// enforcement functions here (getUserSecurityFlags, checkDeviceSecurity)
// must only ever be called from the attendance punch flow — never a
// general access gate.
// ============================================================

export interface UserSecurityFlags {
  isAttendancePhotoRequired: boolean;
  isDeviceSecurityRequired: boolean;
  isGeofenceRequired: boolean;
  isPunchOutGeofenceRequired: boolean;
}

const ALLOWED_SETTINGS_KEYS = [
  "isAttendancePhotoRequired",
  "isDeviceSecurityRequired",
  "isGeofenceRequired",
  "isPunchOutGeofenceRequired",
] as const;

const toPublicSettings = (user: any) => ({
  userId: user?.id,
  isAttendancePhotoRequired: !!user?.isAttendancePhotoRequired,
  isDeviceSecurityRequired: !!user?.isDeviceSecurityRequired,
  // isGeofenceRequired defaults true at the DB level (matches its existing
  // semantics elsewhere) — only treat an explicit false as "off".
  isGeofenceRequired: user?.isGeofenceRequired !== false,
  isPunchOutGeofenceRequired: !!user?.isPunchOutGeofenceRequired,
});

// ── Read-only: flags used by the punch-in/out enforcement points ──────────
export const getUserSecurityFlags = async (userId: number): Promise<UserSecurityFlags> => {
  const user = await Repo.findUserSecurityFlags(userId);
  return {
    isAttendancePhotoRequired: !!(user as any)?.isAttendancePhotoRequired,
    isDeviceSecurityRequired: !!(user as any)?.isDeviceSecurityRequired,
    isGeofenceRequired: (user as any)?.isGeofenceRequired !== false,
    isPunchOutGeofenceRequired: !!(user as any)?.isPunchOutGeofenceRequired,
  };
};

// ============================================================
// Deterministic, single-request device state machine — no loop, no
// polling. Called once per punch-in/punch-out when isDeviceSecurityRequired
// is true for the user. Throws a ServiceError (with a structured `meta`
// payload the frontend can branch on) to block; returns normally to allow.
// ============================================================
export const checkDeviceSecurity = async (
  userId: number,
  companyId: number | null,
  deviceId: string | undefined,
  deviceName: string | undefined,
  deviceType: string | undefined
): Promise<{ deviceStatus: "trusted_new" | "trusted" }> => {
  if (!deviceId) {
    throw new ServiceError("A device identifier is required to mark attendance.", 400, {
      code: "DEVICE_ID_MISSING",
    });
  }

  const trusted = await Repo.findTrustedDevice(userId);

  // No trusted device yet — first-ever attendance action from this user
  // registers whatever device they're using now.
  if (!trusted) {
    await Repo.createTrustedDevice(userId, companyId, deviceId, deviceName, deviceType);
    logSecurityEvent({
      userId,
      companyId,
      actorId: userId,
      eventType: "DEVICE_REGISTERED",
      metadata: { deviceId, deviceName, deviceType },
    });
    return { deviceStatus: "trusted_new" };
  }

  // Same device as already trusted — allow, refresh lastSeenAt.
  if (trusted.deviceId === deviceId) {
    Repo.touchTrustedDevice(trusted.id).catch(() => {});
    return { deviceStatus: "trusted" };
  }

  // A different device — look up the latest change-request for this exact
  // (userId, deviceId) pair.
  const existing = await Repo.findLatestRequestForDevice(userId, deviceId);

  if (existing?.status === "pending") {
    throw new ServiceError(
      "This device is still awaiting admin approval. Please use your trusted device, or wait for approval.",
      403,
      { code: "DEVICE_CHANGE_PENDING", action: "REQUEST_DEVICE_APPROVAL", requestId: existing.id }
    );
  }

  if (existing?.status === "rejected") {
    throw new ServiceError(
      "This device was not approved by your admin. Please use your trusted device or contact your admin.",
      403,
      { code: "DEVICE_CHANGE_REJECTED", action: "CONTACT_ADMIN", requestId: existing.id }
    );
  }

  // Either there's no request on file for this device at all, or the only
  // one is a STALE "approved" row from before trust moved to a different
  // device since. (approveDeviceRequest promotes the trusted device
  // directly as part of approval — if this were still the current trusted
  // device, the "same device as trusted" branch above would already have
  // returned. Reaching here at all means it isn't the current one anymore,
  // e.g. device A -> approved, then device B -> approved supersedes it, and
  // A is tried again later.) A past approval is not a standing grant that
  // survives the device being superseded — treat this exactly like a device
  // with no history and require a fresh admin decision. Previously this
  // fell through to silently re-trusting device A off its old approval,
  // which let a revoked device walk back in with no new approval at all.
  //
  // The check above and this insert aren't atomic — two near-simultaneous
  // punch attempts from the same unrecognized device (double-tap, client
  // retry) can both reach here before either commits. The partial unique
  // index (idx_adcr_one_pending_per_device, migration 0017) makes the
  // second insert fail rather than create a duplicate PENDING row; when
  // that happens, fall back to whichever row actually won the race and
  // treat this call exactly like the "already pending" branch above — no
  // second audit log, no second admin notification.
  let created;
  try {
    created = await Repo.createDeviceChangeRequest(userId, companyId, deviceId, deviceName, deviceType, trusted.deviceId);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const winner = await Repo.findLatestRequestForDevice(userId, deviceId);
      if (winner) {
        throw new ServiceError(
          "This device is still awaiting admin approval. Please use your trusted device, or wait for approval.",
          403,
          { code: "DEVICE_CHANGE_PENDING", action: "REQUEST_DEVICE_APPROVAL", requestId: winner.id }
        );
      }
    }
    throw err;
  }

  logSecurityEvent({ userId, companyId, actorId: userId, eventType: "DEVICE_CHANGE_DETECTED", metadata: { deviceId } });
  logSecurityEvent({
    userId,
    companyId,
    actorId: userId,
    eventType: "DEVICE_CHANGE_REQUESTED",
    deviceChangeRequestId: created.id,
  });
  notifyDeviceChangeRequested(userId, companyId, created.id, deviceName);
  throw new ServiceError(
    "This device isn't recognized. A request to use it has been sent to your admin for approval.",
    403,
    { code: "DEVICE_CHANGE_PENDING", action: "REQUEST_DEVICE_APPROVAL", requestId: created.id }
  );
};

// ── Settings: self / single-user / bulk ────────────────────────────────────
export const getMySettings = async (userId: number) => {
  const user = await Repo.findUserById(userId);
  if (!user) throw new ServiceError("User not found", 404);
  return toPublicSettings(user);
};

// "My Device Requests" status view — self-service, no admin/hierarchy check
// needed since it's hard-scoped to the caller's own userId (derived from the
// authenticated session, never client-supplied). Shows the same information
// PunchWidget's blocked-attendance toast points the user at: their current
// trusted device plus their own request history (pending/approved/rejected)
// with the admin's response, so they aren't left guessing after a punch is
// blocked.
export const getMyDeviceRequests = async (userId: number, opts: { page?: number; limit?: number }) => {
  const [trustedDevice, { rows, count }] = await Promise.all([
    Repo.findTrustedDevice(userId),
    Repo.findDeviceRequestsForUser(userId, opts),
  ]);
  return { trustedDevice, rows, total: count };
};

export const getSettingsForUser = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number
) => {
  const targetUser = await Repo.findUserById(targetUserId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });
  return {
    settings: toPublicSettings(targetUser),
    targetUser: {
      id: targetUser.id,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      role: targetUser.role,
    },
  };
};

const filterAllowedSettings = (settings: Record<string, any>) => {
  const patch: Record<string, any> = {};
  for (const key of ALLOWED_SETTINGS_KEYS) {
    if (settings[key] !== undefined) patch[key] = Boolean(settings[key]);
  }
  return patch;
};

export const updateSettingsForUser = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number,
  settings: Record<string, any>
) => {
  const targetUser = await Repo.findUserById(targetUserId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  const patch = filterAllowedSettings(settings);
  if (Object.keys(patch).length === 0) {
    throw new ServiceError("No valid settings provided");
  }

  Object.assign(targetUser, patch);
  await targetUser.save();

  logSecurityEvent({
    userId: targetUserId,
    companyId: callerCompanyId,
    actorId: callerId,
    eventType: "SETTINGS_UPDATED",
    metadata: { changedFields: patch },
  });

  return toPublicSettings(targetUser);
};

export const bulkUpdateSettings = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  userIds: number[],
  settings: Record<string, any>
) => {
  const patch = filterAllowedSettings(settings);
  if (Object.keys(patch).length === 0) {
    throw new ServiceError("No valid settings provided");
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ServiceError("At least one userId is required");
  }

  const allowedIds: number[] = [];
  const skipped: { userId: number; reason: string }[] = [];

  for (const uid of userIds) {
    try {
      const target = await Repo.findUserById(uid);
      if (!target) {
        skipped.push({ userId: uid, reason: "User not found" });
        continue;
      }
      await assertCanAct(callerId, callerRole, callerCompanyId, target, { requireOwnCapability: false });
      allowedIds.push(uid);
    } catch (e) {
      skipped.push({ userId: uid, reason: e instanceof ServiceError ? e.message : "Not permitted" });
    }
  }

  if (allowedIds.length > 0) {
    await sequelize.transaction(async (t) => {
      await Repo.bulkUpdateUserSettings(allowedIds, patch, t);
    });
    allowedIds.forEach((uid) =>
      logSecurityEvent({
        userId: uid,
        companyId: callerCompanyId,
        actorId: callerId,
        eventType: "SETTINGS_BULK_UPDATED",
        metadata: { changedFields: patch },
      })
    );
  }

  return { updated: allowedIds.length, skipped };
};

// ── Device-request review + revoke ─────────────────────────────────────────
export const getDeviceRequests = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  opts: { status?: string; page?: number; limit?: number }
) => {
  // super_admin sees every company's requests; everyone else is scoped to
  // their own company (mirrors geoFencing's global-vs-company-scoped split).
  const companyId = callerRole === "super_admin" ? undefined : callerCompanyId;
  const { rows, count } = await Repo.findDeviceRequests({
    companyId: companyId ?? undefined,
    status: opts.status,
    page: opts.page,
    limit: opts.limit,
  });

  // Enrich with the requesting user's name/email — the admin list needs
  // "Sumeet Kumar", not just a bare userId.
  const userIdSet = new Set<number>();
  rows.forEach((r: any) => userIdSet.add(Number(r.userId)));
  const userIds: number[] = Array.from(userIdSet);
  const users = userIds.length > 0 ? await Repo.findUsersByIds(userIds) : [];
  const userById = new Map(users.map((u: any) => [u.id, u]));
  const enriched = rows.map((r: any) => ({
    ...r.get({ plain: true }),
    user: userById.get(r.userId) ?? null,
  }));

  return { rows: enriched, total: count };
};

export const getDeviceRequestDetail = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  requestId: number
) => {
  const request = await Repo.findDeviceRequestById(requestId);
  if (!request) throw new ServiceError("Device change request not found", 404);

  const targetUser = await Repo.findUserById(request.userId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  const trusted = await Repo.findTrustedDevice(request.userId);
  const { rows: recentAudit } = await Repo.findAuditLogs({ userId: request.userId, limit: 20 });

  return { request, targetUser, currentTrustedDevice: trusted, recentAudit };
};

export const approveDeviceRequest = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  requestId: number,
  note?: string
) => {
  // Existence + permission check up front — a 404/403 shouldn't hold a row
  // lock, and assertCanAct needs the target user regardless of the race
  // below.
  const preCheck = await Repo.findDeviceRequestById(requestId);
  if (!preCheck) throw new ServiceError("Device change request not found", 404);
  const targetUser = await Repo.findUserById(preCheck.userId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  // The actual state transition, atomically: lock the row, re-verify it's
  // still pending (another admin/tab may have reviewed it since preCheck
  // above), then flip status + promote the trusted device together. Any
  // failure here rolls back both writes — no partial "status approved but
  // device not promoted" state.
  const request = await sequelize.transaction(async (t) => {
    const locked = await Repo.findDeviceRequestByIdForUpdate(requestId, t);
    if (!locked) throw new ServiceError("Device change request not found", 404);
    if (locked.status !== "pending") {
      throw new ServiceError("This request has already been reviewed", 409, {
        code: "REQUEST_ALREADY_REVIEWED",
        status: locked.status,
      });
    }

    await Repo.updateDeviceRequestStatus(requestId, "approved", callerId, note, t);
    await Repo.replaceTrustedDevice(
      locked.userId,
      locked.companyId,
      locked.requestedDeviceId,
      locked.requestedDeviceName,
      locked.requestedDeviceType,
      t
    );
    return locked;
  });

  logSecurityEvent({
    userId: request.userId,
    companyId: request.companyId,
    actorId: callerId,
    eventType: "DEVICE_CHANGE_APPROVED",
    deviceChangeRequestId: requestId,
  });
  notifyUserDeviceRequestReviewed(request.userId, requestId, true);

  return { requestId, status: "approved" as const };
};

export const rejectDeviceRequest = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  requestId: number,
  reason?: string
) => {
  const preCheck = await Repo.findDeviceRequestById(requestId);
  if (!preCheck) throw new ServiceError("Device change request not found", 404);
  const targetUser = await Repo.findUserById(preCheck.userId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  // Same lock-then-verify pattern as approveDeviceRequest — prevents a
  // reject racing an approve (or a second reject) on the same request.
  const request = await sequelize.transaction(async (t) => {
    const locked = await Repo.findDeviceRequestByIdForUpdate(requestId, t);
    if (!locked) throw new ServiceError("Device change request not found", 404);
    if (locked.status !== "pending") {
      throw new ServiceError("This request has already been reviewed", 409, {
        code: "REQUEST_ALREADY_REVIEWED",
        status: locked.status,
      });
    }

    await Repo.updateDeviceRequestStatus(requestId, "rejected", callerId, reason, t);
    return locked;
  });

  logSecurityEvent({
    userId: request.userId,
    companyId: request.companyId,
    actorId: callerId,
    eventType: "DEVICE_CHANGE_REJECTED",
    deviceChangeRequestId: requestId,
  });
  notifyUserDeviceRequestReviewed(request.userId, requestId, false, reason);

  return { requestId, status: "rejected" as const };
};

export const revokeTrustedDevice = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number
) => {
  const targetUser = await Repo.findUserById(targetUserId);
  if (!targetUser) throw new ServiceError("User not found", 404);
  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  await Repo.deleteTrustedDevice(targetUserId);

  logSecurityEvent({
    userId: targetUserId,
    companyId: callerCompanyId,
    actorId: callerId,
    eventType: "DEVICE_REVOKED",
  });

  return { userId: targetUserId, revoked: true };
};

// ── Real-time notifications ─────────────────────────────────────────────────
// Reuses the existing app-wide notification pipeline (DB persist + the
// same Socket.IO "notification" event NotificationContext.jsx already
// listens on) — no separate socket connection or event name. Both helpers
// are fire-and-forget: a notification failure must never surface as an
// attendance-punch or admin-approval failure to the caller who triggered it.

const notifyDeviceChangeRequested = (
  userId: number,
  companyId: number | null,
  requestId: number,
  deviceName?: string | null
): void => {
  (async () => {
    const [user, adminIds] = await Promise.all([Repo.findUserById(userId), getCompanyAdminIds(companyId)]);
    if (adminIds.length === 0) return;
    const userLabel = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : `User #${userId}`;
    await Promise.all(
      adminIds.map((adminId) =>
        sendNotification({
          receiverId: adminId,
          senderId: userId,
          type: NotificationType.SYSTEM,
          title: "Device Change Request",
          body: `${userLabel} is trying to mark attendance from a new device${deviceName ? ` (${deviceName})` : ""}.`,
          data: { kind: "device_change_request", requestId, userId },
        })
      )
    );
  })().catch((err) => console.error("attendanceSecurity: admin device-change notification failed:", err));
};

const notifyUserDeviceRequestReviewed = (
  userId: number,
  requestId: number,
  approved: boolean,
  reason?: string | null
): void => {
  sendNotification({
    receiverId: userId,
    type: NotificationType.SYSTEM,
    title: approved ? "Device Change Approved" : "Device Change Rejected",
    body: approved
      ? "Your new device has been approved. You can now mark attendance from this device."
      : `Your device change request was rejected.${reason ? ` Reason: ${reason}` : ""}`,
    data: { kind: "device_change_reviewed", requestId, approved },
  }).catch((err) => console.error("attendanceSecurity: user device-review notification failed:", err));
};

// ── Audit log ─────────────────────────────────────────────────────────────
// Never awaited at any call site — a logging failure must never block a
// legitimate attendance action.
export const logSecurityEvent = (params: {
  userId: number;
  companyId?: number | null;
  actorId?: number | null;
  eventType: string;
  message?: string;
  attendanceId?: number | null;
  deviceChangeRequestId?: number | null;
  metadata?: Record<string, any>;
}): void => {
  Repo.createAuditLog(params).catch((err: any) => {
    console.error("attendanceSecurity: audit log write failed (non-blocking):", err);
  });
};

export const getAuditLog = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  opts: { userId?: number; eventType?: string; page?: number; limit?: number }
) => {
  if (opts.userId != null) {
    const targetUser = await Repo.findUserById(opts.userId);
    if (!targetUser) throw new ServiceError("User not found", 404);
    await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });
  }
  const companyId = callerRole === "super_admin" ? undefined : callerCompanyId;
  const { rows, count } = await Repo.findAuditLogs({
    userId: opts.userId,
    companyId: companyId ?? undefined,
    eventType: opts.eventType,
    page: opts.page,
    limit: opts.limit,
  });
  return { rows, total: count };
};
