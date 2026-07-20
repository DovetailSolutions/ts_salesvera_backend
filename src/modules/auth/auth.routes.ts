import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { optionalTokenCheck } from "../../config/tokenCheck";
import getUploadMiddleware from "../../config/fileUploads";
import * as AuthController from "./auth.controller";

// ============================================================
// Auth routes — mounted directly on the /admin router in server.ts, same
// URL paths as before. This module fully replaces the auth functions that
// used to live in admin.ts/router/admin.ts.
// ============================================================
const router = Router();
const profile = getUploadMiddleware("image");

// FIX: this had no auth at all — anyone could POST role:"admin"/"manager"/
// "sale_person" with an arbitrary createdBy and create accounts inheriting
// that creator's permissions. optionalTokenCheck populates req.userData when
// a valid token is present but never rejects the request outright, because
// role:"super_admin" must stay reachable with no token (there's no seed
// script — the very first super_admin has only ever been created through
// this endpoint). The actual hierarchy/authorization check now lives in
// AuthService.register itself, branching on role using req.userData.
router.post("/register", optionalTokenCheck, AuthController.Register);
router.post("/login", AuthController.Login);
router.post("/logout", tokenCheck, AuthController.Logout);
router.get("/getProfile", tokenCheck, AuthController.GetProfile);
router.patch("/updateProfile", tokenCheck, profile.single("profile"), AuthController.UpdateProfile);
router.patch("/updatepassword", tokenCheck, AuthController.UpdatePassword);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/reset-password", AuthController.changePassword);

export default router;
