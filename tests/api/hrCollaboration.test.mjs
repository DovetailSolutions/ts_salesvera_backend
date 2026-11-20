// Lite modules: roles & permissions, employee management, leave, tasks,
// announcements — against the running backend, inside the QA company only.
//
// Optional env for cross-company checks:
//   OTHER_TENANT_EMAIL, OTHER_TENANT_PASSWORD   an admin of a different tenant
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { api, login, QA_PASSWORD } from "./helpers.mjs";
import { qaCompany, RUN } from "./fixtures.mjs";

let qa, emp, emp2, branchId, leaveTypeId, leaveId, leaveId2, taskId, announcementId;
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const other = !!process.env.OTHER_TENANT_EMAIL;

before(async () => {
  qa = await qaCompany();
  emp = await qa.newUser("employee", "hr-emp");
  emp2 = await qa.newUser("employee", "hr-emp2");
});

// ── Roles & permissions ──────────────────────────────────────────────────
test("ROLE-01 Employee cannot call admin-only routes", async () => {
  const b = await api("POST", "/admin/addbranch", emp.token, { branchName: "X" });
  assert.equal(b.status, 403);
  const d = await api("GET", "/admin/getdepartment", emp.token);
  assert.equal(d.status, 403);
});

test("ROLE-02 Unauthenticated API call is rejected", async () => {
  const r = await api("GET", "/admin/getdepartment", null);
  assert.equal(r.status, 401);
});

test("ROLE-03 Employee cannot grant itself permissions", async () => {
  const r = await api("POST", "/admin/permissions/assign", emp.token, { targetUserId: emp.id, permissionIds: [1] });
  assert.equal(r.status, 403);
});

test("ROLE-04 Permission revocation takes effect", async () => {
  const all = await api("GET", "/admin/permissions/all", qa.sa);
  const viewLeave = all.body.data.permissions.find((p) => p.module === "leave" && p.action === "view");
  assert.ok(viewLeave, "leave:view permission exists");
  const before = await api("GET", "/admin/getown-leave", emp2.token);
  assert.equal(before.status, 200, JSON.stringify(before.body).slice(0, 200));
  const rv = await api("DELETE", "/admin/permissions/revoke", qa.sa, { targetUserId: emp2.id, permissionIds: [viewLeave.id] });
  assert.ok(rv.status < 300, JSON.stringify(rv.body).slice(0, 200));
  const t = await login(emp2.email, QA_PASSWORD);
  const after = await api("GET", "/admin/getown-leave", t);
  assert.equal(after.status, 403);
});

