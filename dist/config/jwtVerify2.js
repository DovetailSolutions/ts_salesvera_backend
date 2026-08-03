"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenCheck = void 0;
const tokenCheck_1 = require("./tokenCheck");
// User/mobile-side auth: user / manager / sale_person.
exports.tokenCheck = (0, tokenCheck_1.createTokenCheck)(["user", "manager", "sale_person"]);
