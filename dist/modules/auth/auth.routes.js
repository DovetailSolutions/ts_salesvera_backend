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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tokenCheck_1 = require("../../config/tokenCheck");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const AuthController = __importStar(require("./auth.controller"));
// ============================================================
// Auth routes — mounted directly on the /admin router in server.ts, same
// URL paths as before. This module fully replaces the auth functions that
// used to live in admin.ts/router/admin.ts.
// ============================================================
const router = (0, express_1.Router)();
const profile = (0, fileUploads_1.default)("image");
// FIX: getProfile/updateProfile/updatepassword/logout carry no role-specific
// business logic — they're "manage my own account" actions every logged-in
// role needs. This router's `tokenCheck` (jwtVerify.ts) excludes sale_person
// by design for genuinely admin-side routes elsewhere in this file, but
// AuthProvider.jsx's login flow calls getProfile immediately after every
// login (any role) to bootstrap the session — a sale_person's login always
// succeeded at the API level, then getProfile 403'd, which the frontend's
// catch block surfaced as a misleading "Login failed. Please check your
// credentials." toast. sale_person could never get past the login screen in
// the web app at all, even though PunchWidget/attendance/leave self-service
// are all explicitly built for that role. Every other role already worked
// here, so only sale_person needed adding — reuse the same self-service
// role set jwtVerify2.ts already defines for the mobile-side self-service
// surface, since these are exactly that kind of route.
const selfServiceTokenCheck = (0, tokenCheck_1.createTokenCheck)(["user", "admin", "super_admin", "manager", "sale_person"]);
// FIX: this had no auth at all — anyone could POST role:"admin"/"manager"/
// "sale_person" with an arbitrary createdBy and create accounts inheriting
// that creator's permissions. optionalTokenCheck populates req.userData when
// a valid token is present but never rejects the request outright, because
// role:"super_admin" must stay reachable with no token (there's no seed
// script — the very first super_admin has only ever been created through
// this endpoint). The actual hierarchy/authorization check now lives in
// AuthService.register itself, branching on role using req.userData.
router.post("/register", tokenCheck_1.optionalTokenCheck, AuthController.Register);
router.post("/login", AuthController.Login);
router.post("/logout", selfServiceTokenCheck, AuthController.Logout);
router.get("/getProfile", selfServiceTokenCheck, AuthController.GetProfile);
router.patch("/updateProfile", selfServiceTokenCheck, profile.single("profile"), AuthController.UpdateProfile);
router.patch("/updatepassword", selfServiceTokenCheck, AuthController.UpdatePassword);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/reset-password", AuthController.changePassword);
exports.default = router;
