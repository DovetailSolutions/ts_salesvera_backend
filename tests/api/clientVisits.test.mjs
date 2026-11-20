// Pro modules: customers, meetings (schedule, geo check-in, outcome),
// expenses (claim → manager → admin). QA company only.
//
// Optional env for the cross-company check:
//   OTHER_TENANT_EMAIL, OTHER_TENANT_PASSWORD   an admin of a different tenant
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { api, login } from "./helpers.mjs";
import { qaCompany, RUN } from "./fixtures.mjs";

let qa, manager, emp, directEmp, clientId, meetingId, expenseId, expenseId2;
const companyName = `QA Client Co ${RUN}`;
const mobile = `9${String(RUN).slice(-9)}`;
const pick = (b) => b?.data?.data ?? b?.data?.rows ?? b?.data?.clients ?? b?.data?.expenses ?? b?.data ?? [];

before(async () => {
  qa = await qaCompany();
  manager = await qa.newUser("manager", "cv-mgr");
  emp = await qa.newUser("employee", "cv-emp", { createdBy: manager.id });
  directEmp = await qa.newUser("employee", "cv-direct");
});

// ── Customers ────────────────────────────────────────────────────────────
test("CV-01 Admin creates a customer", async () => {
  const r = await api("POST", "/admin/create-client", qa.admin, {
    name: "QA Contact", companyName, email: `qa-client-${RUN}@salesvera.test`, mobile,
    state: "Punjab", country: "India", city: "Mohali", customerType: "new",
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
});

test("CV-02 Customer search finds it", async () => {
  const r = await api("GET", `/admin/get-client?search=${encodeURIComponent(companyName)}`, qa.admin);
  assert.equal(r.status, 200);
  const rows = pick(r.body);
  const c = (Array.isArray(rows) ? rows : []).find((x) => x.companyName === companyName);
  assert.ok(c, `search result: ${JSON.stringify(r.body).slice(0, 300)}`);
  clientId = c.id;
});

test("CV-03 Duplicate customer (same mobile) is refused", async () => {
  const r = await api("POST", "/admin/create-client", qa.admin, {
    name: "Dup", companyName: `${companyName} dup`, mobile, state: "Punjab", country: "India",
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /already|exists|duplicate/i);
});

test("CV-04 Invalid customer e-mail is refused", async () => {
  const r = await api("POST", "/admin/create-client", qa.admin, {
    name: "Bad", companyName: "Bad Co", email: "not-an-email", state: "Punjab", country: "India",
  });
  assert.equal(r.status, 400);
});

test("CV-05 Another tenant's admin cannot open this customer", { skip: !process.env.OTHER_TENANT_EMAIL }, async () => {
  const t = await login(process.env.OTHER_TENANT_EMAIL, process.env.OTHER_TENANT_PASSWORD);
  const r = await api("GET", `/admin/get-client-details/${clientId}`, t);
  assert.ok(r.status >= 400, `status ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
});

// ── Meetings ─────────────────────────────────────────────────────────────
test("MT-00 Unknown meeting purpose gets a clear validation message", async () => {
  const r = await api("POST", "/admin/meetings/schedule", qa.admin, {
    targetUserId: emp.id, meetingUserId: clientId, meetingPurpose: "QA demo",
    scheduledTime: new Date(Date.now() + 7200e3).toISOString(),
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /must be one of/);
});

test("MT-01 Admin schedules a meeting for an employee with the customer", async () => {
  const r = await api("POST", "/admin/meetings/schedule", qa.admin, {
    targetUserId: emp.id, meetingUserId: clientId, meetingPurpose: "demo",
    scheduledTime: new Date(Date.now() + 3600e3).toISOString(),
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  meetingId = r.body?.data?.id ?? r.body?.data?.meeting?.id;
  assert.ok(meetingId, "meeting id");
});

test("MT-02 Same employee, same time: conflict refused", async () => {
  const g = await api("GET", `/admin/getmeetingdetails/${meetingId}`, qa.admin);
  const when = (g.body?.data?.meeting ?? g.body?.data)?.scheduledTime;
  const r = await api("POST", "/admin/meetings/schedule", qa.admin, {
    targetUserId: emp.id, meetingUserId: clientId, meetingPurpose: "demo", scheduledTime: when,
  });
  assert.equal(r.status, 400, JSON.stringify(r.body).slice(0, 200));
});

test("MT-03 Check-in with invalid GPS is refused", async () => {
  const r = await api("POST", "/api/meeting/start", emp.token, { meetingId, latitude_in: 200, longitude_in: 76.7 });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /location/i);
});

test("MT-04 Geo-tagged check-in", async () => {
  const r = await api("POST", "/api/meeting/start", emp.token, { meetingId, latitude_in: 30.7046, longitude_in: 76.7179 });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
});

test("MT-05 Another employee cannot check in to this meeting", async () => {
  const r = await api("POST", "/api/meeting/end", directEmp.token, { meetingId, latitude_out: 30.7, longitude_out: 76.7 });
  assert.equal(r.status, 400);
});

test("MT-06 Check-out with outcome notes is stored with the geo-tags", async () => {
  const r = await api("POST", "/api/meeting/end", emp.token, {
    meetingId, latitude_out: 30.7101, longitude_out: 76.7201, remarks: "QA outcome: interested",
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  const g = await api("GET", `/admin/getmeetingdetails/${meetingId}`, qa.admin);
  const m = g.body?.data?.meeting ?? g.body?.data;
  assert.equal(g.status, 200, JSON.stringify(g.body).slice(0, 200));
  assert.equal(String(m.latitude_in), "30.7046");
  assert.equal(String(m.latitude_out), "30.7101");
  assert.match(JSON.stringify(m), /QA outcome: interested/);
});

// ── Expenses ─────────────────────────────────────────────────────────────
const claim = (token, title, amount) =>
  api("POST", "/admin/expense", token, {
    expenses: [{ title, amount, date: new Date().toISOString().slice(0, 10), category: "Food", description: "QA" }],
  });
const findExpense = async (token, title) => {
  const r = await api("GET", "/admin/getexpense?limit=50", token);
  const rows = pick(r.body);
  return (Array.isArray(rows) ? rows : []).find((e) => e.title === title);
};

test("EXP-01 Employee submits an expense claim", async () => {
  const title = `QA lunch ${RUN}`;
  const r = await claim(emp.token, title, 450);
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  const e = await findExpense(qa.admin, title);
  assert.ok(e, "admin sees the claim");
  expenseId = e.id;
});

test("EXP-02 Admin cannot approve before the manager", async () => {
  const r = await api("PATCH", "/admin/approved-expense", qa.admin, { userId: emp.id, expenseId, approvedBySuperAdmin: "accepted" });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /Manager must approve first/);
});

test("EXP-03 Manager approves, then admin approves", async () => {
  const m = await api("PATCH", "/api/approved-expense", manager.token, { userId: emp.id, expenseId, approvedByAdmin: "accepted" });
  assert.equal(m.status, 200, JSON.stringify(m.body).slice(0, 300));
  const a = await api("PATCH", "/admin/approved-expense", qa.admin, { userId: emp.id, expenseId, approvedBySuperAdmin: "accepted" });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 300));
  assert.equal(a.body.data.expense.approvedBySuperAdmin, "accepted");
});

test("EXP-04 Manager rejects a second claim", async () => {
  const title = `QA taxi ${RUN}`;
  await claim(emp.token, title, 900);
  expenseId2 = (await findExpense(qa.admin, title))?.id;
  const r = await api("PATCH", "/api/approved-expense", manager.token, { userId: emp.id, expenseId: expenseId2, approvedByAdmin: "rejected" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
});

test("EXP-05 Manager cannot approve an expense outside its team", async () => {
  const title = `QA direct ${RUN}`;
  await claim(directEmp.token, title, 100);
  const id = (await findExpense(qa.admin, title))?.id;
  const r = await api("PATCH", "/api/approved-expense", manager.token, { userId: directEmp.id, expenseId: id, approvedByAdmin: "accepted" });
  assert.equal(r.status, 403);
});

test("EXP-06 Employee cannot approve expenses", async () => {
  const r = await api("PATCH", "/admin/approved-expense", emp.token, { userId: emp.id, expenseId: expenseId2, approvedBySuperAdmin: "accepted" });
  assert.equal(r.status, 403);
});

// ── Field activity report ────────────────────────────────────────────────
test("CV-06 Field activity report includes the meeting and expenses", async () => {
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const r = await api("GET", `/admin/reports/generate?companyId=${qa.companyId}&fromDate=${today}&toDate=${today}`, qa.admin);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const d = r.body.data;
  assert.deepEqual(d.excludedByPlan, []);
  assert.ok(d.meetings.some((m) => Number(m.id) === Number(meetingId)), "meeting in report");
  assert.ok(d.expenses.some((e) => Number(e.id) === Number(expenseId)), "expense in report");
});
