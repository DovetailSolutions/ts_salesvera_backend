import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../../config/env";

// ============================================================
// Token issuance for the WEB login cookie flow only (auth.routes.ts's
// /admin/login, /admin/refreshtoken). Deliberately separate from
// app/middlewear/comman.ts's CreateToken (still used unmodified by mobile's
// /api/login, /api/refreshtoken, and company-switch) — those callers keep
// their existing 30d/60d, both-in-JSON contract exactly as before.
//
// The access token here is signed with the SAME JWT_SECRET and the SAME
// payload shape (`userId`, `role`, `companyId`, `type: "access"`) that
// config/tokenCheck.ts already verifies on every existing protected route
// — only its lifetime differs (ACCESS_TOKEN_EXPIRES_IN, default 15m,
// instead of 30d). Every existing `checkPermission`/`tokenCheck`-gated
// endpoint therefore needs zero changes to accept it.
// ============================================================

// Simple "<number><unit>" duration parser (s/m/h/d) — covers the formats
// this app's env vars actually use. Not a general-purpose duration
// library: unrecognized formats fail loudly rather than silently
// misinterpreting a typo'd env var as milliseconds.
const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
export const parseDurationMs = (value: string): number => {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration format: "${value}" (expected e.g. "15m", "30d")`);
  return Number(match[1]) * UNIT_MS[match[2]];
};

export interface WebTokenPayload {
  userId: number;
  role: string;
  companyId?: number | null;
}

export const issueAccessToken = (payload: WebTokenPayload): string => {
  const claims: Record<string, any> = { userId: payload.userId, role: payload.role, type: "access" };
  if (payload.companyId != null) claims.companyId = Number(payload.companyId);
  return jwt.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions);
};

// The refresh token is a signed JWT purely so its expiry/signature can be
// checked cheaply before ever touching the database — refreshSession
// .service.ts's hash lookup is the actual source of truth for whether it's
// still valid (not yet rotated/revoked), exactly like the flow described
// in the spec: verify signature -> check expiry -> find session -> check
// revokedAt.
export const issueRefreshToken = (payload: WebTokenPayload): { token: string; expiresAt: Date } => {
  const claims: Record<string, any> = {
    userId: payload.userId,
    type: "refresh",
    // Random per-issuance value so two refresh tokens for the same user
    // signed in the same second still hash to different values.
    jti: crypto.randomBytes(16).toString("hex"),
  };
  const token = jwt.sign(claims, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions);
  const expiresAt = new Date(Date.now() + parseDurationMs(REFRESH_TOKEN_EXPIRES_IN));
  return { token, expiresAt };
};

export const verifyRefreshTokenSignature = (token: string): { userId: number } | null => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as any;
    if (decoded?.type !== "refresh" || !decoded?.userId) return null;
    return { userId: Number(decoded.userId) };
  } catch {
    return null;
  }
};
