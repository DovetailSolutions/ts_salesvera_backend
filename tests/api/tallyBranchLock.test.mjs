// Branch visibility with Tally: connected → employees/managers see only the
// main branch; not connected → the per-user Branch List toggle decides
// (unchanged). Uses its own fresh QA tenant (".test" e-mails) so the
// "not connected" state is real.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { api, login, requireEnv, QA_PASSWORD } from "./helpers.mjs";
import { grantTemplate, RUN } from "./fixtures.mjs";

let sa, owner, ownerId, companyId, admin, adminId, mgr, emp, empOff, branchIds = {};
const mail = (tag) => `qa-tbl-${tag}-${RUN}@salesvera.test`;

const createUser = async (role, tag, extra = {}) => {
  const email = mail(tag);
  const r = await api("POST", "/admin/super-admin/users", sa, {
    email, password: QA_PASSWORD, firstName: "QA", lastName: `TBL ${tag}`, role, ...extra,
  });
  assert.ok(r.status < 300, `create ${role}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const token = await login(email, QA_PASSWORD);
  const id = (await api("GET", "/admin/getprofile", token)).body?.data?.user?.id;
  return { id, email, token };
};

const addBranch = async (name, code) => {
  const r = await api("POST", "/admin/addbranch", admin.token, {
    branchName: name, branchCode: `${code}${String(RUN).slice(-5)}`, branchCity: "Mohali", branchState: "Punjab",
    branchCountry: "India", postalCode: "160055", addressLine1: "QA", latitude: 30.7, longitude: 76.7, geoRadius: 100,
    companyId, branchEmail: `qa-${code.toLowerCase()}@salesvera.test`, branchPhone: "9000000003",
  });
  assert.ok(r.status < 300, `branch ${name}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.data.id ?? r.body.data.branch?.id;
};

const profileBranches = async (u) => {
  const r = await api("GET", "/api/getprofile", u.token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const c = r.body.data?.company ?? r.body.data?.user?.company ?? r.body.data?.profile?.company;
  return { ids: (c?.branches ?? null)?.map((b) => Number(b.id)) ?? null, mode: c?.branchListMode };
};
const apiBranches = async (u) => {
  const r = await api("GET", `/api/getbranch?companyId=${companyId}&limit=100`, u.token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  return r.body.data.branches.map((b) => Number(b.id)).sort((a, b) => a - b);
};
const setToggle = (u, on) => api("PATCH", `/admin/users/${u.id}/branch-visibility`, admin.token, { canViewAllBranches: on });

before(async () => {
  sa = await login(requireEnv("SUPERADMIN_EMAIL"), requireEnv("SUPERADMIN_PASSWORD"));
  // Fresh tenant: owner → company → admin (primary) → manager + employees.
  const o = await createUser("user", "owner");
  owner = o.token; ownerId = o.id;
  const c = await api("POST", "/admin/addcompany", owner, {
    companyName: `QA TBL Co ${RUN}`, legalName: "QA TBL Pvt Ltd", registrationNo: `QA-TBL-${RUN}`,
    companyEmail: mail("company"), companyPhone: "9000000004",
  });
  assert.ok(c.status < 300, JSON.stringify(c.body).slice(0, 200));
  const companies = (await api("GET", "/admin/my-companies", owner)).body.data;
  companyId = (Array.isArray(companies) ? companies : companies.data ?? companies.rows)[0].id;

  admin = await createUser("admin", "admin", { tenantId: ownerId, companyId, createdBy: ownerId });
  adminId = admin.id;
  assert.ok((await api("PATCH", `/admin/assign-admin/${companyId}`, owner, { adminId })).status < 300);
  await grantTemplate(sa, adminId, "admin");
  admin.token = await login(admin.email, QA_PASSWORD);

  // Main-branch rule: a "Head Office" name wins over the first one registered.
  branchIds.first = await addBranch("QA First Branch", "QF");
  branchIds.head = await addBranch("QA Head Office", "QH");
  branchIds.other = await addBranch("QA Other Branch", "QO");

  mgr = await createUser("manager", "mgr", { tenantId: ownerId, companyId, createdBy: adminId });
  emp = await createUser("employee", "emp", { tenantId: ownerId, companyId, createdBy: adminId });
  empOff = await createUser("employee", "empoff", { tenantId: ownerId, companyId, createdBy: adminId });
});

const ALL = () => [branchIds.first, branchIds.head, branchIds.other].sort((a, b) => a - b);

test("TBL-01 Not connected: mode endpoint says per-user toggle", async () => {
  const r = await api("GET", "/admin/branch-visibility-mode", admin.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.tallyConnected, false);
  assert.equal(r.body.data.mode, "per_user_toggle");
});

test("TBL-02 Not connected: toggle OFF hides the profile branch list (unchanged)", async () => {
  assert.ok((await setToggle(empOff, false)).status < 300);
  const p = await profileBranches(empOff);
  assert.equal(p.ids, null);
  assert.equal(p.mode, "hidden");
});

test("TBL-03 Not connected: toggle ON shows every branch (unchanged)", async () => {
  assert.ok((await setToggle(emp, true)).status < 300);
  const p = await profileBranches(emp);
  assert.deepEqual([...p.ids].sort((a, b) => a - b), ALL());
  assert.equal(p.mode, "all");
});

test("TBL-04 Not connected: manager and mobile branch list unchanged (all branches)", async () => {
  const p = await profileBranches(mgr);
  assert.deepEqual([...p.ids].sort((a, b) => a - b), ALL());
  assert.deepEqual(await apiBranches(emp), ALL());
  assert.deepEqual(await apiBranches(empOff), ALL());
});

test("TBL-05 Connecting Tally (admin saves the Tally GUID) switches the mode", async () => {
  const all = await api("GET", "/admin/permissions/all", sa);
  const permId = all.body.data.permissions.find((p) => p.module === "tally" && p.action === "connect").id;
  assert.ok((await api("POST", "/admin/permissions/assign", sa, { targetUserId: adminId, permissionIds: [permId] })).status < 300);
  admin.token = await login(admin.email, QA_PASSWORD);
  const s = await api("PATCH", "/admin/updateProfile", admin.token, { tallyGuid: `qa-tbl-guid-${RUN}` });
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));

  const r = await api("GET", "/admin/branch-visibility-mode", admin.token);
  assert.equal(r.body.data.tallyConnected, true);
  assert.equal(r.body.data.mode, "tally_main_branch");
  assert.equal(r.body.data.mainBranch.id, branchIds.head, "Head Office is the main branch");
});

test("TBL-06 Connected: employee with toggle ON sees only the main branch", async () => {
  const p = await profileBranches(emp);
  assert.deepEqual(p.ids, [branchIds.head]);
  assert.equal(p.mode, "tally_main_branch");
  assert.deepEqual(await apiBranches(emp), [branchIds.head]);
});

test("TBL-07 Connected: employee with toggle OFF also gets the main branch", async () => {
  const p = await profileBranches(empOff);
  assert.deepEqual(p.ids, [branchIds.head]);
  assert.deepEqual(await apiBranches(empOff), [branchIds.head]);
});

test("TBL-08 Connected: manager sees only the main branch", async () => {
  const p = await profileBranches(mgr);
  assert.deepEqual(p.ids, [branchIds.head]);
  assert.deepEqual(await apiBranches(mgr), [branchIds.head]);
});

test("TBL-09 Connected: admin still sees and manages every branch", async () => {
  const r = await api("GET", `/admin/getbranch?companyId=${companyId}&limit=100`, admin.token);
  assert.equal(r.status, 200);
  const rows = r.body.data?.data ?? r.body.data?.rows ?? r.body.data ?? [];
  assert.deepEqual(rows.map((b) => Number(b.id)).sort((a, b) => a - b), ALL());
});

test("TBL-10 Connected: toggles can still be saved and keep their value", async () => {
  assert.ok((await setToggle(empOff, true)).status < 300);
  const list = await api("GET", "/admin/getalluser?limit=200", admin.token);
  const row = (list.body.data.finalRows ?? []).find((u) => Number(u.id) === Number(empOff.id));
  assert.equal(row?.canViewAllBranches, true, "saved value kept");
  // …but the Tally rule still decides what the employee sees.
  assert.deepEqual((await profileBranches(empOff)).ids, [branchIds.head]);
});

test("TBL-11 Another tenant's company is not affected by this tenant's connection", async () => {
  const other = await createUser("user", "other-owner");
  const r = await api("GET", "/admin/branch-visibility-mode", other.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.tallyConnected, false);
});
