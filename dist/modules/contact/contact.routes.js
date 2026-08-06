"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactAdminRoutes = exports.contactPublicRoutes = void 0;
const express_1 = require("express");
const jwtVerify_1 = require("../../config/jwtVerify");
const rbac_1 = require("../../app/middlewear/rbac");
const ContactController = __importStar(require("./contact.controller"));
// ============================================================
// POST /api/contact-query — mounted on /api in server.ts, public, no
// tokenCheck: this is the landing page's "Contact Us" form, reachable by
// anyone (logged out visitors included).
// ============================================================
exports.contactPublicRoutes = (0, express_1.Router)();
exports.contactPublicRoutes.post("/contact-query", ContactController.submitQuery);
// ============================================================
// GET/PATCH /admin/contact-queries — mounted on /admin, super_admin only:
// this is the platform's own marketing-lead inbox, not a per-tenant
// feature — admin/manager/user (tenant accounts) never see it.
// ============================================================
exports.contactAdminRoutes = (0, express_1.Router)();
exports.contactAdminRoutes.get("/contact-queries", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)("super_admin"), ContactController.listQueries);
exports.contactAdminRoutes.patch("/contact-queries/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)("super_admin"), ContactController.updateQueryStatus);
