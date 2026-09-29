import { sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import * as SubscriptionRepo from "../subscription/subscription.repository";
import {
  getActiveSubscriptionForUser,
  getUsageSummary,
  getOwningTenantUserId,
} from "../subscription/subscriptionLimit.service";
import * as AccessNotify from "./accessNotification.service";
import * as ExtRepo from "./accessExtension.repository";

// ============================================================
// Tenant-side access management: "what is my access status" plus the two
// request workflows a tenant can start (more time, or a higher employee
// cap). Super-Admin-side control of the same data lives in
// superAdmin.service.ts.
//
// TENANT RESOLUTION IS THE SECURITY BOUNDARY HERE. Every function takes only
// the caller's own id/role — both read off the verified JWT by the
// controller — and resolves the tenant those belong to via
// getOwningTenantUserId, which reads the CALLER'S OWN users row. No function
// in this file accepts a tenantId/ownerUserId/userId from the request, so
// there is no id for a caller to tamper with: an admin who swaps any value
// in the body or URL still only ever reads and writes their own tenant's
// subscription. That is also why listMyExtensionRequests scopes on the
// resolved tenant rather than on "requests I personally filed".
// ============================================================

// Who may see and act on a tenant's access. The owner ("user") can do both;
// an admin runs the hiring that hits the employee cap first, so they can see
// the numbers and ask for more — but neither can change a limit or expiry,
// which stays Super Admin only (see accessExtension.routes.ts). Manager and
// employee are excluded: they can neither act on nor fix an access problem.
const ACCESS_VIEWER_ROLES = ["user", "admin"];

type RequestType = "duration" | "employee_limit";

const MAX_REQUEST_DAYS = 365;
// Sanity ceiling on a single ask, so a typo ("5000" for "50") cannot land a
// pending request that a Super Admin might approve with one click.
const MAX_EMPLOYEE_LIMIT = 100000;

const remainingDaysFor = (endDate: Date | string) =>
  Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

// Mirrors superAdmin.service.ts's deriveEffectiveStatus so a tenant and a
// Super Admin never disagree about the same subscription. The stored column
// remains the authority for "has access been cut off"; EXPIRING_SOON is a
// derived, display-only refinement of a still-live row.
const EXPIRING_SOON_THRESHOLD_DAYS = 7;

const deriveEffectiveStatus = (subscription: any): string => {
  if (["CANCELLED", "PAYMENT_FAILED", "SUSPENDED"].includes(subscription.status)) return subscription.status;
  if (subscription.status === "EXPIRED") return "EXPIRED";
  const remaining = remainingDaysFor(subscription.endDate);
  if (remaining < 0) return "EXPIRED";
  if (remaining <= EXPIRING_SOON_THRESHOLD_DAYS) return "EXPIRING_SOON";
  return subscription.status;
};

// Resolves + authorizes in one step: returns the tenant whose access this
// caller is entitled to see, or throws. Never consults the request.
const resolveViewableTenant = async (callerId: number, callerRole: string | undefined): Promise<number> => {
  if (!callerRole || !ACCESS_VIEWER_ROLES.includes(callerRole)) {
    throw new ServiceError("You are not authorised to view access information", 403);
  }
  const tenantUserId = await getOwningTenantUserId(callerId, callerRole);
  if (!tenantUserId) {
    throw new ServiceError("No organisation is associated with your account", 404);
  }
  return tenantUserId;
};

// GET /admin/access-status — the caller's OWN tenant's access, usage and
// outstanding requests. Identical payload for the owner and for an admin
// apart from `isOwner`, because both are looking at the same subscription.
export const getMyAccessStatus = async (callerId: number, callerRole: string | undefined) => {
  const tenantUserId = await resolveViewableTenant(callerId, callerRole);
  const isOwner = callerRole === "user";

  const subscription = await getActiveSubscriptionForUser(tenantUserId);
  if (!subscription) {
    // A tenant with no subscription row is grandfathered/unrestricted (see
    // subscriptionLimit.service.ts's getBlockedTenantStatus) — report that
    // plainly rather than inventing an expiry the backend won't enforce.
    return {
      isOwner,
      canRequest: false,
      subscription: null,
      usage: null,
      access: null,
      pendingExtensionRequest: null,
      pendingRequests: { duration: null, employeeLimit: null },
    };
  }

  const [usage, pending, plan] = await Promise.all([
    getUsageSummary(tenantUserId).catch(() => null),
    ExtRepo.findPendingRequestsForOwner(tenantUserId),
    subscription.planId ? SubscriptionRepo.findPlanById(subscription.planId) : Promise.resolve(null),
  ]);

  const effectiveStatus = deriveEffectiveStatus(subscription);
  // Admins, managers and employees share one limit, so report the combined count.
  const employees = usage?.users ?? null;

  const pendingByType = (type: RequestType) => {
    const row: any = (pending as any[]).find((r: any) => r.requestType === type);
    return row
      ? {
          id: row.id,
          publicId: row.publicId,
          requestType: row.requestType,
          requestedDurationDays: row.requestedDurationDays,
          currentEmployeeLimit: row.currentEmployeeLimit,
          requestedEmployeeLimit: row.requestedEmployeeLimit,
          reason: row.reason,
          createdAt: row.createdAt,
        }
      : null;
  };

  return {
    isOwner,
    // Both the owner and an admin may ASK; only Super Admin may grant.
    canRequest: true,
    subscription: {
      id: subscription.id,
      plan: plan ? { id: plan.get("id"), name: plan.get("name"), planCode: plan.get("planCode") } : null,
      status: subscription.status,
      effectiveStatus,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      remainingDays: remainingDaysFor(subscription.endDate),
    },
    usage,
    // Flattened employee-centric view, so the Access Management card renders
    // limit/used/available without recomputing the subtraction itself (and
    // possibly getting a different answer than the backend enforces).
    access: {
      accessStatus: effectiveStatus,
      accessStartDate: subscription.startDate,
      accessExpiryDate: subscription.endDate,
      remainingDays: remainingDaysFor(subscription.endDate),
      employeeLimit: employees ? employees.limit : null,
      employeeCount: employees ? employees.used : null,
      employeesAvailable:
        employees && employees.limit !== null ? Math.max(0, employees.limit - employees.used) : null,
    },
    // Retained for the pre-0033 frontend contract (a single "the pending
    // extension request" field); pendingRequests carries both kinds.
    pendingExtensionRequest: pendingByType("duration"),
    pendingRequests: {
      duration: pendingByType("duration"),
      employeeLimit: pendingByType("employee_limit"),
    },
  };
};

// ============================================================
// Request submission
// ============================================================
// Two kinds (see app/model/accessExtensionRequest.ts):
//   duration       — more time before the subscription's endDate cuts us off
//   employee_limit — a higher maxEmployees cap
//
// Both are filed AGAINST the caller's resolved tenant (ownerUserId) and
// attributed TO the caller (requestedByUserId), so an admin's request is
// visible to the owner and reviewable by Super Admin without the admin ever
// naming a tenant.
export const submitExtensionRequest = async (
  callerId: number,
  callerRole: string | undefined,
  body: any
) => {
  const tenantUserId = await resolveViewableTenant(callerId, callerRole);

  const requestType: RequestType = body?.requestType === "employee_limit" ? "employee_limit" : "duration";

  const reason = body?.reason;
  if (!reason || !String(reason).trim()) {
    throw new ServiceError("A reason is required");
  }

  const subscription = await getActiveSubscriptionForUser(tenantUserId);
  if (!subscription) {
    throw new ServiceError(
      "No subscription is on record for your organisation. Please contact support.",
      400,
      { code: "NO_SUBSCRIPTION" }
    );
  }

  const row: any = {
    requestedByUserId: callerId,
    ownerUserId: tenantUserId,
    subscriptionId: subscription.id,
    requestType,
    reason: String(reason).trim(),
    status: "pending",
    previousExpiresAt: subscription.endDate ?? null,
  };

  if (requestType === "duration") {
    const days = Number(body?.requestedDurationDays);
    if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
      throw new ServiceError("requestedDurationDays must be a positive whole number of days");
    }
    if (days > MAX_REQUEST_DAYS) {
      throw new ServiceError(`requestedDurationDays cannot exceed ${MAX_REQUEST_DAYS} days in a single request`);
    }
    row.requestedDurationDays = days;
  } else {
    const currentLimit = subscription.maxEmployees;
    if (currentLimit === null || currentLimit === undefined) {
      throw new ServiceError(
        "Your employee limit is already unlimited — there is nothing to increase.",
        400,
        { code: "LIMIT_ALREADY_UNLIMITED" }
      );
    }
    const requested = Number(body?.requestedEmployeeLimit);
    if (!Number.isFinite(requested) || !Number.isInteger(requested) || requested <= 0) {
      throw new ServiceError("requestedEmployeeLimit must be a positive whole number");
    }
    if (requested <= currentLimit) {
      throw new ServiceError(
        `requestedEmployeeLimit must be greater than your current limit of ${currentLimit}`
      );
    }
    if (requested > MAX_EMPLOYEE_LIMIT) {
      throw new ServiceError(`requestedEmployeeLimit cannot exceed ${MAX_EMPLOYEE_LIMIT}`);
    }
    // Snapshotted so a Super Admin reviewing this later sees what the limit
    // was WHEN IT WAS ASKED FOR, even if it moved in between.
    row.currentEmployeeLimit = currentLimit;
    row.requestedEmployeeLimit = requested;
  }

  // Belt-and-suspenders: the partial unique index on
  // (ownerUserId, requestType) WHERE status='pending' (migration 0033) is
  // the real guarantee against a duplicate-submit race; this check just
  // turns the common non-concurrent case into a clean message instead of a
  // raw constraint violation.
  const existingPending = await ExtRepo.findPendingRequestForOwner(tenantUserId, requestType);
  if (existingPending) {
    throw new ServiceError(alreadyPendingMessage(requestType), 400, { code: "EXTENSION_ALREADY_PENDING" });
  }

  let created: any;
  try {
    created = await ExtRepo.createRequest(row);
  } catch (e: any) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      throw new ServiceError(alreadyPendingMessage(requestType), 400, { code: "EXTENSION_ALREADY_PENDING" });
    }
    throw e;
  }

  await ExtRepo.writeAuditLog({
    entityType: "extension_request",
    entityId: created.id,
    action: requestType === "employee_limit" ? "limit_increase_requested" : "extension_requested",
    actorId: callerId,
    actorRole: callerRole ?? null,
    previousValue:
      requestType === "employee_limit"
        ? { maxEmployees: row.currentEmployeeLimit }
        : { endDate: subscription.endDate },
    newValue:
      requestType === "employee_limit"
        ? { maxEmployees: row.requestedEmployeeLimit }
        : { requestedDurationDays: row.requestedDurationDays },
    reason: row.reason,
  }).catch((e) => console.error("[access-audit] failed to log request submission:", e));

  // Puts the request in every Super Admin's queue. Best-effort by design —
  // see accessNotification.service.ts.
  await AccessNotify.notifySuperAdminsOfRequest({
    requesterName: await describeRequester(callerId),
    requestId: created.id,
    requestType,
    detail:
      requestType === "employee_limit"
        ? `raise the employee limit from ${row.currentEmployeeLimit} to ${row.requestedEmployeeLimit}`
        : `extend access by ${row.requestedDurationDays} day(s)`,
    actorId: callerId,
  }).catch(() => undefined);

  return created;
};

