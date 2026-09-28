import { Op } from "sequelize";
import { User, Notification } from "../../config/dbConnection";
import { NotificationType } from "../../app/model/Notification";
import { sendNotification } from "../../config/notificationService";

// ============================================================
// Access-management notifications. A thin set of named senders on top of
// the EXISTING notification infrastructure (config/notificationService.ts's
// sendNotification — DB row + socket.io room emit + Firebase push, all
// three already handled there), using the NotificationType.SUBSCRIPTION
// enum value that migration 0022_notification_type_subscription.ts added
// but which nothing had ever actually sent. No second notification system,
// no new table.
//
// SUBSCRIPTION is deliberately NOT in notificationService's
// MUTABLE_TYPE_COLUMN map, so — like security/account alerts — an access
// change always reaches the tenant and can't be muted away in My
// Preferences. That is the point: someone whose access is about to be cut
// off must find out.
//
// Every sender here is BEST-EFFORT: notifying is never allowed to fail the
// access change that triggered it (a socket hiccup or a dead Firebase token
// must not roll back a Super Admin's limit edit). Hence notifyQuietly.
// ============================================================

const notifyQuietly = async (payload: Parameters<typeof sendNotification>[0]) => {
  try {
    await sendNotification(payload);
  } catch (e) {
    console.error(`[access-notification] failed for receiver ${payload.receiverId}:`, e);
  }
};

// Who hears about a tenant's access change: the owner ("user" — the one who
// can actually request an extension) plus that tenant's admins (who run
// day-to-day hiring and hit the employee cap first). Managers/employees are
// deliberately left out — they can neither fix nor act on it, and fanning
// every access edit out to an entire workforce would be noise.
//
// Scoped strictly by tenantId, so this can never address a user outside the
// affected tenant.
const getAccessAudience = async (ownerUserId: number): Promise<number[]> => {
  const admins = await User.findAll({
    where: { tenantId: ownerUserId, role: "admin", status: { [Op.ne]: "delete" } },
    attributes: ["id"],
  });
  const ids = new Set<number>([ownerUserId]);
  admins.forEach((a: any) => ids.add(Number(a.get("id"))));
  return [...ids];
};

const fanOut = async (
  ownerUserId: number,
  actorId: number | null,
  title: string,
  body: string,
  data: Record<string, any>
) => {
  const audience = await getAccessAudience(ownerUserId).catch(() => [ownerUserId]);
  await Promise.all(
    audience.map((receiverId) =>
      notifyQuietly({
        receiverId,
        senderId: actorId,
        type: NotificationType.SUBSCRIPTION,
        title,
        body,
        data,
      })
    )
  );
};

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const LIMIT_LABEL: Record<string, string> = {
  maxEmployees: "employee",
  maxAdmins: "admin",
  maxManagers: "manager",
  maxCompanies: "company",
};

