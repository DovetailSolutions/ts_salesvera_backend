"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB_PASSWORD = exports.DB_USER_NAME = exports.DB_NAME = exports.DB_PORT = exports.DB_HOST = exports.JWT_SECRET = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`❌ Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in a .env file — see docs/local-dev-setup.md for local development.`);
    process.exit(1);
}
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.DB_HOST = process.env.DB_HOST;
exports.DB_PORT = process.env.DB_PORT;
exports.DB_NAME = process.env.DB_NAME;
exports.DB_USER_NAME = process.env.DB_USER_NAME;
exports.DB_PASSWORD = process.env.DB_PASSWORD;
