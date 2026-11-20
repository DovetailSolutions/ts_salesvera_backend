// Plan change requests: tenant owner asks for another plan, Super Admin
// approves / rejects (POST /admin/access-extension-requests with
// requestType "plan_change"). QA tenant only; restored to Advance after.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { api, planCode } from "./helpers.mjs";
import { qaCompany } from "./fixtures.mjs";

let qa, plans, subId, manager, requestId;
const byTier = (t) => plans.find((p) => p.tier === t && !p.isTrialPlan);

const setPlanDirect = (planId) =>
  api("PATCH", `/admin/super-admin/subscriptions/${subId}`, qa.sa, {
    planId, status: "ACTIVE", endDate: new Date(Date.now() + 30 * 864e5).toISOString(), reason: "plan change test",
  });

const clearPending = async () => {
  const r = await api("GET", "/admin/super-admin/access-extension-requests?status=pending&requestType=plan_change&limit=100", qa.sa);
  const rows = r.body?.data?.data ?? r.body?.data ?? [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (Number(row.ownerUserId) === Number(qa.ownerId)) {
      await api("POST", `/admin/super-admin/access-extension-requests/${row.id}/reject`, qa.sa, { reviewComment: "test cleanup" });
    }
  }
};

before(async () => {
  qa = await qaCompany();
  plans = (await api("GET", "/admin/super-admin/plans", qa.sa)).body.data;
  const subs = await api("GET", `/admin/super-admin/subscriptions?search=qa-plan-owner`, qa.sa);
  subId = subs.body.data.data[0].id;
  manager = await qa.newUser("manager", "pcr-mgr");
  await clearPending();
  assert.equal((await setPlanDirect(byTier("ADVANCE").id)).status, 200);
});

after(async () => {
  if (!qa) return;
  await clearPending();
  await setPlanDirect(byTier("ADVANCE").id);
});

test("PCR-01 Owner cannot request the plan it is already on", async () => {
  const r = await api("POST", "/admin/access-extension-requests", qa.owner, {
    requestType: "plan_change", requestedPlanId: byTier("ADVANCE").id, reason: "same",
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /already on/i);
});

test("PCR-02 The trial plan cannot be requested", async () => {
  const trial = plans.find((p) => p.isTrialPlan);
  const r = await api("POST", "/admin/access-extension-requests", qa.owner, {
    requestType: "plan_change", requestedPlanId: trial.id, reason: "trial",
  });
  assert.equal(r.status, 400);
});

test("PCR-03 A reason is required", async () => {
  const r = await api("POST", "/admin/access-extension-requests", qa.owner, {
    requestType: "plan_change", requestedPlanId: byTier("PRO").id,
  });
  assert.equal(r.status, 400);
});

test("PCR-04 Managers cannot request plan changes", async () => {
  const r = await api("POST", "/admin/access-extension-requests", manager.token, {
    requestType: "plan_change", requestedPlanId: byTier("PRO").id, reason: "x",
  });
  assert.equal(r.status, 403);
});

test("PCR-05 Owner requests Advance → Pro; status shows it pending; a second one is refused", async () => {
  const r = await api("POST", "/admin/access-extension-requests", qa.owner, {
    requestType: "plan_change", requestedPlanId: byTier("PRO").id, reason: "We only need client visits",
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  requestId = r.body?.data?.id;
  assert.ok(requestId, "request id");

  const s = await api("GET", "/admin/access-status", qa.owner);
  assert.equal(Number(s.body.data.pendingRequests.planChange.requestedPlanId), Number(byTier("PRO").id));

  const dup = await api("POST", "/admin/access-extension-requests", qa.owner, {
    requestType: "plan_change", requestedPlanId: byTier("LITE").id, reason: "dup",
  });
  assert.equal(dup.status, 400);
  assert.match(dup.body.message, /pending plan change/i);
});

test("PCR-06 Owner cannot approve its own request", async () => {
  const r = await api("POST", `/admin/super-admin/access-extension-requests/${requestId}/approve`, qa.owner, {});
  assert.equal(r.status, 403);
});

test("PCR-07 Super Admin approves: plan switches to Pro and features follow", async () => {
  const r = await api("POST", `/admin/super-admin/access-extension-requests/${requestId}/approve`, qa.sa, { reviewComment: "OK" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));

  const f = await api("GET", "/admin/subscription/features", qa.owner);
  assert.equal(f.body.data.plan.tier, "PRO");
  assert.equal(planCode(await api("GET", "/admin/assets", qa.admin)), "FEATURE_NOT_IN_PLAN");

  const o = await api("GET", "/admin/subscription/overview", qa.owner);
  assert.ok(o.body.data.history.some((h) => h.changes.some((c) => /Plan: .*→ SalesVera Pro/.test(c))), "history shows the change");

  const n = await api("GET", "/admin/notifications", qa.owner);
  const rows = n.body?.data ?? [];
  assert.ok((Array.isArray(rows) ? rows : []).some((x) => /plan change request was approved/i.test(x.title)), "owner notified");
});

test("PCR-08 Super Admin rejects a request: plan unchanged, owner notified", async () => {
  const r = await api("POST", "/admin/access-extension-requests", qa.owner, {
    requestType: "plan_change", requestedPlanId: byTier("LITE").id, reason: "Cut cost",
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  const rej = await api("POST", `/admin/super-admin/access-extension-requests/${r.body.data.id}/reject`, qa.sa, { reviewComment: "Talk to sales first" });
  assert.equal(rej.status, 200, JSON.stringify(rej.body).slice(0, 300));
  const f = await api("GET", "/admin/subscription/features", qa.owner);
  assert.equal(f.body.data.plan.tier, "PRO");
});

test("PCR-09 Company admin can also request a plan change", async () => {
  const r = await api("POST", "/admin/access-extension-requests", qa.admin, {
    requestType: "plan_change", requestedPlanId: byTier("ADVANCE").id, reason: "Need assets",
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
});
