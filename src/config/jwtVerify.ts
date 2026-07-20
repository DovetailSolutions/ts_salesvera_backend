import { createTokenCheck } from "./tokenCheck";

// Admin-side auth: user (tenant root) / admin / super_admin / manager.
// sale_person is intentionally excluded — admin routes are off-limits to them.
export const tokenCheck = createTokenCheck(["user", "admin", "super_admin", "manager"]);
