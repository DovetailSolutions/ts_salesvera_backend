// Separation — automatic login deactivation after the approved last working
// day (separation.service.ts deactivateDueSeparations).
//
// Uses the QA tenant only. The daily job is run in a child process scoped to
// the QA request id (opts.requestIds), so real employees on the same DB are
// never touched even though the job is run with a future "today".
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { api, login, requireEnv, QA_PASSWORD, QA_OWNER_EMAIL } from "./helpers.mjs";

// A fresh employee per run: a finished run leaves its request deactivated
// (by design it can no longer be withdrawn), so it cannot be reused.
const SEP_EMPLOYEE_EMAIL = `qa-sep-${Date.now()}@salesvera.test`;
const QA_ADMIN_EMAIL = "qa-plan-admin2@salesvera.test";
const BACKEND_DIR = new URL("../../", import.meta.url);

let sa, owner, employee, ownerId, companyId, employeeId, requestId;

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** Runs the real job for the QA request only, with the given "today". */
const runJob = (today) => {
  const out = execFileSync(
    process.execPath,
    ["-r", "ts-node/register/transpile-only", "tests/api/runSeparationJob.cjs", today, String(requestId)],
    { cwd: BACKEND_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const line = out.split("\n").find((l) => l.startsWith("RESULT"));
  return JSON.parse(line.slice(6));
};

before(async () => {
  sa = await login(requireEnv("SUPERADMIN_EMAIL"), requireEnv("SUPERADMIN_PASSWORD"));
  owner = await login(QA_OWNER_EMAIL, QA_PASSWORD);
  ownerId = (await api("GET", "/admin/getprofile", owner)).body?.data?.user?.id;
  assert.ok(ownerId, "QA owner id");

  // QA company (created once, reused).
  let companies = (await api("GET", "/admin/my-companies", owner)).body?.data;
  companies = Array.isArray(companies) ? companies : companies?.data ?? companies?.rows ?? [];
  if (!companies.length) {
    const c = await api("POST", "/admin/addcompany", owner, {
      companyName: "QA Plan Company", legalName: "QA Plan Company Pvt Ltd", registrationNo: "QA-REG-0001",
      companyEmail: "qa-company@salesvera.test", companyPhone: "9000000001",
    });
    assert.ok([200, 201].includes(c.status), `create company: ${JSON.stringify(c.body).slice(0, 300)}`);
    companies = (await api("GET", "/admin/my-companies", owner)).body?.data;
    companies = Array.isArray(companies) ? companies : companies?.data ?? companies?.rows ?? [];
  }
  companyId = companies[0]?.id;
  assert.ok(companyId, "QA company id");
  owner = await login(QA_OWNER_EMAIL, QA_PASSWORD); // token now carries the company

  // QA tenant only: lift the user limit so per-run employees never hit it.
  const subs = await api("GET", `/admin/super-admin/subscriptions?search=${encodeURIComponent(QA_OWNER_EMAIL)}`, sa);
  const subId = subs.body?.data?.data?.[0]?.id;
  assert.ok(subId, "QA subscription");
  await api("PATCH", `/admin/super-admin/subscriptions/${subId}`, sa, { maxEmployees: null, reason: "QA separation test" });

  // Employees resolve their company through their creator: an admin whose
  // Company.adminId points at them (tokenCheck.resolveCompanyId). Set that
  // up once for the QA company, the same way a real company is wired.
  let adminId;
  try {
    const t = await login(QA_ADMIN_EMAIL, QA_PASSWORD);
    adminId = (await api("GET", "/admin/getprofile", t)).body?.data?.user?.id;
  } catch {
    const a = await api("POST", "/admin/super-admin/users", sa, {
      email: QA_ADMIN_EMAIL, password: QA_PASSWORD, firstName: "QA", lastName: "Admin",
      role: "admin", tenantId: ownerId, companyId, createdBy: ownerId,
    });
    assert.ok([200, 201].includes(a.status), `create admin: ${JSON.stringify(a.body).slice(0, 300)}`);
    const t = await login(QA_ADMIN_EMAIL, QA_PASSWORD);
    adminId = (await api("GET", "/admin/getprofile", t)).body?.data?.user?.id;
  }
  assert.ok(adminId, "QA admin id");
  const link = await api("PATCH", `/admin/assign-admin/${companyId}`, owner, { adminId });
  assert.ok(link.status < 300, `assign admin: ${JSON.stringify(link.body).slice(0, 300)}`);

  const r = await api("POST", "/admin/super-admin/users", sa, {
    email: SEP_EMPLOYEE_EMAIL, password: QA_PASSWORD, firstName: "QA", lastName: "Separation",
    role: "employee", tenantId: ownerId, companyId, createdBy: adminId,
  });
  assert.ok([200, 201].includes(r.status), `create employee: ${JSON.stringify(r.body).slice(0, 300)}`);
  employee = await login(SEP_EMPLOYEE_EMAIL, QA_PASSWORD);
  employeeId = employeeId ?? (await api("GET", "/admin/getprofile", employee)).body?.data?.user?.id;
});

test("SEP-01 Employee submits a resignation; login stays active", async () => {
  const r = await api("POST", "/admin/separation/my", employee, {
    reason: "personal", resignationDate: istToday(), comments: "QA automated test",
  });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.body).slice(0, 300));
  requestId = r.body?.data?.id ?? r.body?.data?.request?.id;
  assert.ok(requestId, "request id");
  assert.match(r.body.data.status ?? r.body.data.request?.status, /pending_(admin|manager)_approval/);
  const still = await api("GET", "/admin/getprofile", employee);
  assert.equal(still.status, 200, "not deactivated on submission");
});

