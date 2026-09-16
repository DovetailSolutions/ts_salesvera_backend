import { AccessExtensionRequest, AccessAuditLog, Subscription, User } from "../../config/dbConnection";

// ============================================================
// Access-extension repository — wraps direct Sequelize access for
// AccessExtensionRequest + the audit log writes that go with it.
// ============================================================

export const findPendingRequestForOwner = (ownerUserId: number) =>
  AccessExtensionRequest.findOne({ where: { ownerUserId, status: "pending" } });

export const createRequest = (row: any) => AccessExtensionRequest.create(row);

export const findRequestById = (id: number) => AccessExtensionRequest.findByPk(id);

// Row-locked read, used inside the approve/reject transaction so two
// concurrent review attempts on the same request can't both proceed.
export const findRequestByIdForUpdate = (id: number, transaction: any) =>
  AccessExtensionRequest.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

export const findRequestsForOwnerPaginated = (ownerUserId: number, limit: number, offset: number) =>
  AccessExtensionRequest.findAndCountAll({
    where: { ownerUserId },
    include: [{ model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"], required: false }],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

export const findAllRequestsPaginated = (params: { status?: string; limit: number; offset: number }) => {
  const where: any = {};
  if (params.status) where.status = params.status;
  return AccessExtensionRequest.findAndCountAll({
    where,
    include: [
      { model: User, as: "owner", attributes: ["id", "firstName", "lastName", "email"] },
      { model: User, as: "requestedBy", attributes: ["id", "firstName", "lastName", "email"] },
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
