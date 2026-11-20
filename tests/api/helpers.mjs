// Shared helpers for the API integration tests (node --test).
//
// Required env:
//   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD   an existing super_admin login
// Optional env:
//   API_BASE_URL       default http://localhost:4800
//   QA_TEST_PASSWORD   password for the QA accounts the tests create
//
// The tests only ever touch accounts under the reserved ".test" domain
// (QA_OWNER_EMAIL / QA_EMPLOYEE_EMAIL); real tenants are read, never changed.

export const BASE = process.env.API_BASE_URL || "http://localhost:4800";
export const QA_PASSWORD = process.env.QA_TEST_PASSWORD || "QaPlan@2026";
export const QA_OWNER_EMAIL = "qa-plan-owner@salesvera.test";
export const QA_EMPLOYEE_EMAIL = "qa-plan-employee@salesvera.test";

export const api = async (method, path, token, body) => {
  const send = () => fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let res;
  try {
    res = await send();
  } catch (err) {
    // A pooled keep-alive socket the server already closed (idle > 5s, e.g.
    // after a slow child process) fails at the network level before the
    // request is processed. Retry once — GET only, never a write.
    if (method !== "GET") throw err;
    res = await send();
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, body: json };
};

export const login = async (email, password) => {
  const r = await api("POST", "/admin/login", null, { email, password });
  const token = r.body?.data?.accessToken || r.body?.data?.token;
  if (!token) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return token;
};

export const requireEnv = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required for API tests`);
  return v;
};

/** Code a gated route answered with, or null when it was not refused by the plan gate. */
export const planCode = (r) => {
  const c = r.body?.data?.code;
  return c === "FEATURE_NOT_IN_PLAN" || c === "ADDON_REQUIRED" || c === "SUBSCRIPTION_INACTIVE" ? c : null;
};
