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
const jwtVerify_1 = require("../../config/jwtVerify");
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
router.post("/logout", jwtVerify_1.tokenCheck, AuthController.Logout);
router.get("/getProfile", jwtVerify_1.tokenCheck, AuthController.GetProfile);
router.patch("/updateProfile", jwtVerify_1.tokenCheck, profile.single("profile"), AuthController.UpdateProfile);
router.patch("/updatepassword", jwtVerify_1.tokenCheck, AuthController.UpdatePassword);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/reset-password", AuthController.changePassword);
exports.default = router;