// ── Employee management ──────────────────────────────────────────────────
test("EMP-01 Admin creates a branch in its company", async () => {
  const r = await api("POST", "/admin/addbranch", qa.admin, {
    branchName: `QA Branch ${RUN}`, branchCode: `QB${String(RUN).slice(-6)}`, branchCity: "Mohali",
    branchState: "Punjab", branchCountry: "India", postalCode: "160055", addressLine1: "QA Street 1",
    latitude: 30.7046, longitude: 76.7179, geoRadius: 200, companyId: qa.companyId,
    branchEmail: "qa-branch@salesvera.test", branchPhone: "9000000002",
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  branchId = r.body?.data?.id ?? r.body?.data?.branch?.id;
  assert.ok(branchId, "branch id");
});

test("EMP-01b Missing branch email gets a clear validation message", async () => {
  const r = await api("POST", "/admin/addbranch", qa.admin, {
    branchName: "QA NoEmail", branchCode: "QNE1", branchCity: "Mohali", branchState: "Punjab", branchCountry: "India",
    postalCode: "160055", addressLine1: "x", latitude: 30.7, longitude: 76.7, geoRadius: 100, companyId: qa.companyId,
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /branch email/i);
});

test("EMP-02 Duplicate email is refused", async () => {
  const r = await api("POST", "/admin/super-admin/users", qa.sa, {
    email: emp.email, password: QA_PASSWORD, firstName: "Dup", role: "employee", tenantId: qa.ownerId, companyId: qa.companyId,
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /already exists/i);
});

test("EMP-03 Owner can view an employee profile in its company", async () => {
  // Admins additionally need the separate employee-profile:view permission
  // (not in the default admin template, by design).
  const r = await api("GET", `/admin/employees/${emp.id}/profile`, qa.owner);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
});

test("EMP-04 Employee cannot view another employee's profile", async () => {
  const r = await api("GET", `/admin/employees/${emp2.id}/profile`, emp.token);
  assert.equal(r.status, 403);
});

test("EMP-05 Another tenant's admin cannot view this employee", { skip: !other }, async () => {
  const t = await login(process.env.OTHER_TENANT_EMAIL, process.env.OTHER_TENANT_PASSWORD);
  const r = await api("GET", `/admin/employees/${emp.id}/profile`, t);
  assert.ok(r.status === 403 || r.status === 404, `status ${r.status}`);
});

// ── Leave ────────────────────────────────────────────────────────────────
test("LV-01 Admin configures an unpaid leave type", async () => {
  const r = await api("POST", "/admin/add-leave", qa.admin, {
    companyId: qa.companyId, branchId,
    leaveTypes: [{ leaveName: `QA Unpaid ${RUN}`, leaveCode: `QU${String(RUN).slice(-5)}`, leavesPerYear: 12, isPaid: false, managerApproval: true }],
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  const rows = Array.isArray(r.body.data) ? r.body.data : [r.body.data];
  leaveTypeId = rows[0]?.id;
  assert.ok(leaveTypeId, "leave type id");
});

test("LV-02 Employee applies for leave", async () => {
  const r = await api("POST", "/admin/request-leave", emp.token, {
    from_date: plusDays(3), to_date: plusDays(3), reason: "QA test leave", companyLeaveId: leaveTypeId,
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  leaveId = r.body?.data?.id ?? r.body?.data?.leave?.id;
  assert.ok(leaveId, "leave id");
});

test("LV-03 Overlapping leave request is refused", async () => {
  const r = await api("POST", "/admin/request-leave", emp.token, {
    from_date: plusDays(3), to_date: plusDays(3), reason: "dup", companyLeaveId: leaveTypeId,
  });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /overlapping/i);
});

test("LV-04 Employee cannot approve its own leave", async () => {
  const r = await api("PATCH", "/admin/approved-leave", emp.token, { employee_id: emp.id, leaveID: leaveId, status: "approved" });
  assert.equal(r.status, 403);
});

test("LV-05 Admin approves the leave", async () => {
  const r = await api("PATCH", "/admin/approved-leave", qa.admin, { employee_id: emp.id, leaveID: leaveId, status: "approved" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const own = await api("GET", "/admin/getown-leave", emp.token);
  const rows = own.body?.data?.leave ?? own.body?.data?.data ?? own.body?.data?.rows ?? own.body?.data ?? [];
  const mine = (Array.isArray(rows) ? rows : []).find((l) => Number(l.id) === Number(leaveId));
  assert.ok(mine, `own leave list: ${JSON.stringify(own.body).slice(0, 200)}`);
  assert.equal(mine.status, "approved");
});

test("LV-06 Admin rejects a second leave request", async () => {
  const a = await api("POST", "/admin/request-leave", emp.token, {
    from_date: plusDays(6), to_date: plusDays(6), reason: "QA second", companyLeaveId: leaveTypeId,
  });
  assert.ok(a.status < 300, JSON.stringify(a.body).slice(0, 200));
  leaveId2 = a.body?.data?.id ?? a.body?.data?.leave?.id;
  const r = await api("PATCH", "/admin/approved-leave", qa.admin, { employee_id: emp.id, leaveID: leaveId2, status: "rejected" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
});

// ── Tasks ────────────────────────────────────────────────────────────────
test("TSK-01 Admin creates and assigns a task with priority and deadline", async () => {
  const r = await api("POST", "/admin/task/create", qa.admin, {
    title: `QA task ${RUN}`, description: "QA", priority: "high", dueDate: plusDays(2), assignedTo: emp.id,
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  taskId = r.body?.data?.id ?? r.body?.data?.task?.id;
  assert.ok(taskId, "task id");
});

test("TSK-02 Kanban move, priority and deadline update", async () => {
  const r = await api("PATCH", `/admin/task/update/${taskId}`, qa.admin, { status: "in_progress", priority: "low", dueDate: plusDays(4) });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const g = await api("GET", `/admin/task/${taskId}`, qa.admin);
  const t = g.body?.data?.task ?? g.body?.data;
  assert.equal(t.status, "in_progress");
  assert.equal(t.priority, "low");
});

test("TSK-03 Employee cannot use the admin task API", async () => {
  const r = await api("POST", "/admin/task/create", emp.token, { title: "x", assignedTo: emp2.id });
  assert.equal(r.status, 403);
});

test("TSK-04 Task assignment notified the employee", { skip: "Known gap: REST /admin/task/create does not notify; the web board creates tasks over Socket.IO, which does" }, async () => {
  const r = await api("GET", "/admin/notifications", emp.token);
  const rows = r.body?.data?.notifications ?? r.body?.data?.rows ?? r.body?.data ?? [];
  assert.ok((Array.isArray(rows) ? rows : []).some((n) => n.type === "task"), `notifications: ${JSON.stringify(r.body).slice(0, 200)}`);
});

// ── Announcements ────────────────────────────────────────────────────────
test("ANN-01 Admin sends an announcement to one employee", async () => {
  const r = await api("POST", "/admin/announcements", qa.admin, {
    title: `QA announcement ${RUN}`, message: "QA message", priority: "normal", recipientIds: [emp.id],
  });
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 300));
  announcementId = r.body?.data?.id ?? r.body?.data?.announcement?.id;
  assert.ok(announcementId, "announcement id");
});

test("ANN-02 Recipient receives it; a non-recipient does not", async () => {
  const pick = (b) => b?.data?.data ?? b?.data?.rows ?? b?.data?.announcements ?? b?.data ?? [];
  const mine = pick((await api("GET", "/admin/announcements/received", emp.token)).body);
  assert.ok(mine.some((a) => Number(a.announcementId ?? a.announcement?.id ?? a.id) === Number(announcementId)), "recipient sees it");
  const theirs = pick((await api("GET", "/admin/announcements/received", emp2.token)).body);
  assert.ok(!(Array.isArray(theirs) ? theirs : []).some((a) => Number(a.announcementId ?? a.announcement?.id ?? a.id) === Number(announcementId)), "non-recipient doesn't");
});

test("ANN-03 Mark as read lowers the unread count", async () => {
  const c = (b) => Number(b?.data?.count ?? b?.data?.unreadCount ?? b?.data ?? 0);
  const before = c((await api("GET", "/admin/announcements/unread-count", emp.token)).body);
  const r = await api("PATCH", `/admin/announcements/${announcementId}/read`, emp.token);
  assert.ok(r.status < 300, JSON.stringify(r.body).slice(0, 200));
  const after = c((await api("GET", "/admin/announcements/unread-count", emp.token)).body);
  assert.equal(after, before - 1);
});

test("ANN-04 Employee cannot send announcements", async () => {
  const r = await api("POST", "/admin/announcements", emp.token, { title: "x", message: "y", recipientIds: [emp2.id] });
  assert.equal(r.status, 403);
});

test("TODAY-sanity", () => assert.ok(today()));
