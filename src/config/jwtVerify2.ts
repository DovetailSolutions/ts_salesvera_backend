import { createTokenCheck } from "./tokenCheck";

// User/mobile-side auth: user / manager / employee.
export const tokenCheck = createTokenCheck(["user", "manager", "employee"]);