const alreadyPendingMessage = (requestType: RequestType) =>
  requestType === "employee_limit"
    ? "Your organisation already has a pending employee limit request"
    : "Your organisation already has a pending extension request";

// Name/email for the Super Admin's queue notification. Only ever the
// CALLER's own record, so this exposes nothing cross-tenant.
const describeRequester = async (callerId: number): Promise<string> => {
  const u: any = await SubscriptionRepo.findUserForTenantResolution(callerId).catch(() => null);
  if (!u) return `User #${callerId}`;
  return `${u.get("role")} #${callerId}`;
};

// Tenant-scoped history: the resolved tenant's requests, whoever within that
// tenant filed them.
export const listMyExtensionRequests = async (
  callerId: number,
  callerRole: string | undefined,
  page: number,
  limit: number,
  offset: number
) => {
  const tenantUserId = await resolveViewableTenant(callerId, callerRole);
  const { rows, count } = await ExtRepo.findRequestsForOwnerPaginated(tenantUserId, limit, offset);
  return {
    data: rows,
    pagination: { totalRecords: count, totalPages: Math.ceil(count / limit) || 1, currentPage: page, limit },
  };
};

export const listAllExtensionRequests = async (
  filters: { status?: string; requestType?: string },
  page: number,
  limit: number,
  offset: number
) => {
  const { rows, count } = await ExtRepo.findAllRequestsPaginated({ ...filters, limit, offset });
  return {
    data: rows,
    pagination: { totalRecords: count, totalPages: Math.ceil(count / limit) || 1, currentPage: page, limit },
  };
};

