import { AccessAuditLog, Subscription, SubscriptionAddon, SubscriptionPlan, User, sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import * as AccessNotify from "../accessExtension/accessNotification.service";
import { ADDONS, AddonCode, FEATURES, TIER_LABEL, featuresFor, normalizeTier, tierIncludes } from "./planFeatures";
import { getCompanySubscription, invalidateEntitlements, resolveTenantUserId } from "./featureAccess.service";

// ============================================================
// Read side for the tenant's Subscription page and write side for Super
// Admin add-on management. Plan changes go through
// superAdmin.service.ts's updateTenantSubscription (planId) so every
// subscription edit keeps one audit + notification path.
// ============================================================

const planView = (p: any) => {
  const tier = normalizeTier(p.tier);
  return {
    id: p.id,
    planCode: p.planCode,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    billingInterval: p.billingInterval,
    isTrialPlan: p.isTrialPlan,
    tier,
    tierLabel: TIER_LABEL[tier],
    limits: { companies: p.maxCompanies, users: p.maxEmployees },
    features: featuresFor(tier, []),
  };
};

export const catalogue = () => ({
  featureCatalog: FEATURES,
  addonCatalog: Object.entries(ADDONS).map(([code, a]) => ({ code, ...a, requiresTierLabel: TIER_LABEL[a.requiresTier] })),
});

/** Everything the caller's own UI needs to show/hide features. Any authenticated role. */
export const myEntitlements = async (userId: number, role: string) => {
  const tenantUserId = await resolveTenantUserId(userId, role);
  const e = await getCompanySubscription(tenantUserId);
  return {
    plan: {
      name: e.planName,
      code: e.planCode,
      tier: e.tier,
      tierLabel: TIER_LABEL[e.tier],
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate,
    },
    addons: e.addons,
    features: e.features,
    ...catalogue(),
  };
};

/**
 * Subscription page for the tenant owner / company admin: current plan,
 * every plan with its features (comparison), plan-change history and add-on
 * history. The tenant is always resolved from the caller's token; a
 * super_admin may pass tenantUserId explicitly.
 */
export const overview = async (userId: number, role: string, tenantUserIdParam?: number) => {
  let tenantUserId: number | null;
  if (role === "super_admin") {
    if (!tenantUserIdParam) throw new ServiceError("tenantUserId is required", 400);
    tenantUserId = tenantUserIdParam;
  } else {
    tenantUserId = await resolveTenantUserId(userId, role);
  }
  if (!tenantUserId) throw new ServiceError("No organisation is linked to this account", 404);

  const [entitlements, plans, subscriptions, addons] = await Promise.all([
    getCompanySubscription(tenantUserId),
    SubscriptionPlan.findAll({ where: { isActive: true }, order: [["sortOrder", "ASC"]] }),
    Subscription.findAll({
      where: { userId: tenantUserId },
      include: [{ model: SubscriptionPlan, as: "plan", attributes: ["id", "name", "planCode", "tier"] }],
      order: [["id", "DESC"]],
    }),
    SubscriptionAddon.findAll({ where: { userId: tenantUserId }, order: [["id", "DESC"]] }),
  ]);

  const subIds = subscriptions.map((s: any) => s.id);
  const auditRows = subIds.length
    ? await AccessAuditLog.findAll({
        where: { entityType: "subscription", entityId: subIds } as any,
        order: [["createdAt", "DESC"]],
        limit: 50,
      })
    : [];
  const addonAudit = addons.length
    ? await AccessAuditLog.findAll({
        where: { entityType: "subscription_addon", entityId: addons.map((a: any) => a.id) } as any,
        order: [["createdAt", "DESC"]],
        limit: 50,
      })
    : [];

  const planNames = new Map(plans.map((p: any) => [Number(p.id), p.name]));
  const history = [...auditRows, ...addonAudit]
    .map((r: any) => {
      const prev = r.previousValue || {};
      const next = r.newValue || {};
      const changes: string[] = [];
      if (r.entityType === "subscription_addon") {
        changes.push(`${next.addonLabel ?? next.addonCode ?? "Add-on"} ${r.action === "addon_activated" ? "activated" : "deactivated"}`);
      } else {
        if (next.planId !== undefined && prev.planId !== next.planId) {
          changes.push(`Plan: ${prev.planName ?? planNames.get(Number(prev.planId)) ?? "—"} → ${next.planName ?? planNames.get(Number(next.planId)) ?? "—"}`);
        }
        if (next.status !== prev.status) changes.push(`Status: ${prev.status} → ${next.status}`);
        if (next.endDate && prev.endDate && new Date(next.endDate).getTime() !== new Date(prev.endDate).getTime()) {
          changes.push(`Expiry: ${String(prev.endDate).slice(0, 10)} → ${String(next.endDate).slice(0, 10)}`);
        }
        for (const k of ["maxEmployees", "maxCompanies"]) {
          if (next[k] !== prev[k]) changes.push(`${k === "maxEmployees" ? "User limit" : "Company limit"}: ${prev[k] ?? "unlimited"} → ${next[k] ?? "unlimited"}`);
        }
      }
      return { id: r.id, at: r.createdAt, action: r.action, reason: r.reason, changes };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const current: any = subscriptions[0] ?? null;
  return {
    tenantUserId,
    current: current
      ? {
          id: current.id,
          plan: current.plan ? planView(current.plan) : null,
          status: entitlements.status,
          startDate: current.startDate,
          endDate: current.endDate,
          limits: { companies: current.maxCompanies, users: current.maxEmployees },
        }
      : null,
    tier: entitlements.tier,
    tierLabel: TIER_LABEL[entitlements.tier],
    features: entitlements.features,
    activeAddons: entitlements.addons,
    plans: plans.map(planView),
    periods: subscriptions.map((s: any) => ({
      id: s.id,
      plan: s.plan?.name ?? null,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      createdAt: s.createdAt,
    })),
    addons: addons.map((a: any) => ({
      id: a.id,
      code: a.addonCode,
      label: ADDONS[a.addonCode as AddonCode]?.label ?? a.addonCode,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
      cancelledAt: a.cancelledAt,
      notes: a.notes,
    })),
    history,
    canManage: role === "super_admin",
    ...catalogue(),
  };
};

const assertTenantOwner = async (tenantUserId: number) => {
  const owner: any = await User.findByPk(tenantUserId, { attributes: ["id", "role"] });
  if (!owner || owner.role !== "user") throw new ServiceError("Tenant owner not found", 404);
};

/** Super Admin: activate an add-on. Requires the plan tier the add-on needs. Idempotent. */
export const activateAddon = async (
  actorId: number,
  tenantUserId: number,
  body: { addonCode?: string; endDate?: string | null; notes?: string | null }
) => {
  const code = String(body.addonCode || "").toUpperCase() as AddonCode;
  const def = ADDONS[code];
  if (!def) throw new ServiceError(`addonCode must be one of: ${Object.keys(ADDONS).join(", ")}`);
  await assertTenantOwner(tenantUserId);

  let endDate: Date | null = null;
  if (body.endDate) {
    endDate = new Date(body.endDate);
    if (isNaN(endDate.getTime())) throw new ServiceError("endDate is not a valid date");
    if (endDate < new Date()) throw new ServiceError("endDate must be in the future");
  }

  const e = await getCompanySubscription(tenantUserId);
  if (!tierIncludes(e.tier, def.requiresTier)) {
    throw new ServiceError(`${def.label} requires the ${TIER_LABEL[def.requiresTier]} plan; this tenant is on ${e.planName}`);
  }

  const result = await sequelize.transaction(async (t) => {
    const existing = await SubscriptionAddon.findOne({
      where: { userId: tenantUserId, addonCode: code, status: "ACTIVE" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing) return { row: existing, created: false };
    const row = await SubscriptionAddon.create(
      { userId: tenantUserId, addonCode: code, status: "ACTIVE", endDate, grantedBy: actorId, notes: body.notes ?? null },
      { transaction: t }
    );
    await AccessAuditLog.create(
      {
        entityType: "subscription_addon",
        entityId: row.id,
        action: "addon_activated",
        actorId,
        actorRole: "super_admin",
        previousValue: null,
        newValue: { addonCode: code, addonLabel: def.label, endDate },
        reason: body.notes ?? null,
      } as any,
      { transaction: t }
    );
    return { row, created: true };
  });

  invalidateEntitlements(tenantUserId);
  if (result.created) {
    await AccessNotify.notifyAddonChanged({ ownerUserId: tenantUserId, actorId, addonLabel: def.label, active: true, reason: body.notes })
      .catch((err) => console.error("[addon] notify failed:", err));
  }
  return { addon: result.row, alreadyActive: !result.created };
};

/** Super Admin: cancel an active add-on. History row is kept; synced data is untouched. */
export const cancelAddon = async (actorId: number, tenantUserId: number, addonCodeRaw: string, reason?: string | null) => {
  const code = String(addonCodeRaw || "").toUpperCase() as AddonCode;
  const def = ADDONS[code];
  if (!def) throw new ServiceError(`addonCode must be one of: ${Object.keys(ADDONS).join(", ")}`);

  const row = await sequelize.transaction(async (t) => {
    const existing = await SubscriptionAddon.findOne({
      where: { userId: tenantUserId, addonCode: code, status: "ACTIVE" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!existing) throw new ServiceError(`${def.label} is not active for this tenant`, 404);
    await existing.update({ status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actorId }, { transaction: t });
    await AccessAuditLog.create(
      {
        entityType: "subscription_addon",
        entityId: existing.id,
        action: "addon_cancelled",
        actorId,
        actorRole: "super_admin",
        previousValue: { status: "ACTIVE" },
        newValue: { status: "CANCELLED", addonCode: code, addonLabel: def.label },
        reason: reason ?? null,
      } as any,
      { transaction: t }
    );
    return existing;
  });

  invalidateEntitlements(tenantUserId);
  await AccessNotify.notifyAddonChanged({ ownerUserId: tenantUserId, actorId, addonLabel: def.label, active: false, reason })
    .catch((err) => console.error("[addon] notify failed:", err));
  return row;
};

export const listPlans = async () => {
  const plans = await SubscriptionPlan.findAll({ order: [["sortOrder", "ASC"]] });
  return plans.map(planView);
};
