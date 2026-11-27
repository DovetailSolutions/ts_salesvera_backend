import { Request, Response, NextFunction } from "express";
import { SubscriptionAddon, SubscriptionPlan, User } from "../../config/dbConnection";
import { getActiveSubscriptionForUser, invalidateTenantStatus } from "./subscriptionLimit.service";
import {
  ADDONS,
  AddonCode,
  FEATURE_BY_KEY,
  FeatureKey,
  PlanTier,
  TIER_LABEL,
  featureForPath,
  featuresFor,
  normalizeTier,
} from "./planFeatures";

// ============================================================
// Plan / add-on entitlement checks.
//
//   getCompanySubscription(tenantUserId)  → plan tier, add-ons, feature map
//   hasFeatureAccess(tenantUserId, key)   → boolean
//   checkSubscriptionFeature(key)         → route middleware
//   checkAddonAccess(code)                → route middleware
//   gateRequestByPlan(req, user)          → used by createTokenCheck so
//                                           every route listed in
//                                           planFeatures.FEATURE_ROUTES is
//                                           enforced in one place.
//
// Expiry is NOT handled here — tokenCheck's getBlockedTenantStatus already
// locks an expired tenant out entirely. This layer only answers "is this
// feature part of what the tenant bought".
//
// Grandfathering: a tenant with no subscription row, or a plan row with no
// tier, gets ADVANCE (see normalizeTier) — the same "never lock out over
// missing bookkeeping" rule getBlockedTenantStatus follows.
// ============================================================

