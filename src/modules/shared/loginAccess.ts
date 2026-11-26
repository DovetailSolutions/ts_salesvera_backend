// ============================================================
// Login channel control (migration 0057, users.loginAccess).
//
//   both    — web and mobile app (default)
//   web     — web only     → mobile login / mobile tokens refused
//   mobile  — mobile only  → web login / web tokens refused
//
// Channel of a request = the "ch" claim stamped into its access token at
// login: web tokens (webToken.service issueAccessToken) carry "web", mobile
// tokens (Middleware.CreateToken from /api/login, /api/refreshtoken) carry
// "mobile". A token without "ch" (issued before this feature) is not
// restricted — it expires on its own.
// ============================================================

export type LoginAccess = "both" | "web" | "mobile";
export type LoginChannel = "web" | "mobile";

export const LOGIN_ACCESS_VALUES: LoginAccess[] = ["both", "web", "mobile"];

/** Only these roles can be restricted (admins/owners always keep web access). */
export const RESTRICTABLE_ROLES = ["manager", "employee"];

export const normalizeLoginAccess = (v: unknown): LoginAccess =>
  LOGIN_ACCESS_VALUES.includes(v as LoginAccess) ? (v as LoginAccess) : "both";

export const isChannelAllowed = (access: unknown, channel: LoginChannel | string | undefined | null): boolean => {
  if (channel !== "web" && channel !== "mobile") return true; // unknown / legacy token
  const a = normalizeLoginAccess(access);
  return a === "both" || a === channel;
};

export const LOGIN_CHANNEL_BLOCKED = "LOGIN_CHANNEL_BLOCKED";

export const channelBlockedMessage = (channel: LoginChannel) =>
  channel === "web"
    ? "Your account is set to use the mobile app only. Please log in from the SalesVera mobile app."
    : "Your account is set to use the web portal only. Please log in at the SalesVera website.";