test("SEP-02 Employee cannot review their own request", async () => {
  const r = await api("POST", `/admin/separation/requests/${requestId}/admin-review`, employee, { decision: "approve" });
  assert.equal(r.status, 403);
});

test("SEP-03 Admin approves with an early-release last working day of today", async () => {
  const r = await api("POST", `/admin/separation/requests/${requestId}/admin-review`, owner, {
    decision: "approve", adjustment: "early_release", approvedLastWorkingDay: istToday(),
    adjustmentReason: "QA test: release today",
  });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.data.status, "notice_period");
});

test("SEP-04 Job does nothing on the last working day itself", async () => {
  const res = runJob(istToday());
  assert.deepEqual(res, { checked: 0, deactivated: 0 });
  assert.equal((await api("GET", "/admin/getprofile", employee)).status, 200);
});

test("SEP-05 Job deactivates the login the day after the LWD", async () => {
  const res = runJob(addDays(istToday(), 1));
  assert.deepEqual(res, { checked: 1, deactivated: 1 });
  const r = await api("GET", "/admin/getprofile", employee);
  assert.equal(r.status, 403, "deactivated user is refused");
});

test("SEP-06 Re-running the job is a no-op (idempotent)", async () => {
  assert.deepEqual(runJob(addDays(istToday(), 1)), { checked: 0, deactivated: 0 });
  assert.deepEqual(runJob(addDays(istToday(), 5)), { checked: 0, deactivated: 0 });
});

test("SEP-07 Request and audit history are kept; deactivation is audited once", async () => {
  const r = await api("GET", `/admin/separation/requests/${requestId}`, owner);
  assert.equal(r.status, 200);
  const d = r.body.data.request ?? r.body.data;
  assert.equal(d.status, "notice_period", "status unchanged by deactivation");
  assert.ok(d.accountDeactivatedAt, "accountDeactivatedAt set");
  const trail = r.body.data.auditTrail ?? r.body.data.audit ?? r.body.data.timeline ?? [];
  const rows = trail.filter((a) => a.action === "account_deactivated");
  assert.equal(rows.length, 1, `one deactivation audit row: ${JSON.stringify(trail).slice(0, 300)}`);
  assert.equal(rows[0].actorRole, "system");
});

test("SEP-08 Admin withdraw after deactivation is refused with guidance", async () => {
  const r = await api("POST", `/admin/separation/requests/${requestId}/withdraw`, owner, { reason: "QA test" });
  assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
  assert.match(r.body.message, /Reactivate the employee/);
});
