// ============================================================
// Attendance channel control (migration 0058, users.attendanceAccess).
//
//   both    — punch in/out from the web portal and the mobile app (default)
//   mobile  — punch in/out from the mobile app only
//
// Login is never restricted by this — only /admin/attendance/punch-in and
// /punch-out. Channel of a request = the "ch" claim stamped into its access
// token at login: web tokens (webToken.service issueAccessToken) carry "web",
// mobile tokens (Middleware.CreateToken from /api/login, /api/refreshtoken)
// carry "mobile". A token without "ch" (issued before this) isn't restricted.
// ============================================================

export type AttendanceAccess = "both" | "mobile";

export const ATTENDANCE_ACCESS_VALUES: AttendanceAccess[] = ["both", "mobile"];

/** Only these roles can be restricted (admins/owners are never limited). */
export const RESTRICTABLE_ROLES = ["manager", "employee"];

export const normalizeAttendanceAccess = (v: unknown): AttendanceAccess =>
  ATTENDANCE_ACCESS_VALUES.includes(v as AttendanceAccess) ? (v as AttendanceAccess) : "both";

/** May this user punch in/out from a request on `channel` ("web" | "mobile" | undefined)? */
export const canMarkAttendanceFrom = (access: unknown, channel: unknown): boolean => {
  if (channel !== "web") return true; // mobile, or a legacy token with no channel
  return normalizeAttendanceAccess(access) === "both";
};

export const ATTENDANCE_CHANNEL_BLOCKED = "ATTENDANCE_CHANNEL_BLOCKED";

export const attendanceBlockedMessage =
  "Your admin has set your attendance to the mobile app only. Please punch in/out from the SalesVera mobile app.";
