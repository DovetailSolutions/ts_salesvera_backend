// QA company fixture for module tests. Everything is created through the
// real API, only inside the QA tenant (".test" e-mails), and reused across
// runs: QA owner → QA company → QA admin (company admin) → per-run employees.
// Permissions are granted the way the app does it: the role's default
// template (GET /admin/permissions/template/:role) assigned by super admin.
import assert from "node:assert/strict";
import { api, login, requireEnv, QA_PASSWORD, QA_OWNER_EMAIL } from "./helpers.mjs";

export const QA_ADMIN_EMAIL = "qa-plan-admin2@salesvera.test";
export const RUN = Date.now();

const listOf = (body) => {
  const d = body?.data;
  if (Array.isArray(d)) return d;
  return d?.data ?? d?.rows ?? d?.users ?? [];
};

/** Super admin grants a role's default permission template to one user. */
export const grantTemplate = async (sa, userId, role) => {
  const tpl = await api("GET", `/admin/permissions/template/${role}`, sa);
  assert.equal(tpl.status, 200, `template ${role}: ${JSON.stringify(tpl.body).slice(0, 200)}`);
  const r = await api("POST", "/admin/permissions/assign", sa, {
    targetUserId: userId, permissionIds: tpl.body.data.permissionIds,
  });
  assert.ok(r.status < 300, `assign ${role} perms: ${JSON.stringify(r.body).slice(0, 200)}`);
  return tpl.body.data.permissionIds;
};

export const qaCompany = async () => {
  const sa = await login(requireEnv("SUPERADMIN_EMAIL"), requireEnv("SUPERADMIN_PASSWORD"));
  let owner = await login(QA_OWNER_EMAIL, QA_PASSWORD);
  const ownerId = (await api("GET", "/admin/getprofile", owner)).body?.data?.user?.id;
  assert.ok(ownerId, "QA owner");

  let companies = listOf((await api("GET", "/admin/my-companies", owner)).body);
  if (!companies.length) {
    const c = await api("POST", "/admin/addcompany", owner, {
      companyName: "QA Plan Company", legalName: "QA Plan Company Pvt Ltd", registrationNo: "QA-REG-0001",
      companyEmail: "qa-company@salesvera.test", companyPhone: "9000000001",
    });
    assert.ok(c.status < 300, `create company: ${JSON.stringify(c.body).slice(0, 200)}`);
    companies = listOf((await api("GET", "/admin/my-companies", owner)).body);
  }
  const companyId = companies[0]?.id;
  assert.ok(companyId, "QA company");

  // QA tenant only: no user limit, so per-run employees never hit it.
  const subs = await api("GET", `/admin/super-admin/subscriptions?search=${encodeURIComponent(QA_OWNER_EMAIL)}`, sa);
  const subId = subs.body?.data?.data?.[0]?.id;
  await api("PATCH", `/admin/super-admin/subscriptions/${subId}`, sa, { maxEmployees: null, reason: "QA module tests" });

  let adminToken;
  try {
    adminToken = await login(QA_ADMIN_EMAIL, QA_PASSWORD);
  } catch {
    const a = await api("POST", "/admin/super-admin/users", sa, {
      email: QA_ADMIN_EMAIL, password: QA_PASSWORD, firstName: "QA", lastName: "Admin",
      role: "admin", tenantId: ownerId, companyId, createdBy: ownerId,
    });
    assert.ok(a.status < 300, `create admin: ${JSON.stringify(a.body).slice(0, 200)}`);
    adminToken = await login(QA_ADMIN_EMAIL, QA_PASSWORD);
  }
  const adminId = (await api("GET", "/admin/getprofile", adminToken)).body?.data?.user?.id;
  const link = await api("PATCH", `/admin/assign-admin/${companyId}`, owner, { adminId });
  assert.ok(link.status < 300, `assign admin: ${JSON.stringify(link.body).slice(0, 200)}`);
  await grantTemplate(sa, adminId, "admin");
  adminToken = await login(QA_ADMIN_EMAIL, QA_PASSWORD);
  owner = await login(QA_OWNER_EMAIL, QA_PASSWORD);

  /** A fresh active user in the QA company, with the role's default permissions. */
  const newUser = async (role, label, { createdBy = adminId, grant = true } = {}) => {
    const email = `qa-${label}-${RUN}-${Math.floor(Math.random() * 1e4)}@salesvera.test`;
    const r = await api("POST", "/admin/super-admin/users", sa, {
      email, password: QA_PASSWORD, firstName: "QA", lastName: label,
      role, tenantId: ownerId, companyId, createdBy,
    });
    assert.ok(r.status < 300, `create ${role}: ${JSON.stringify(r.body).slice(0, 200)}`);
    let token = await login(email, QA_PASSWORD);
    const id = (await api("GET", "/admin/getprofile", token)).body?.data?.user?.id;
    if (grant) {
      await grantTemplate(sa, id, role);
      token = await login(email, QA_PASSWORD);
    }
    return { id, email, token };
  };

  return { sa, owner, ownerId, admin: adminToken, adminId, companyId, newUser, listOf };
};
