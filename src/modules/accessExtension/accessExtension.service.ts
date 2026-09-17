import { sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import * as SubscriptionRepo from "../subscription/subscription.repository";
import { getActiveSubscriptionForUser, getUsageSummary } from "../subscription/subscriptionLimit.service";
import * as ExtRepo from "./accessExtension.repository";

// Tenant-owner-facing "what's my own access status right now" read — the
// self-service counterpart to the Super Admin oversight list. Only "user"
// (the tenant itself) has a subscription of its own to look up.
export const getMyAccessStatus = async (callerId: number, callerRole: string | undefined) => {
  if (callerRole !== "user") {
    throw new ServiceError("Only the account owner has a subscription to view", 403);
  }

  const subscription = await getActiveSubscriptionForUser(callerId);
  if (!subscription) {
    return { subscription: null, usage: null, pendingExtensionRequest: null };
  }

  const usage = await getUsageSummary(callerId).catch(() => null);
  const pending = await ExtRepo.findPendingRequestForOwner(callerId);
  const plan = subscription.planId ? await SubscriptionRepo.findPlanById(subscription.planId) : null;

  return {
    subscription: {
      id: subscription.id,
      plan: plan ? { id: plan.get("id"), name: plan.get("name"), planCode: plan.get("planCode") } : null,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      remainingDays: Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    },
    usage,
    pendingExtensionRequest: pending
      ? { id: pending.id, requestedDurationDays: pending.requestedDurationDays, reason: pending.reason, createdAt: pending.createdAt }
      : null,
  };
};

// ============================================================
// Access-extension workflow: a tenant ("user" role) asks Super Admin for
// more time on their subscription before/after it expires. Every state
// change (approve/reject) runs inside a transaction with the request row
// (and, on approval, the subscription row) locked FOR UPDATE, so a
// duplicate/concurrent review of the same request can't double-extend or
// leave things half-applied — mirrors leave.service.ts's approveLeave.
// ============================================================

const MAX_REQUEST_DAYS = 365;

export const submitExtensionRequest = async (
  callerId: number,
  callerRole: string | undefined,
  body: any
) => {
  // Only the tenant owner ("user") may request more time for their own
  // subscription — an admin/manager/employee has no subscription of their
  // own to extend, and letting them request on the tenant's behalf would
  // need its own delegation/permission model this task doesn't specify.
  if (callerRole !== "user") {
    throw new ServiceError("Only the account owner can request an access extension", 403);
  }

  const { requestedDurationDays, reason } = body || {};
  const days = Number(requestedDurationDays);
  if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
    throw new ServiceError("requestedDurationDays must be a positive whole number of days");
  }
  if (days > MAX_REQUEST_DAYS) {
    throw new ServiceError(`requestedDurationDays cannot exceed ${MAX_REQUEST_DAYS} days in a single request`);
  }
  if (!reason || !String(reason).trim()) {
    throw new ServiceError("A reason is required");
  }

  // Belt-and-suspenders: the partial unique index (migration
  // 0029_access_management.ts) is the real guarantee against a race; this
  // check just gives a clean error instead of a raw constraint-violation
  // for the common, non-concurrent case.
  const existingPending = await ExtRepo.findPendingRequestForOwner(callerId);
  if (existingPending) {
    throw new ServiceError("You already have a pending extension request", 400, { code: "EXTENSION_ALREADY_PENDING" });
  }

  const subscription = await getActiveSubscriptionForUser(callerId);

  let created;
  try {
    created = await ExtRepo.createRequest({
      requestedByUserId: callerId,
      ownerUserId: callerId,
      subscriptionId: subscription?.id ?? null,
      requestedDurationDays: days,
      reason: String(reason).trim(),
      status: "pending",
      previousExpiresAt: subscription?.endDate ?? null,
    });
  } catch (e: any) {
    // Unique-violation race with another in-flight submission for the same
    // owner — translate the raw DB error into the same clean message above.
    if (e?.name === "SequelizeUniqueConstraintError") {
      throw new ServiceError("You already have a pending extension request", 400, { code: "EXTENSION_ALREADY_PENDING" });
    }
    throw e;
  }

  return created;
};

export const listMyExtensionRequests = async (callerId: number, page: number, limit: number, offset: number) => {
  const { rows, count } = await ExtRepo.findRequestsForOwnerPaginated(callerId, limit, offset);
  return { data: rows, pagination: { totalRecords: count, totalPages: Math.ceil(count / limit) || 1, currentPage: page, limit } };
};

export const listAllExtensionRequests = async (status: string | undefined, page: number, limit: number, offset: number) => {
  const { rows, count } = await ExtRepo.findAllRequestsPaginated({ status, limit, offset });
  return { data: rows, pagination: { totalRecords: count, totalPages: Math.ceil(count / limit) || 1, currentPage: page, limit } };
};

export const approveExtensionRequest = async (
  superAdminId: number,
  requestId: number,
  reviewComment: string | undefined
) => {
  return sequelize.transaction(async (t) => {
    const request: any = await ExtRepo.findRequestByIdForUpdate(requestId, t);
    if (!request) throw new ServiceError("Extension request not found", 404);
    if (request.status !== "pending") {
      throw new ServiceError(`This request has already been ${request.status}`, 400, { code: "ALREADY_REVIEWED" });
    }

    let approvedExpiresAt: Date;
    let subscriptionBefore: any = null;

    if (request.subscriptionId) {
      const subscription: any = await ExtRepo.findSubscriptionByIdForUpdate(request.subscriptionId, t);
      if (!subscription) throw new ServiceError("The subscription this request belongs to no longer exists", 404);

      subscriptionBefore = { status: subscription.status, endDate: subscription.endDate };

      // Extend from whichever is later: the current expiry (still-active
      // subscription — the extension adds on top of remaining time) or now
      // (already-expired subscription — the extension starts counting from
      // today, not from a past date that would make the "new" expiry still
      // be in the past).
      const base = new Date(Math.max(new Date(subscription.endDate).getTime(), Date.now()));
      approvedExpiresAt = new Date(base.getTime() + request.requestedDurationDays * 24 * 60 * 60 * 1000);

      const wasInactive = subscription.status === "EXPIRED" || subscription.status === "CANCELLED" || subscription.status === "PAST_DUE";
      await subscription.update(
        { endDate: approvedExpiresAt, ...(wasInactive ? { status: "ACTIVE" } : {}) },
        { transaction: t }
      );

      await ExtRepo.writeAuditLog({
        entityType: "subscription",
        entityId: subscription.id,
        action: "extension_approved",
        actorId: superAdminId,
        actorRole: "super_admin",
        previousValue: subscriptionBefore,
        newValue: { status: subscription.status, endDate: approvedExpiresAt },
        reason: reviewComment || null,
      });
    } else {
      // No subscription existed at request time (shouldn't happen post
      // migration-0029 backfill, but fail safe rather than silently
      // approving something with nothing to extend).
      throw new ServiceError("This request has no associated subscription to extend", 400);
    }

    await request.update(
      {
        status: "approved",
        reviewedBy: superAdminId,
        reviewedAt: new Date(),
        reviewComment: reviewComment || null,
        approvedExpiresAt,
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
      newValue: { status: "approved", approvedExpiresAt },
      reason: reviewComment || null,
    });

    return request;
  });
};

export const rejectExtensionRequest = async (
  superAdminId: number,
  requestId: number,
  reviewComment: string | undefined
) => {
  return sequelize.transaction(async (t) => {
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

    return request;
  });
};
