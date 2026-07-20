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
