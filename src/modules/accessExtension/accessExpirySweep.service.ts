import * as SubscriptionRepo from "../subscription/subscription.repository";
import * as AccessNotify from "./accessNotification.service";
import * as ExtRepo from "./accessExtension.repository";

// ============================================================
// Daily access-expiry sweep. Two jobs, in this order:
//
//   1. EXPIRE — flip any live subscription now past its endDate to EXPIRED
//      and tell the tenant. subscriptionLimit.service.ts's
//      getActiveSubscriptionForUser already self-heals this lazily the
//      moment the tenant touches a gated endpoint, so the sweep is the
//      BACKSTOP: it catches tenants who don't hit any gated endpoint for a
//      while (and is what makes the expiry notification possible at all —
//      nobody is there to trigger a lazy heal for an account that has gone
//      quiet). A code comment in subscriptionLimit.service.ts has pointed at
//      "cronJobs.ts's daily expiry sweep" since migration 0029; this is that
//      sweep, which until now did not actually exist.
//
//   2. WARN — notify tenants approaching expiry at the 30/7/3/1-day
//      milestones.
//
// Both halves are idempotent, so running the sweep twice in a day (restart,
// manual invocation, overlapping schedules) sends nothing extra — see
// accessNotification.service.ts for how "already warned" is determined.
// Every per-tenant step is independently try/caught: one tenant with bad
// data must not abort the sweep for everyone after it.
// ============================================================

const daysUntil = (endDate: Date | string) =>
  Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

export interface AccessExpirySweepResult {
  expired: number;
  expiredNotified: number;
  warned: number;
  errors: number;
}

export const runAccessExpirySweep = async (): Promise<AccessExpirySweepResult> => {
  const result: AccessExpirySweepResult = { expired: 0, expiredNotified: 0, warned: 0, errors: 0 };

  // ── 1. Newly expired ──────────────────────────────────────────────
  const nowExpired = await SubscriptionRepo.findExpiredLiveSubscriptions();

  for (const subscription of nowExpired as any[]) {
    try {
      const id = Number(subscription.id);
      const ownerUserId = Number(subscription.userId);
      const previousStatus = subscription.status;

      await SubscriptionRepo.updateSubscription(id, { status: "EXPIRED" });
      result.expired += 1;

      // Same audit trail a Super-Admin-driven change writes, with a null
      // actor to mark it as the system rather than a person — so "why is
      // this tenant EXPIRED" is answerable from access_audit_log regardless
      // of which path got them there.
      await ExtRepo.writeAuditLog({
        entityType: "subscription",
        entityId: id,
        action: "expired_by_system",
        actorId: null,
        actorRole: null,
        previousValue: { status: previousStatus, endDate: subscription.endDate },
        newValue: { status: "EXPIRED", endDate: subscription.endDate },
        reason: "Automatic expiry — endDate passed",
      }).catch((e) => console.error("[access-sweep] audit write failed:", e));

      const sent = await AccessNotify.notifyExpired({
        ownerUserId,
        subscriptionId: id,
        endDate: subscription.endDate,
      });
      result.expiredNotified += sent;
    } catch (e) {
      result.errors += 1;
      console.error(`[access-sweep] failed to expire subscription ${subscription?.id}:`, e);
    }
  }

  // ── 2. Expiry warnings ────────────────────────────────────────────
  // Scanned over the widest milestone once, rather than one query per
  // milestone.
  const widestMilestone = Math.max(...AccessNotify.EXPIRY_WARNING_MILESTONES);
  const upcoming = await SubscriptionRepo.findLiveSubscriptionsExpiringWithin(widestMilestone);

  for (const subscription of upcoming as any[]) {
    try {
      const remaining = daysUntil(subscription.endDate);

      // The MOST URGENT milestone this tenant has reached: the smallest
      // configured milestone that is still >= days remaining. At 5 days out
      // that is 7 (30 is also "reached", but 7 is the useful thing to say).
      // Because each milestone is remembered separately, the tenant later
      // gets 3 and then 1 as those are reached — and a sweep that didn't run
      // for a week still sends the most urgent applicable warning instead of
      // silently missing the window.
      const reached = AccessNotify.EXPIRY_WARNING_MILESTONES.filter((m) => remaining <= m);
      if (reached.length === 0) continue;
      const milestone = Math.min(...reached);

      const sent = await AccessNotify.notifyExpiringSoon({
        ownerUserId: Number(subscription.userId),
        subscriptionId: Number(subscription.id),
        milestone,
        daysRemaining: remaining,
        endDate: subscription.endDate,
      });
      result.warned += sent;
    } catch (e) {
      result.errors += 1;
      console.error(`[access-sweep] failed to warn on subscription ${subscription?.id}:`, e);
    }
  }

  return result;
};