// ============================================================
// Review (Super Admin only — enforced by authorizeRoles on the route)
// ============================================================
// Both approve and reject run inside a transaction with the request row —
// and, on approval, the subscription row — locked FOR UPDATE, so two
// concurrent reviews of the same request cannot both proceed (double-
// extending the expiry, or applying a limit twice) or leave the request and
// the subscription disagreeing. Mirrors leave.service.ts's approveLeave.
export const approveExtensionRequest = async (
  superAdminId: number,
  requestId: number,
  reviewComment: string | undefined,
  overrides?: { approvedEmployeeLimit?: number }
) => {
  const result = await sequelize.transaction(async (t) => {
    const request: any = await ExtRepo.findRequestByIdForUpdate(requestId, t);
    if (!request) throw new ServiceError("Extension request not found", 404);
    if (request.status !== "pending") {
      throw new ServiceError(`This request has already been ${request.status}`, 400, { code: "ALREADY_REVIEWED" });
    }
    if (!request.subscriptionId) {
      // Shouldn't happen post migration-0029 backfill, but fail safe rather
      // than "approving" something with nothing to apply the change to.
      throw new ServiceError("This request has no associated subscription to update", 400);
    }

    const subscription: any = await ExtRepo.findSubscriptionByIdForUpdate(request.subscriptionId, t);
    if (!subscription) {
      throw new ServiceError("The subscription this request belongs to no longer exists", 404);
    }

    const subscriptionBefore = {
      status: subscription.status,
      endDate: subscription.endDate,
      maxEmployees: subscription.maxEmployees,
    };

    let approvedExpiresAt: Date | null = null;
    let approvedEmployeeLimit: number | null = null;
    const subscriptionFields: any = {};

    if (request.requestType === "employee_limit") {
      // A Super Admin may grant a different number than was asked for
      // (approve 60 against a request for 75) — validated the same way the
      // request was, and still required to be a real increase on the CURRENT
      // limit, not on the snapshot taken at request time.
      const asked = Number(request.requestedEmployeeLimit);
      const granted =
        overrides?.approvedEmployeeLimit !== undefined ? Number(overrides.approvedEmployeeLimit) : asked;

      if (!Number.isFinite(granted) || !Number.isInteger(granted) || granted <= 0) {
        throw new ServiceError("approvedEmployeeLimit must be a positive whole number");
      }
      if (granted > MAX_EMPLOYEE_LIMIT) {
        throw new ServiceError(`approvedEmployeeLimit cannot exceed ${MAX_EMPLOYEE_LIMIT}`);
      }
      const currentLimit = subscription.maxEmployees;
      if (currentLimit !== null && currentLimit !== undefined && granted <= currentLimit) {
        throw new ServiceError(
          `This tenant's employee limit is already ${currentLimit}; approving ${granted} would not raise it.`,
          400,
          { code: "LIMIT_NOT_AN_INCREASE" }
        );
      }

      approvedEmployeeLimit = granted;
      subscriptionFields.maxEmployees = granted;
    } else {
      // Extend from whichever is later: the current expiry (still live — the
      // extension adds on top of remaining time) or now (already expired —
      // the extension counts from today, so the "new" expiry isn't still in
      // the past).
      const base = new Date(Math.max(new Date(subscription.endDate).getTime(), Date.now()));
      approvedExpiresAt = new Date(base.getTime() + Number(request.requestedDurationDays) * 24 * 60 * 60 * 1000);
      subscriptionFields.endDate = approvedExpiresAt;

      if (["EXPIRED", "CANCELLED", "PAST_DUE"].includes(subscription.status)) {
        subscriptionFields.status = "ACTIVE";
      }
    }

    await subscription.update(subscriptionFields, { transaction: t });

    await ExtRepo.writeAuditLog({
      entityType: "subscription",
      entityId: subscription.id,
      action: request.requestType === "employee_limit" ? "limit_increase_approved" : "extension_approved",
      actorId: superAdminId,
      actorRole: "super_admin",
      previousValue: subscriptionBefore,
      newValue: { ...subscriptionBefore, ...subscriptionFields },
      reason: reviewComment || null,
    });

    await request.update(
      {
        status: "approved",
        reviewedBy: superAdminId,
        reviewedAt: new Date(),
        reviewComment: reviewComment || null,
        approvedExpiresAt,
        approvedEmployeeLimit,
      },
      { transaction: t }
    );

    await ExtRepo.writeAuditLog({
      entityType: "extension_request",
      entityId: request.id,
      action: "approved",
      actorId: superAdminId,
      actorRole: "super_admin",
      previousValue: { status: "pending" },
      newValue: { status: "approved", approvedExpiresAt, approvedEmployeeLimit },
      reason: reviewComment || null,
    });

    return {
      request,
      ownerUserId: Number(request.ownerUserId),
      approvedExpiresAt,
      approvedEmployeeLimit,
      requestType: String(request.requestType),
    };
  });

  // Notified only after the transaction has COMMITTED — a message promising
  // a new limit must never go out for a change that then rolled back.
  await AccessNotify.notifyRequestReviewed({
    ownerUserId: result.ownerUserId,
    actorId: superAdminId,
    requestId: result.request.id,
    requestType: result.requestType,
    approved: true,
    newEmployeeLimit: result.approvedEmployeeLimit,
    newExpiresAt: result.approvedExpiresAt,
    reviewComment,
  }).catch(() => undefined);

  return result.request;
};

