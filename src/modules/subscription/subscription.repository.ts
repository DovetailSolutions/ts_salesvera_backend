import { Op, fn, col } from "sequelize";
import { User, Company, SubscriptionPlan, Subscription, Payment } from "../../config/dbConnection";

// ============================================================
// Subscription repository — wraps all direct Sequelize access for this
// domain. See subscription.service.ts (orchestration) and
// subscriptionLimit.service.ts (limit enforcement, kept dependency-light so
// auth.service.ts/company.service.ts can import it without a circular
// import back through the full subscription module).
// ============================================================

export const findUserForTenantResolution = (userId: number) =>
  User.findByPk(userId, { attributes: ["id", "role", "tenantId"] });

export const countActiveUsersByRole = (tenantUserId: number, role: string) =>
  User.count({ where: { tenantId: tenantUserId, role, status: { [Op.ne]: "delete" } } });

export const countCompaniesForTenant = (tenantUserId: number) =>
  Company.count({ where: { userId: tenantUserId } });

// ── Batched usage counters ───────────────────────────────────────────────
// The per-tenant counters above are correct but N+1 when a LIST of tenants
// needs usage: superAdmin.service.ts's listTenantSubscriptions was calling
// getUsageSummary once per row, and each of those issued a subscription
// lookup plus four separate COUNTs — roughly 5 queries per tenant per page,
// measured at ~2.5s for one page of the Super Admin access list.
//
// These two replace all of it with two grouped queries for the whole page,
// regardless of how many tenants are on it. Counting rules are kept
// character-for-character identical to countActiveUsersByRole /
// countCompaniesForTenant (status <> 'delete', companies by userId) so the
// list and the detail view can never disagree about the same tenant's usage.
export const countUsersByRoleForTenants = (tenantUserIds: number[]) => {
  if (tenantUserIds.length === 0) return Promise.resolve([] as any[]);
  return User.findAll({
    where: {
      tenantId: { [Op.in]: tenantUserIds },
      role: { [Op.in]: ["admin", "manager", "employee"] },
      status: { [Op.ne]: "delete" },
    },
    attributes: ["tenantId", "role", [fn("COUNT", col("id")), "count"]],
    group: ["tenantId", "role"],
    raw: true,
  }) as unknown as Promise<Array<{ tenantId: number; role: string; count: string }>>;
};

export const countCompaniesForTenants = (tenantUserIds: number[]) => {
  if (tenantUserIds.length === 0) return Promise.resolve([] as any[]);
  return Company.findAll({
    where: { userId: { [Op.in]: tenantUserIds } },
    attributes: ["userId", [fn("COUNT", col("id")), "count"]],
    group: ["userId"],
    raw: true,
  }) as unknown as Promise<Array<{ userId: number; count: string }>>;
};

export const findActivePlans = () =>
  SubscriptionPlan.findAll({ where: { isActive: true }, order: [["sortOrder", "ASC"]] });

export const findPlanById = (id: number) => SubscriptionPlan.findByPk(id);

export const findPlanByCode = (planCode: string) => SubscriptionPlan.findOne({ where: { planCode } });

export const findTrialPlan = () => SubscriptionPlan.findOne({ where: { isTrialPlan: true } });

// The most recently created row for this tenant — whatever its status.
// "Only one LIVE row per user" is a service-layer invariant (every mutation
// path creates/updates through subscription.service.ts), so the newest row
// is always the authoritative current one; older rows are kept purely as
// history (CANCELLED/EXPIRED/superseded-by-upgrade).
export const findLatestSubscriptionForUser = (userId: number) =>
  Subscription.findOne({ where: { userId }, order: [["id", "DESC"]] });

export const createSubscription = (row: any) => Subscription.create(row);

export const updateSubscription = (id: number, fields: any) => Subscription.update(fields, { where: { id } });

export const findSubscriptionById = (id: number) => Subscription.findByPk(id);

export const findExpiredLiveSubscriptions = () =>
  Subscription.findAll({
    where: {
      status: { [Op.in]: ["TRIALING", "ACTIVE", "PAST_DUE"] },
      endDate: { [Op.lt]: new Date() },
    },
  });

// Live subscriptions whose endDate falls inside the next `days` — the input
// to the daily expiry-warning sweep (accessExpirySweep.service.ts). Only the
// four columns the sweep actually needs, not whole Subscription rows, since
// this scans every tenant. Served by the (status, endDate) index added in
// migration 0033.
export const findLiveSubscriptionsExpiringWithin = (days: number) =>
  Subscription.findAll({
    where: {
      status: { [Op.in]: ["TRIALING", "ACTIVE", "PAST_DUE"] },
      endDate: { [Op.between]: [new Date(), new Date(Date.now() + days * 24 * 60 * 60 * 1000)] },
    },
    attributes: ["id", "userId", "status", "endDate"],
    order: [["endDate", "ASC"]],
  });

export const createPayment = (row: any) => Payment.create(row);

export const findPaymentByOrderId = (razorpayOrderId: string) => Payment.findOne({ where: { razorpayOrderId } });

export const findPaymentByPaymentId = (razorpayPaymentId: string) =>
  Payment.findOne({ where: { razorpayPaymentId } });

export const updatePaymentById = (id: number, fields: any) => Payment.update(fields, { where: { id } });

export const findPaymentsForUser = (userId: number, limit: number, offset: number) =>
  Payment.findAndCountAll({
    where: { userId },
    include: [{ model: SubscriptionPlan, as: "plan", attributes: ["id", "name", "planCode"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

// ── Super Admin oversight ──────────────────────────────────────────────
export const findAllSubscriptionsPaginated = (params: {
  limit: number;
  offset: number;
  search?: string;
}) => {
  const userWhere: any = {};
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    userWhere[Op.or] = [
      { firstName: { [Op.iLike]: s } },
      { lastName: { [Op.iLike]: s } },
      { email: { [Op.iLike]: s } },
    ];
  }

  return Subscription.findAndCountAll({
    include: [
      { model: User, as: "user", attributes: ["id", "firstName", "lastName", "email"], where: userWhere },
      { model: SubscriptionPlan, as: "plan", attributes: ["id", "name", "planCode"] },
    ],
    order: [["createdAt", "DESC"]],
    limit: params.limit,
    offset: params.offset,
    // Only the CURRENT (most recent) row per tenant is meaningful in this
    // listing — history rows would otherwise duplicate a tenant across
    // pages. Filtered in the service layer instead of here (needs a
    // window function over the joined result, simpler to post-process).
    distinct: true,
  });
};

export const findSubscriptionWithPaymentsById = (id: number) =>
  Subscription.findByPk(id, {
    include: [
      { model: User, as: "user", attributes: ["id", "firstName", "lastName", "email"] },
      { model: SubscriptionPlan, as: "plan" },
      { model: Payment, as: "payments", separate: true, order: [["createdAt", "DESC"]] },
    ],
  });
