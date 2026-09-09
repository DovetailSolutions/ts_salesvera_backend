import { Response } from "express";
import { REFRESH_COOKIE_NAME, COOKIE_DOMAIN } from "../../config/env";
import { parseDurationMs } from "./webToken.service";
import { REFRESH_TOKEN_EXPIRES_IN } from "../../config/env";

// ============================================================
// Centralized refresh-cookie configuration — the same options object must
// be used to SET and to CLEAR the cookie (clearCookie matches by
// name+path+domain; a mismatch silently leaves the old cookie in place).
//
// - httpOnly: frontend JS can never read this value (no document.cookie
//   access), which is the entire point of moving the refresh token here.
// - secure: only sent over HTTPS once NODE_ENV=production — left off for
//   local http://localhost dev, where a Secure cookie would simply never
//   be sent at all and silently break every local login.
// - sameSite: "lax" — the browser omits this cookie on cross-site
//   state-changing requests (POST/PUT/DELETE), which is the actual CSRF
//   defense for /admin/refreshtoken and /admin/logout: a forged cross-site
//   POST from an attacker's page won't carry it. Still sent on top-level
//   GET navigation, which is what "Lax" is for and doesn't matter here
//   since both auth endpoints are POST. Not "Strict", which would also
//   drop the cookie on a user navigating in FROM an external link/bookmark
//   on their very first request — an unnecessary UX cost for no extra
//   protection against the actual threat (forged cross-site POSTs).
// - path: "/admin" — scoped to exactly the routes that need it
//   (login/refreshtoken/logout all live under /admin), so it's never sent
//   on unrelated requests.
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/admin",
  domain: COOKIE_DOMAIN,
};

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: parseDurationMs(REFRESH_TOKEN_EXPIRES_IN),
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
};
