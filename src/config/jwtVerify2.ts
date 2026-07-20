import { createTokenCheck } from "./tokenCheck";

// User/mobile-side auth: user / manager / sale_person.
export const tokenCheck = createTokenCheck(["user", "manager", "sale_person"]);
