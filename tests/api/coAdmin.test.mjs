// A second ("co-") admin of a company — linked through the CompanyAdmin
// junction and given the same permissions — sees the same data as the
// company's first admin. QA company only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { api, login, QA_PASSWORD } from "./helpers.mjs";
import { qaCompany, RUN } from "./fixtures.mjs";

let qa, copy, copyId;

const count = (b) => {
  const d = b?.data;
  if (b?.total != null) return b.total;
  for (const k of ["totalRecords", "total", "count"]) if (d?.[k] != null) return d[k];
  if (Array.isArray(d)) return d.length;
  for (const k of ["data", "rows", "leave", "users", "finalRows"]) if (Array.isArray(d?.[k])) return d[k].length;
  return null;
};

before(async () => {
  qa = await qaCompany();
  const email = `qa-coadmin-${RUN}@salesvera.test`;
  const c = await api("POST", "/admin/super-admin/users", qa.sa, {
    email, password: QA_PASSWORD, firstName: "QA", lastName: "CoAdmin",
    role: "admin", tenantId: qa.ownerId, companyId: qa.companyId, createdBy: qa.ownerId,
  });
  assert.ok(c.status < 300, JSON.stringify(c.body).slice(0, 200));
  copy = await login(email, QA_PASSWORD);
  copyId = (await api("GET", "/admin/getprofile", copy)).body.data.user.id;
  // Same permissions as the first admin.
  const perms = await api("GET", `/admin/permissions/user/${qa.adminId}`, qa.sa);
  const ids = (perms.body.data.raw ?? []).map((r) => r.permissionId ?? r.permission?.id).filter(Boolean);
  const a = await api("POST", "/admin/permissions/assign", qa.sa, { targetUserId: copyId, permissionIds: ids });
  assert.ok(a.status < 300, JSON.stringify(a.body).slice(0, 200));
  copy = await login(email, QA_PASSWORD);
});

const SAME = [
  "/admin/getalluser?limit=500",
  "/admin/mysaleperson?limit=500",
  "/admin/get-leave-list?limit=500",
  "/admin/getexpense?limit=500",
  "/admin/task/list?limit=500",
  "/admin/separation/requests?limit=100",
  () => `/admin/getbranch?companyId=${qa.companyId}`,
  () => `/admin/get-leave?companyId=${qa.companyId}`,
  () => `/admin/reports/generate?companyId=${qa.companyId}&fromDate=2026-01-01&toDate=2026-12-31`,
];

test("COA-01 Co-admin sees the same lists as the first admin", async () => {
  for (const e of SAME) {
    const path = typeof e === "function" ? e() : e;
    const x = await api("GET", path, qa.admin);
    const y = await api("GET", path, copy);
    assert.equal(y.status, x.status, `${path} status`);
    assert.equal(count(y.body), count(x.body), `${path} count`);
  }
});

test("COA-02 Co-admin sees the first admin's own clients", async () => {
  const x = await api("GET", "/admin/get-client?limit=500", qa.admin);
  const y = await api("GET", "/admin/get-client?limit=500", copy);
  assert.equal(count(y.body), count(x.body));
});

test("COA-03 Co-admin can open the company profile", async () => {
  const r = await api("GET", "/admin/getowncompany", copy);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const rows = Array.isArray(r.body.data) ? r.body.data : [r.body.data];
  assert.ok(rows.some((c) => Number(c.id) === Number(qa.companyId)));
});

test("COA-04 Co-admin is not a member of other tenants' data", { skip: !process.env.OTHER_TENANT_EMAIL }, async () => {
  const other = await login(process.env.OTHER_TENANT_EMAIL, process.env.OTHER_TENANT_PASSWORD);
  const theirs = await api("GET", "/admin/getalluser?limit=5", other);
  const rowsOf = (b) => b?.data?.finalRows ?? b?.data?.data ?? b?.data?.rows ?? [];
  const ids = new Set(rowsOf(theirs.body).map((u) => Number(u.id)));
  const mine = await api("GET", "/admin/getalluser?limit=500", copy);
  const myIds = rowsOf(mine.body).map((u) => Number(u.id));
  assert.ok(ids.size > 0 && myIds.length > 0, "both lists have rows");
  assert.ok(!myIds.some((id) => ids.has(id)), "no other-tenant users");
});
