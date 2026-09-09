import dotenv from "dotenv";
dotenv.config();

// ============================================================
// Startup environment validation.
//
// Import this module FIRST (before dbConnection/jwtVerify/etc.) so the
// process fails fast with a clear error instead of silently falling back
// to insecure defaults (a hardcoded JWT secret, a "default_db"/"default_user"
// Postgres connection) that previously masked misconfiguration.
// ============================================================

const REQUIRED_ENV_VARS = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER_NAME",
  "DB_PASSWORD",
  "JWT_SECRET",
] as const;

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `❌ Missing required environment variable(s): ${missing.join(", ")}. ` +
      `Set them in a .env file — see docs/local-dev-setup.md for local development.`
  );
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET as string;
export const DB_HOST = process.env.DB_HOST as string;
export const DB_PORT = process.env.DB_PORT as string;
export const DB_NAME = process.env.DB_NAME as string;
export const DB_USER_NAME = process.env.DB_USER_NAME as string;
export const DB_PASSWORD = process.env.DB_PASSWORD as string;

// ── Web login refresh-token architecture ────────────────────────────────
// See auth.routes.ts (/admin/login, /admin/refreshtoken, /admin/logout) and
// webToken.service.ts. Deliberately separate from JWT_SECRET (used for the
// short-lived access token, unchanged, so every existing tokenCheck-gated
// route keeps working with zero changes) — falls back to a JWT_SECRET
// derivative only so a fresh checkout without a dedicated secret still
// boots; production should set a real, independently-generated value.
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || `${JWT_SECRET}::refresh`;
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";
export const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// ── Attendance Regularization ────────────────────────────────────────────
// How many days back from today a Sale Person may still request a
// correction for — see modules/attendanceRegularization. No existing
// attendance-correction policy was found in this codebase to reuse.
export const ATTENDANCE_REGULARIZATION_DAYS = Number(process.env.ATTENDANCE_REGULARIZATION_DAYS) || 7;
