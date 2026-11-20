// tally:connect permission — connecting Tally (saving the Tally company GUID
// on the profile) and pushing data from Tally (/admin/bulk/*).
// QA tenant only; the Tally add-on is switched on for the test and off after.
//
// Optional env (an existing Tally user that must keep working):
//   OTHER_TENANT_EMAIL, OTHER_TENANT_PASSWORD
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { api, login, planCode, QA_PASSWORD } from "./helpers.mjs";
import { qaCompany, RUN } from "./fixtures.mjs";

let qa, adm, emp, tallyPermId;
const guid = `qa-tally-guid-${RUN}`;

const grant = (userId) => api("POST", "/admin/permissions/assign", qa.sa, { targetUserId: userId, permissionIds: [tallyPermId] });
const revoke = (userId) => api("DELETE", "/admin/permissions/revoke", qa.sa, { targetUserId: userId, permissionIds: [tallyPermId] });
const relogin = async (u) => (u.token = await login(u.email, QA_PASSWORD));
const addon = (on) =>
  on
    ? api("POST", `/admin/super-admin/tenants/${qa.ownerId}/addons`, qa.sa, { addonCode: "TALLY", notes: "tally permission test" })
    : api("POST", `/admin/super-admin/tenants/${qa.ownerId}/addons/TALLY/cancel`, qa.sa, { reason: "tally permission test" });

before(async () => {
  qa = await qaCompany();
  const all = await api("GET", "/admin/permissions/all", qa.sa);
  tallyPermId = all.body.data.permissions.find((p) => p.module === "tally" && p.action === "connect")?.id;
  adm = await qa.newUser("admin", "tally-adm");
  emp = await qa.newUser("employee", "tally-emp");
});

after(async () => {
  if (qa) await addon(false);
});

test("TP-01 tally:connect exists in the permission catalogue", () => {
  assert.ok(tallyPermId, "permission id");
});

test("TP-02 The default admin template does not include it (explicit grant only)", async () => {
  const my = await api("GET", "/admin/permissions/my", adm.token);
  assert.equal(my.body.data.matrix?.tally?.connect, undefined);
});

test("TP-03 Without the permission, saving a Tally GUID is refused and nothing is saved", async () => {
  const r = await api("PATCH", "/admin/updateProfile", adm.token, { tallyGuid: guid, tallyName: "QA Tally Co" });
  assert.equal(r.status, 403, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.data.code, "TALLY_PERMISSION_REQUIRED");
  const p = await api("GET", "/admin/getprofile", adm.token);
  assert.notEqual(p.body.data.user.tallyGuid, guid);
});

test("TP-04 Without the permission, normal profile edits still work", async () => {
  const r = await api("PATCH", "/admin/updateProfile", adm.token, { firstName: "QA", lastName: "TallyAdmin" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
});

test("TP-05 With the permission, the Tally GUID, name and start date are saved", async () => {
  assert.ok((await grant(adm.id)).status < 300);
  await relogin(adm);
  const r = await api("PATCH", "/admin/updateProfile", adm.token, {
    tallyGuid: guid, tallyName: "QA Tally Co", tallyStartDate: "2026-04-01",
  });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const p = await api("GET", "/admin/getprofile", adm.token);
  assert.equal(p.body.data.user.tallyGuid, guid);
  assert.equal(p.body.data.user.tallyName, "QA Tally Co");
});

test("TP-06 After revoking, re-sending the SAME Tally values with a name edit still works", async () => {
  assert.ok((await revoke(adm.id)).status < 300);
  await relogin(adm);
  const r = await api("PATCH", "/admin/updateProfile", adm.token, { tallyGuid: guid, tallyName: "QA Tally Co", firstName: "QA2" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
});

test("TP-07 After revoking, CHANGING the Tally GUID is refused", async () => {
  const r = await api("PATCH", "/admin/updateProfile", adm.token, { tallyGuid: `${guid}-changed` });
  assert.equal(r.status, 403);
});

test("TP-08 Bulk sync without the Tally add-on is refused by the plan, even with the permission", async () => {
  await addon(false);
  await grant(adm.id);
  await relogin(adm);
  const r = await api("POST", "/admin/bulk/clients", adm.token, { records: [] });
  assert.equal(planCode(r), "ADDON_REQUIRED");
});

test("TP-09 Add-on on, permission on: bulk sync is allowed", async () => {
  const a = await addon(true);
  assert.ok(a.status < 300, JSON.stringify(a.body).slice(0, 200));
  const r = await api("POST", "/admin/bulk/clients", adm.token, { records: [] });
  assert.notEqual(r.status, 403, JSON.stringify(r.body).slice(0, 200));
  assert.equal(planCode(r), null);
});

test("TP-10 Add-on on, permission off: every bulk sync endpoint is refused", async () => {
  await revoke(adm.id);
  await relogin(adm);
  for (const p of ["invoices", "quotations", "clients", "stock-items", "masters"]) {
    const r = await api("POST", `/admin/bulk/${p}`, adm.token, { records: [] });
    assert.equal(r.status, 403, p);
    assert.match(r.body.message, /tally:connect/, p);
  }
});

test("TP-11 Employees cannot use bulk sync even with the permission (role rule unchanged)", async () => {
  await grant(emp.id);
  await relogin(emp);
  const r = await api("POST", "/admin/bulk/clients", emp.token, { records: [] });
  assert.equal(r.status, 403);
});

test("TP-12 Mobile /api/updateprofile is unchanged (name edits work without the permission)", async () => {
  const fresh = await qa.newUser("employee", "tally-mob");
  const r = await api("PATCH", "/api/updateprofile", fresh.token, { firstName: "QA", lastName: "Mobile" });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
});

test("TP-13 Admins who can't hold the permission can't grant it either", async () => {
  // adm no longer holds tally:connect → it cannot hand it to an employee.
  const r = await api("POST", "/admin/permissions/assign", adm.token, { targetUserId: emp.id, permissionIds: [tallyPermId] });
  assert.ok(r.status >= 400, `status ${r.status}`);
});

test("TP-14 Existing Tally user keeps the permission (backfill)", { skip: !process.env.OTHER_TENANT_EMAIL }, async () => {
  const t = await login(process.env.OTHER_TENANT_EMAIL, process.env.OTHER_TENANT_PASSWORD);
  const my = await api("GET", "/admin/permissions/my", t);
  assert.equal(my.body.data.matrix?.tally?.connect, true);
});