export interface Entitlements {
  tenantUserId: number | null;
  tier: PlanTier;
  planName: string;
  planCode: string | null;
  subscriptionId: number | null;
  status: string | null;
  startDate: Date | null;
  endDate: Date | null;
  addons: string[];
  features: Record<FeatureKey, boolean>;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<number, { value: Entitlements; expires: number }>();

export const invalidateEntitlements = (tenantUserId?: number | null) => {
  if (tenantUserId == null) cache.clear();
  else cache.delete(Number(tenantUserId));
  invalidateTenantStatus(tenantUserId);
};

const fullAccess = (tenantUserId: number | null): Entitlements => ({
  tenantUserId,
  tier: "ADVANCE",
  planName: TIER_LABEL.ADVANCE,
  planCode: null,
  subscriptionId: null,
  status: null,
  startDate: null,
  endDate: null,
  addons: Object.keys(ADDONS),
  features: featuresFor("ADVANCE", Object.keys(ADDONS)),
});

/** Active add-on codes for a tenant; add-ons past their endDate are flipped to EXPIRED in place. */
export const getActiveAddons = async (tenantUserId: number): Promise<string[]> => {
  const rows = await SubscriptionAddon.findAll({ where: { userId: tenantUserId, status: "ACTIVE" } });
  const now = new Date();
  const active: string[] = [];
  for (const row of rows) {
    if (row.endDate && new Date(row.endDate) < now) {
      await SubscriptionAddon.update({ status: "EXPIRED" }, { where: { id: row.id } });
      continue;
    }
    active.push(row.addonCode);
  }
  return active;
};

export const getCompanySubscription = async (tenantUserId: number | null): Promise<Entitlements> => {
  // No tenant (super_admin, or an orphan account) → nothing to gate.
  if (!tenantUserId) {
    const e = fullAccess(null);
    e.addons = [];
    e.features = featuresFor("ADVANCE", []);
    return e;
  }

  const hit = cache.get(tenantUserId);
  if (hit && hit.expires > Date.now()) return hit.value;

  const subscription: any = await getActiveSubscriptionForUser(tenantUserId);
  let value: Entitlements;
  if (!subscription) {
    const addons = await getActiveAddons(tenantUserId);
    value = { ...fullAccess(tenantUserId), addons, features: featuresFor("ADVANCE", addons) };
  } else {
    const plan: any = await SubscriptionPlan.findByPk(subscription.planId);
    const tier = normalizeTier(plan?.tier);
    const addons = (await getActiveAddons(tenantUserId)).filter((code) => code in ADDONS);
    value = {
      tenantUserId,
      tier,
      planName: plan?.name ?? TIER_LABEL[tier],
      planCode: plan?.planCode ?? null,
      subscriptionId: subscription.id,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      addons,
      features: featuresFor(tier, addons),
    };
  }

  cache.set(tenantUserId, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};

/** Resolves the tenant owner id for any user. */
export const resolveTenantUserId = async (
  userId: number,
  role: string,
  knownTenantId?: number | null
): Promise<number | null> => {
  if (role === "super_admin") return null;
  if (role === "user") return userId;
  if (knownTenantId !== undefined) return knownTenantId ?? null;
  const u: any = await User.findByPk(userId, { attributes: ["tenantId"] });
  return u?.tenantId ?? null;
};

export const hasFeatureAccess = async (tenantUserId: number | null, feature: FeatureKey): Promise<boolean> => {
  const e = await getCompanySubscription(tenantUserId);
  return !!e.features[feature];
};

export const featureDeniedBody = (feature: FeatureKey, e: Entitlements) => {
  const def = FEATURE_BY_KEY[feature];
  const requiredPlan = TIER_LABEL[def.tier];
  const message = def.addon
    ? `${def.label} is a paid add-on${e.tier === "ADVANCE" ? "" : ` for ${requiredPlan}`}. It is not active for your organisation.`
    : `${def.label} is not included in your ${e.planName} plan. Upgrade to ${requiredPlan} to use it.`;
  return {
    code: 403,
    success: false,
    message,
    data: {
      code: def.addon ? "ADDON_REQUIRED" : "FEATURE_NOT_IN_PLAN",
      feature,
      featureLabel: def.label,
      currentPlan: e.planName,
      currentTier: e.tier,
      requiredTier: def.tier,
      requiredPlan,
      addon: def.addon ?? null,
    },
  };
};

/**
 * Called from createTokenCheck after the user is loaded. Returns a 403 body
 * when the route belongs to a feature outside the tenant's plan, else null.
 * Fails open on an unexpected error (logged) — a plan lookup glitch must not
 * take the whole API down; tenant expiry is enforced separately and fails
 * closed.
 */
export const gateRequestByPlan = async (
  req: Request,
  user: { id: number; role: string; tenantId?: number | null }
) => {
  if (user.role === "super_admin") return null;
  const feature = featureForPath(req.originalUrl || req.url);
  if (!feature) return null;
  try {
    const tenantUserId = await resolveTenantUserId(user.id, user.role, user.tenantId ?? null);
    const e = await getCompanySubscription(tenantUserId);
    if (e.features[feature]) return null;
    return featureDeniedBody(feature, e);
  } catch (err) {
    console.error("[plan-gate] entitlement lookup failed, allowing request:", err);
    return null;
  }
};

const tenantFromReq = async (req: Request) => {
  const u: any = req.userData || {};
  return resolveTenantUserId(Number(u.userId), u.role);
};

/** Explicit per-route middleware (for routes not covered by FEATURE_ROUTES). Use after tokenCheck. */
export const checkSubscriptionFeature = (feature: FeatureKey) =>
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const u: any = req.userData || {};
    if (u.role === "super_admin") return next();
    const e = await getCompanySubscription(await tenantFromReq(req));
    if (e.features[feature]) return next();
    return res.status(403).json(featureDeniedBody(feature, e));
  };

export const checkAddonAccess = (addon: AddonCode) =>
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const u: any = req.userData || {};
    if (u.role === "super_admin") return next();
    const e = await getCompanySubscription(await tenantFromReq(req));
    const feature = (Object.values(FEATURE_BY_KEY).find((f) => f.addon === addon)?.key ?? "tally") as FeatureKey;
    if (e.features[feature]) return next();
    return res.status(403).json(featureDeniedBody(feature, e));
  };