// ── Super Admin edited a tenant's limits / expiry / status ──────────────
// Driven off the actual before/after diff rather than one notification per
// button, so a single edit touching both the expiry and the employee limit
// produces one message per thing that genuinely changed and nothing for
// fields that were re-submitted unchanged.
export const notifySubscriptionChanged = async (params: {
  ownerUserId: number;
  actorId: number | null;
  subscriptionId: number;
  before: Record<string, any>;
  after: Record<string, any>;
  reason?: string | null;
}) => {
  const { ownerUserId, actorId, subscriptionId, before, after, reason } = params;
  const base = { subscriptionId, reason: reason ?? null };

  for (const field of ["maxEmployees", "maxAdmins", "maxManagers", "maxCompanies"]) {
    if (after[field] === undefined) continue;
    const oldV = before[field];
    const newV = after[field];
    if (oldV === newV) continue;
    const label = LIMIT_LABEL[field];
    const describe = (v: any) => (v === null || v === undefined ? "unlimited" : String(v));
    await fanOut(
      ownerUserId,
      actorId,
      `Your ${label} limit has been updated`,
      `Your ${label} limit has been changed from ${describe(oldV)} to ${describe(newV)}.`,
      { ...base, event: "ACCESS_LIMIT_CHANGED", field, previousValue: oldV, newValue: newV }
    );
  }

  if (after.endDate !== undefined && new Date(after.endDate).getTime() !== new Date(before.endDate).getTime()) {
    await fanOut(
      ownerUserId,
      actorId,
      "Your access expiry date has been updated",
      `Your SalesVera access expiry date has been updated to ${fmtDate(after.endDate)}.`,
      { ...base, event: "ACCESS_EXPIRY_CHANGED", previousValue: before.endDate, newValue: after.endDate }
    );
  }

  if (after.status !== undefined && after.status !== before.status) {
    const wentInactive = ["SUSPENDED", "CANCELLED", "EXPIRED", "PAYMENT_FAILED"].includes(after.status);
    const cameBackLive =
      ["ACTIVE", "TRIALING"].includes(after.status) &&
      ["SUSPENDED", "CANCELLED", "EXPIRED", "PAYMENT_FAILED"].includes(before.status);

    if (wentInactive) {
      await fanOut(
        ownerUserId,
        actorId,
        "Your SalesVera access has been suspended",
        after.status === "SUSPENDED"
          ? "Your SalesVera access has been suspended. Please contact your account owner."
          : `Your SalesVera access is now ${after.status.toLowerCase().replace("_", " ")}.`,
        { ...base, event: "ACCESS_SUSPENDED", previousValue: before.status, newValue: after.status }
      );
    } else if (cameBackLive) {
      await fanOut(
        ownerUserId,
        actorId,
        "Your SalesVera access has been restored",
        "Your SalesVera access has been restored. You can continue using the application.",
        { ...base, event: "ACCESS_REACTIVATED", previousValue: before.status, newValue: after.status }
      );
    }
  }
};

// ── Request workflow ───────────────────────────────────────────────────
// A new request notifies every Super Admin (their review queue), not the
// tenant — the tenant already knows, they just submitted it.
export const notifySuperAdminsOfRequest = async (params: {
  requesterName: string;
  requestId: number;
  requestType: string;
  detail: string;
  actorId: number;
}) => {
  const superAdmins = await User.findAll({
    where: { role: "super_admin", status: { [Op.ne]: "delete" } },
    attributes: ["id"],
  }).catch(() => [] as any[]);

  await Promise.all(
    (superAdmins as any[]).map((sa) =>
      notifyQuietly({
        receiverId: Number(sa.get("id")),
        senderId: params.actorId,
        type: NotificationType.SUBSCRIPTION,
        title:
          params.requestType === "employee_limit"
            ? "New employee limit increase request"
            : "New access extension request",
        body: `${params.requesterName} has submitted a request: ${params.detail}`,
        data: { event: "ACCESS_REQUEST_SUBMITTED", requestId: params.requestId, requestType: params.requestType },
      })
    )
  );
};

export const notifyRequestReviewed = async (params: {
  ownerUserId: number;
  actorId: number | null;
  requestId: number;
  requestType: string;
  approved: boolean;
  newEmployeeLimit?: number | null;
  newExpiresAt?: Date | null;
  reviewComment?: string | null;
}) => {
  const { ownerUserId, actorId, requestId, requestType, approved, reviewComment } = params;

  let title: string;
  let body: string;

  if (!approved) {
    title =
      requestType === "employee_limit"
        ? "Your employee limit increase request was rejected"
        : "Your access extension request was rejected";
    body =
      requestType === "employee_limit"
        ? "Your employee limit increase request has been rejected."
        : "Your access extension request has been rejected.";
    if (reviewComment) body += ` Reason: ${reviewComment}`;
  } else if (requestType === "employee_limit") {
    title = "Your employee limit increase request was approved";
    body = `Your employee limit increase request has been approved. Your new limit is ${params.newEmployeeLimit} employees.`;
  } else {
    title = "Your access extension request was approved";
    body = `Your access extension request has been approved. Your access is now valid until ${
      params.newExpiresAt ? fmtDate(params.newExpiresAt) : "the new expiry date"
    }.`;
  }

  await fanOut(ownerUserId, actorId, title, body, {
    event: approved ? "ACCESS_EXTENSION_APPROVED" : "ACCESS_EXTENSION_REJECTED",
    requestId,
    requestType,
  });
};

