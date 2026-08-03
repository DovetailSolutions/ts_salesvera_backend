"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenCheck = void 0;
const tokenCheck_1 = require("./tokenCheck");
// Admin-side auth: user (tenant root) / admin / super_admin / manager.
// sale_person is intentionally excluded — admin routes are off-limits to them.
exports.tokenCheck = (0, tokenCheck_1.createTokenCheck)(["user", "admin", "super_admin", "manager"]);