export const rejectExtensionRequest = async (
  superAdminId: number,
  requestId: number,
  reviewComment: string | undefined
) => {
  const result = await sequelize.transaction(async (t) => {
    const request: any = await ExtRepo.findRequestByIdForUpdate(requestId, t);
    if (!request) throw new ServiceError("Extension request not found", 404);
    if (request.status !== "pending") {
      throw new ServiceError(`This request has already been ${request.status}`, 400, { code: "ALREADY_REVIEWED" });
    }

    await request.update(
      {
        status: "rejected",
        reviewedBy: superAdminId,
        reviewedAt: new Date(),
        reviewComment: reviewComment || null,
      },
      { transaction: t }
    );

    await ExtRepo.writeAuditLog({
      entityType: "extension_request",
      entityId: request.id,
      action: "rejected",
      actorId: superAdminId,
      actorRole: "super_admin",
      previousValue: { status: "pending" },
      newValue: { status: "rejected" },
      reason: reviewComment || null,
    });

    return { request, ownerUserId: Number(request.ownerUserId), requestType: String(request.requestType) };
  });

  await AccessNotify.notifyRequestReviewed({
    ownerUserId: result.ownerUserId,
    actorId: superAdminId,
    requestId: result.request.id,
    requestType: result.requestType,
    approved: false,
    reviewComment,
  }).catch(() => undefined);

  return result.request;
};
