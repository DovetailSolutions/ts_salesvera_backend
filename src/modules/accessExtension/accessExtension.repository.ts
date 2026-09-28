import { AccessExtensionRequest, AccessAuditLog, Subscription, User } from "../../config/dbConnection";

// ============================================================
// Access-extension repository — wraps direct Sequelize access for
// AccessExtensionRequest + the audit log writes that go with it.
// ============================================================

// Scoped by requestType: a tenant may have one pending expiry-extension AND
// one pending employee-limit request at the same time (they are different
// asks), which is exactly what migration 0033's
// (ownerUserId, requestType) WHERE status='pending' partial unique index
// permits. Omit requestType to ask "any pending request at all".
export const findPendingRequestForOwner = (ownerUserId: number, requestType?: string) =>
  AccessExtensionRequest.findOne({
    where: { ownerUserId, status: "pending", ...(requestType ? { requestType } : {}) },
  });

export const findPendingRequestsForOwner = (ownerUserId: number) =>
  AccessExtensionRequest.findAll({ where: { ownerUserId, status: "pending" }, order: [["createdAt", "DESC"]] });

export const createRequest = (row: any) => AccessExtensionRequest.create(row);

export const findRequestById = (id: number) => AccessExtensionRequest.findByPk(id);

// Row-locked read, used inside the approve/reject transaction so two
// concurrent review attempts on the same request can't both proceed.
export const findRequestByIdForUpdate = (id: number, transaction: any) =>
  AccessExtensionRequest.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

export const findRequestsForOwnerPaginated = (ownerUserId: number, limit: number, offset: number) =>
  AccessExtensionRequest.findAndCountAll({
    // ownerUserId is always the resolved tenant of the AUTHENTICATED caller
    // (see the service), so this can never page another tenant's requests.
    where: { ownerUserId },
    // requestedBy is included here too (not just in the Super Admin listing)
    // because an admin and the owner can both file against the same tenant —
    // the tenant's own history needs to show which of them asked.
    include: [
      { model: User, as: "requestedBy", attributes: ["id", "firstName", "lastName", "email", "role"], required: false },
      { model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"], required: false },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

export const findAllRequestsPaginated = (params: {
  status?: string;
  requestType?: string;
  limit: number;
  offset: number;
}) => {
  const where: any = {};
  if (params.status) where.status = params.status;
  if (params.requestType) where.requestType = params.requestType;
  return AccessExtensionRequest.findAndCountAll({
    where,
    include: [
      { model: User, as: "owner", attributes: ["id", "firstName", "lastName", "email"] },
      { model: User, as: "requestedBy", attributes: ["id", "firstName", "lastName", "email", "role"] },
      { model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"], required: false },
    ],
    order: [["createdAt", "DESC"]],
    limit: params.limit,
    offset: params.offset,
  });
};

export const findSubscriptionByIdForUpdate = (id: number, transaction: any) =>
  Subscription.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

export const writeAuditLog = (row: {
  entityType: "subscription" | "extension_request";
  // Kept as a widened string union rather than an enum so a new action name
  // does not need a schema change — access_audit_log.action is VARCHAR(40).
  entityId: number;
  action: string;
  actorId: number | null;
  actorRole: string | null;
  previousValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  reason?: string | null;
}) => AccessAuditLog.create(row as any);

export const findAuditLogForEntity = (entityType: string, entityId: number, limit: number, offset: number) =>
  AccessAuditLog.findAndCountAll({
    where: { entityType, entityId },
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
