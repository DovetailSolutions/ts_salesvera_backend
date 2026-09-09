import { ServiceError } from "../shared/serviceError";
import * as SubscriptionRepo from "./subscription.repository";

// ============================================================
// Subscription/limit enforcement — a dependency-light module deliberately
// kept separate from subscription.service.ts (which pulls in
// razorpay.service.ts and the rest of the checkout/webhook orchestration)
// so auth.service.ts, company.service.ts, and app/controller/admin.ts can
// import ONLY this file without risking a circular import back through the
// full subscription module. Only imports its own repository + ServiceError.
// ============================================================

export type LimitedResource = "admin" | "company" | "manager" | "sale_person";

const RESOURCE_LABEL: Record<LimitedResource, string> = {
  admin: "Admin",
  company: "Company",
  manager: "Manager",
  sale_person: "Sale Person",
};

// Resolves the top-level tenant User id whose Subscription governs the
// resource a given caller is about to create — the ONE canonical resolver
// every creation path (auth.service.ts's register, admin.ts's
// BulkAddSalePerson, company.service.ts's addCompany,
// superAdmin.service.ts's createUserAsSuperAdmin) uses, so tenant
// resolution logic exists in exactly one place. Never trust a
// client-supplied userId for this — always resolve from the AUTHENTICATED
// caller's own id/role.
export const getOwningTenantUserId = async (
  callerId: number | null | undefined,
  callerRole: string | null | undefined
): Promise<number | null> => {
  if (!callerId || !callerRole) return null;
  // super_admin acts across every tenant — never gated by any single
  // tenant's subscription itself (though the RESOURCE they create for a
  // given tenant is still gated — see assertCanCreate's callers).
  if (callerRole === "super_admin") return null;
  if (callerRole === "user") return callerId;

  const caller = await SubscriptionRepo.findUserForTenantResolution(callerId);
  return (caller?.get("tenantId") as number | null) ?? null;
};

// Resolves the tenant's current Subscription, self-healing an expired one
// in place (flips + persists TRIALING/ACTIVE/PAST_DUE → EXPIRED the moment
// `now > endDate`) so every caller — this file's own assertCanCreate, the
// GET /admin/subscription/current endpoint, etc. — always sees an
// up-to-date status without depending on a background job having already
// run. See config/cronJobs.ts's daily expiry sweep for the defensive
// backstop (catches tenants who don't hit any subscription-gated endpoint
// for a while).
export const getActiveSubscriptionForUser = async (tenantUserId: number) => {
  const subscription = await SubscriptionRepo.findLatestSubscriptionForUser(tenantUserId);
  if (!subscription) return null;

  const isLive = subscription.status === "TRIALING" || subscription.status === "ACTIVE" || subscription.status === "PAST_DUE";
  if (isLive && new Date(subscription.endDate) < new Date()) {
    await SubscriptionRepo.updateSubscription(subscription.id, { status: "EXPIRED" });
    subscription.status = "EXPIRED";
  }

  return subscription;
};

const LIMIT_FIELD: Record<LimitedResource, "maxAdmins" | "maxCompanies" | "maxManagers" | "maxSalePersons"> = {
  admin: "maxAdmins",
  company: "maxCompanies",
  manager: "maxManagers",
  sale_person: "maxSalePersons",
};

const usageCounter = async (resource: LimitedResource, tenantUserId: number): Promise<number> => {
  if (resource === "company") return SubscriptionRepo.countCompaniesForTenant(tenantUserId);
  return SubscriptionRepo.countActiveUsersByRole(tenantUserId, resource);
};

// Throws a ServiceError (caught by the caller's handleServiceError, mapped
// to the standard {success,code,message,data} response) if the tenant's
// current plan cannot accommodate one more of `resource`. A null
// tenantUserId (super_admin acting with no tenant context — e.g. creating
// another super_admin) is never gated. Structured `data.code` lets a
// frontend branch on SUBSCRIPTION_LIMIT_REACHED without parsing the human
// message.
export const assertCanCreate = async (resource: LimitedResource, tenantUserId: number | null): Promise<void> => {
  if (tenantUserId === null) return;

  const subscription = await getActiveSubscriptionForUser(tenantUserId);
  if (!subscription) {
    throw new ServiceError(
      "No active subscription found for this account. Please contact support.",
      400,
      { code: "NO_SUBSCRIPTION" }
    );
  }

  if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED" || subscription.status === "PAYMENT_FAILED") {
    throw new ServiceError(
      `Your subscription is ${subscription.status.toLowerCase()}. Renew or upgrade your plan to continue.`,
      400,
      { code: "SUBSCRIPTION_INACTIVE", status: subscription.status }
    );
  }

  const limit = subscription[LIMIT_FIELD[resource]];
  if (limit === null || limit === undefined) return; // unlimited

  const currentUsage = await usageCounter(resource, tenantUserId);
  if (currentUsage >= limit) {
    throw new ServiceError(
      `${RESOURCE_LABEL[resource]} limit reached. Your current plan allows a maximum of ${limit} ${RESOURCE_LABEL[resource]}(s). Upgrade your plan to add more.`,
      400,
      { code: "SUBSCRIPTION_LIMIT_REACHED", resource: resource.toUpperCase(), limit, currentUsage }
    );
  }
};

export interface UsageSummary {
  admins: { used: number; limit: number | null };
  companies: { used: number; limit: number | null };
  managers: { used: number; limit: number | null };
  salePersons: { used: number; limit: number | null };
}

export const getUsageSummary = async (tenantUserId: number): Promise<UsageSummary> => {
  const subscription = await getActiveSubscriptionForUser(tenantUserId);
  if (!subscription) {
    throw new ServiceError("No active subscription found for this account.", 400, { code: "NO_SUBSCRIPTION" });
  }

  const [admins, companies, managers, salePersons] = await Promise.all([
    usageCounter("admin", tenantUserId),
    usageCounter("company", tenantUserId),
    usageCounter("manager", tenantUserId),
    usageCounter("sale_person", tenantUserId),
  ]);

  return {
    admins: { used: admins, limit: subscription.maxAdmins },
    companies: { used: companies, limit: subscription.maxCompanies },
    managers: { used: managers, limit: subscription.maxManagers },
    salePersons: { used: salePersons, limit: subscription.maxSalePersons },
  };
};