// ── Expiry warnings (idempotency) ──────────────────────────────────────
// Milestones, in days-remaining. The daily sweep
// (accessExpirySweep.service.ts) picks the MOST URGENT milestone a tenant has
// reached — the smallest value still >= days remaining — so at 5 days out the
// tenant is told "7 days or fewer", not both "30" and "7" in one run. Each
// milestone is remembered separately, so 3 and then 1 still arrive as they are
// reached, and a sweep skipped for a few days (server down, deploy) still
// delivers the most urgent applicable warning instead of missing the window.
export const EXPIRY_WARNING_MILESTONES = [30, 7, 3, 1];

// Idempotency without a new table: a warning is "already sent" when a
// SUBSCRIPTION notification for this exact subscription+milestone already
// exists for this receiver. The sweep is therefore safe to re-run any
// number of times a day — the second run finds the rows the first one wrote
// and sends nothing. Keyed on subscriptionId (not userId) so that a genuine
// renewal, which changes endDate, is a fresh warning cycle only once the
// milestone is crossed again.
export const hasExpiryWarningBeenSent = async (
  receiverId: number,
  subscriptionId: number,
  milestone: number
): Promise<boolean> => {
  const existing = await Notification.findOne({
    where: {
      receiverId,
      type: NotificationType.SUBSCRIPTION,
      data: { event: "ACCESS_EXPIRING_SOON", subscriptionId, milestone },
    },
    attributes: ["id"],
  });
  return !!existing;
};

// Returns the number of receivers actually warned (0 when everyone in the
// audience had already been warned at this milestone).
export const notifyExpiringSoon = async (params: {
  ownerUserId: number;
  subscriptionId: number;
  milestone: number;
  daysRemaining: number;
  endDate: Date;
}): Promise<number> => {
  const { ownerUserId, subscriptionId, milestone, daysRemaining, endDate } = params;
  const audience = await getAccessAudience(ownerUserId).catch(() => [ownerUserId]);

  const dayWord = daysRemaining === 1 ? "day" : "days";
  const title = "Your SalesVera access is expiring soon";
  const body =
    daysRemaining <= 0
      ? `Your SalesVera access expires today (${fmtDate(endDate)}).`
      : `Your SalesVera access expires in ${daysRemaining} ${dayWord}, on ${fmtDate(endDate)}. Request an extension to avoid interruption.`;

  let sent = 0;
  for (const receiverId of audience) {
    if (await hasExpiryWarningBeenSent(receiverId, subscriptionId, milestone).catch(() => true)) continue;
    await notifyQuietly({
      receiverId,
      senderId: null,
      type: NotificationType.SUBSCRIPTION,
      title,
      body,
      data: { event: "ACCESS_EXPIRING_SOON", subscriptionId, milestone, daysRemaining, endDate },
    });
    sent += 1;
  }
  return sent;
};

// Sent once, by the same sweep, the first time a subscription is actually
// found past its endDate — the "your access has now stopped" counterpart to
// the countdown warnings above.
export const notifyExpired = async (params: {
  ownerUserId: number;
  subscriptionId: number;
  endDate: Date;
}): Promise<number> => {
  const { ownerUserId, subscriptionId, endDate } = params;
  const audience = await getAccessAudience(ownerUserId).catch(() => [ownerUserId]);

  let sent = 0;
  for (const receiverId of audience) {
    const already = await Notification.findOne({
      where: {
        receiverId,
        type: NotificationType.SUBSCRIPTION,
        data: { event: "ACCESS_EXPIRED", subscriptionId },
      },
      attributes: ["id"],
    }).catch(() => null);
    if (already) continue;

    await notifyQuietly({
      receiverId,
      senderId: null,
      type: NotificationType.SUBSCRIPTION,
      title: "Your SalesVera access has expired",
      body: `Your SalesVera access expired on ${fmtDate(endDate)}. Request an extension to restore access.`,
      data: { event: "ACCESS_EXPIRED", subscriptionId, endDate },
    });
    sent += 1;
  }
  return sent;
};
