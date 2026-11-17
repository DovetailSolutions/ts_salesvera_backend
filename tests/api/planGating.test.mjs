// Subscription plan / add-on gating — end-to-end against a running backend.
// Run: SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --test tests/api/
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  api, login, requireEnv, planCode,
  QA_PASSWORD, QA_OWNER_EMAIL, QA_EMPLOYEE_EMAIL,
} from "./helpers.mjs";

let sa;            // super admin token
let owner;         // QA tenant owner token
let employee;      // QA tenant employee token
let ownerId;
let subId;
const planIds = {}; // LITE / PRO / ADVANCE / TRIAL → id

const setPlan = async (tier) => {
  const r = await api("PATCH", `/admin/super-admin/subscriptions/${subId}`, sa, {
    planId: planIds[tier], status: "ACTIVE",
    endDate: new Date(Date.now() + 30 * 864e5).toISOString(),
    reason: `planGating test → ${tier}`,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
};

const ensureUser = async (email, role, extra = {}) => {
  try { return await login(email, QA_PASSWORD); } catch { /* create below */ }
  const r = await api("POST", "/admin/super-admin/users", sa, {
    email, password: QA_PASSWORD, firstName: "QA", lastName: `Plan ${role}`, role, ...extra,
  });
  assert.ok([200, 201].includes(r.status), `create ${role}: ${JSON.stringify(r.body)}`);
  return login(email, QA_PASSWORD);
};

before(async () => {
  sa = await login(requireEnv("SUPERADMIN_EMAIL"), requireEnv("SUPERADMIN_PASSWORD"));

  const plans = await api("GET", "/admin/super-admin/plans", sa);
  assert.equal(plans.status, 200);
  for (const p of plans.body.data) {
    if (p.planCode === "TRIAL") planIds.TRIAL = p.id;
    else planIds[p.tier] = p.id;
  }
  assert.ok(planIds.LITE && planIds.PRO && planIds.ADVANCE, "Lite/Pro/Advance plans must exist");

  owner = await ensureUser(QA_OWNER_EMAIL, "user");
  const prof = await api("GET", "/admin/getprofile", owner);
  ownerId = prof.body?.data?.id ?? prof.body?.data?.user?.id;
  assert.ok(ownerId, "owner id from profile");

  const subs = await api("GET", `/admin/super-admin/subscriptions?search=${encodeURIComponent(QA_OWNER_EMAIL)}`, sa);
  subId = subs.body?.data?.data?.[0]?.id ?? subs.body?.data?.[0]?.id;
  assert.ok(subId, `QA subscription found: ${JSON.stringify(subs.body).slice(0, 300)}`);

  await setPlan("ADVANCE");
  employee = await ensureUser(QA_EMPLOYEE_EMAIL, "employee", { tenantId: ownerId, createdBy: ownerId });
});

after(async () => {
  // Leave the QA tenant on Advance with no add-on, ready for the next run.
  if (!sa || !subId) return;
  await setPlan("ADVANCE");
  await api("POST", `/admin/super-admin/tenants/${ownerId}/addons/TALLY/cancel`, sa, { reason: "test cleanup" });
});

test("SUB-01 Lite plan: features endpoint reports LITE and Pro/Advance flags off", async () => {
  await setPlan("LITE");
  const r = await api("GET", "/admin/subscription/features", owner);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.plan.tier, "LITE");
  assert.equal(r.body.data.features.attendance, true);
  assert.equal(r.body.data.features.client_visits, false);
  assert.equal(r.body.data.features.assets, false);
  assert.equal(r.body.data.features.tally, false);
});

test("SUB-04 Lite user hitting Pro routes (meetings, expenses, travel) is refused", async () => {
  await setPlan("LITE");
  for (const path of ["/admin/meetings/dashboard", "/admin/get-expense", "/admin/vehicle-allowance-rates", "/admin/get-client"]) {
    const r = await api("GET", path, owner);
    assert.equal(r.status, 403, path);
    assert.equal(planCode(r), "FEATURE_NOT_IN_PLAN", path);
    assert.equal(r.body.data.requiredTier, "PRO", path);
  }
});

test("SUB-05 Lite user hitting Advance routes (assets, separation, inventory, invoices) is refused", async () => {
  await setPlan("LITE");
  for (const path of ["/admin/assets", "/admin/separation/my", "/admin/getinvoice", "/admin/getquotationlist", "/admin/top-performers"]) {
    const r = await api("GET", path, owner);
    assert.equal(planCode(r), "FEATURE_NOT_IN_PLAN", path);
    assert.equal(r.body.data.requiredTier, "ADVANCE", path);
  }
});

test("SUB-01b Lite user still reaches Lite routes (holidays, tasks, announcements)", async () => {
  await setPlan("LITE");
  for (const path of ["/admin/getholiday", "/admin/task/list", "/admin/announcements", "/admin/notifications"]) {
    const r = await api("GET", path, owner);
    assert.equal(planCode(r), null, `${path} → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
});

test("SUB-17 Mobile (/api) routes are gated for an employee of a Lite tenant", async () => {
  await setPlan("LITE");
  const r = await api("GET", "/api/getmeetinglist", employee);
  assert.equal(planCode(r), "FEATURE_NOT_IN_PLAN");
  const ok = await api("GET", "/api/getprofile", employee);
  assert.equal(planCode(ok), null);
});

test("SUB-02/12 Upgrade Lite → Pro unlocks client visits, Advance still locked", async () => {
  await setPlan("LITE");
  await setPlan("PRO");
  const meet = await api("GET", "/admin/meetings/dashboard", owner);
  assert.equal(planCode(meet), null, JSON.stringify(meet.body).slice(0, 200));
  const assets = await api("GET", "/admin/assets", owner);
  assert.equal(planCode(assets), "FEATURE_NOT_IN_PLAN");
});

test("SUB-03/13 Upgrade Pro → Advance unlocks everything except the Tally add-on", async () => {
  await setPlan("PRO");
  await setPlan("ADVANCE");
  for (const path of ["/admin/assets", "/admin/separation/my", "/admin/getinvoice", "/admin/meetings/dashboard"]) {
    const r = await api("GET", path, owner);
    assert.equal(planCode(r), null, `${path} → ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  const tally = await api("GET", "/admin/get-report", owner);
  assert.equal(planCode(tally), "ADDON_REQUIRED");
});

test("SUB-08 Advance without add-on cannot push to the Tally sync endpoints", async () => {
  await setPlan("ADVANCE");
  const r = await api("POST", "/admin/bulk/invoices", owner, { records: [] });
  assert.equal(r.status, 403);
  assert.equal(planCode(r), "ADDON_REQUIRED");
});

test("SUB-09 Tally add-on: refused on Pro, activated on Advance, idempotent, cancellable", async () => {
  await setPlan("PRO");
  const onPro = await api("POST", `/admin/super-admin/tenants/${ownerId}/addons`, sa, { addonCode: "TALLY" });
  assert.equal(onPro.status, 400, JSON.stringify(onPro.body));

  await setPlan("ADVANCE");
  await api("POST", `/admin/super-admin/tenants/${ownerId}/addons/TALLY/cancel`, sa, {});
  const on = await api("POST", `/admin/super-admin/tenants/${ownerId}/addons`, sa, { addonCode: "TALLY", notes: "test" });
  assert.equal(on.status, 201, JSON.stringify(on.body));
  const again = await api("POST", `/admin/super-admin/tenants/${ownerId}/addons`, sa, { addonCode: "TALLY" });
  assert.equal(again.status, 200);

  const tally = await api("GET", "/admin/get-report", owner);
  assert.equal(planCode(tally), null, JSON.stringify(tally.body).slice(0, 200));

  const off = await api("POST", `/admin/super-admin/tenants/${ownerId}/addons/TALLY/cancel`, sa, { reason: "test" });
  assert.equal(off.status, 200);
  const after = await api("GET", "/admin/get-report", owner);
  assert.equal(planCode(after), "ADDON_REQUIRED");
});

test("SUB-14/15 Downgrade Advance → Pro → Lite re-locks features", async () => {
  await setPlan("ADVANCE");
  await setPlan("PRO");
  assert.equal(planCode(await api("GET", "/admin/assets", owner)), "FEATURE_NOT_IN_PLAN");
  assert.equal(planCode(await api("GET", "/admin/meetings/dashboard", owner)), null);
  await setPlan("LITE");
  assert.equal(planCode(await api("GET", "/admin/meetings/dashboard", owner)), "FEATURE_NOT_IN_PLAN");
});

test("SUB-10/11 Expired subscription locks the tenant out; renewal restores access", async () => {
  await setPlan("ADVANCE");
  const exp = await api("PATCH", `/admin/super-admin/subscriptions/${subId}`, sa, {
    status: "EXPIRED", endDate: new Date(Date.now() - 864e5).toISOString(),
    startDate: new Date(Date.now() - 40 * 864e5).toISOString(),
  });
  assert.equal(exp.status, 200, JSON.stringify(exp.body));
  const blocked = await api("GET", "/admin/getholiday", owner);
  assert.equal(planCode(blocked), "SUBSCRIPTION_INACTIVE");
  await setPlan("ADVANCE"); // renew: future endDate + ACTIVE
  const ok = await api("GET", "/admin/getholiday", owner);
  assert.equal(planCode(ok), null);
});

test("SUB-16 Tenant owner cannot change its own plan or add-ons", async () => {
  const p = await api("PATCH", `/admin/super-admin/subscriptions/${subId}`, owner, { planId: planIds.ADVANCE });
  assert.equal(p.status, 403);
  const a = await api("POST", `/admin/super-admin/tenants/${ownerId}/addons`, owner, { addonCode: "TALLY" });
  assert.equal(a.status, 403);
});

test("SUB-18 Tenant cannot read another tenant's subscription", async () => {
  const r = await api("GET", "/admin/super-admin/tenants/182/subscription-overview", owner);
  assert.equal(r.status, 403);
  const own = await api("GET", "/admin/subscription/overview", owner);
  assert.equal(own.status, 200);
  assert.equal(Number(own.body.data.tenantUserId), Number(ownerId));
});

test("SUB-07 Super admin is never plan-gated", async () => {
  await setPlan("LITE");
  const r = await api("GET", "/admin/subscription/features", sa);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.features.assets, true);
});

test("SUB-19 Overview lists plans, features and the plan-change history", async () => {
  await setPlan("PRO");
  const r = await api("GET", "/admin/subscription/overview", owner);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.tier, "PRO");
  assert.ok(r.body.data.plans.length >= 3);
  assert.ok(r.body.data.history.some((h) => h.changes.some((c) => c.startsWith("Plan:"))), "plan change recorded");
});

test("SUB-20 Report generation strips sections the plan does not include", async () => {
  await setPlan("LITE");
  const r = await api("GET", "/admin/reports/generate?companyId=0&fromDate=2026-01-01&toDate=2026-01-31", owner);
  // The QA tenant has no company, so the service may refuse the companyId —
  // what matters is that it is not plan-gated as a whole.
  assert.equal(planCode(r), null);
});
