import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, unauthorized } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import { REFRESH_COOKIE_NAME } from "../../config/env";
import { setRefreshCookie, clearRefreshCookie } from "./refreshCookie";
import * as AuthService from "./auth.service";

const requestMeta = (req: Request) => ({
  userAgent: req.headers["user-agent"] || null,
  ipAddress: req.ip || null,
});

// ============================================================
// Auth controller — thin HTTP layer, extracted verbatim from admin.ts's
// Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword/
// forgotPassword/verifyOtp/changePassword.
// ============================================================

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) return badRequest(res, error.message);
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage, error);
};

export const Register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { item, accessToken, role } = await AuthService.register(req.body, req.userData as any);
    createSuccess(res, `${role} registered successfully`, { item, accessToken });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await AuthService.login(req.body, requestMeta(req));
    // The refresh token is set as an HttpOnly cookie here, server-side —
    // it must never appear in the JSON body the browser's JS can read.
    setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...safeResult } = result;
    createSuccess(res, "Login successful", safeResult);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const Logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await AuthService.logout(Number(userData.userId), req.body, cookieToken);
    clearRefreshCookie(res);
    createSuccess(res, "Logout successful");
  } catch (error) {
    handleServiceError(res, error);
  }
};

// POST /admin/refreshtoken — reads the HttpOnly refresh cookie (never a
// request body/header value, which the frontend never has access to send
// anyway), rotates the session, and returns a new access token. Response
// shape is a flat `{ accessToken }` — matches exactly what the existing
// frontend axios interceptor (api/axiosInstance.js) already reads via
// `r.data.accessToken`, which predates this endpoint actually existing.
export const RefreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await AuthService.refresh(cookieToken, requestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ success: true, accessToken: result.accessToken });
  } catch (error) {
    // Refresh failures are always a clean 401 with no internal detail
    // (JWT verify errors, DB errors) ever reaching the response — the
    // frontend only needs to know "session's gone, show login".
    clearRefreshCookie(res);
    if (error instanceof ServiceError) {
      unauthorized(res, "Authentication session expired");
      return;
    }
    console.error("RefreshToken error:", error);
    unauthorized(res, "Authentication session expired");
  }
};

export const GetProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { userId, role, companyId } = userData as any;
    const result = await AuthService.getProfile(Number(userId), role, companyId);
    createSuccess(res, "User profile fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const UpdateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { userId } = userData as any;
    const result = await AuthService.updateProfile(Number(userId), req.body, req.file as any);
    createSuccess(res, "Profile updated successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const UpdatePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    await AuthService.updatePassword(Number(userData.userId), req.body);
    createSuccess(res, "Password updated successfully");
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    await AuthService.forgotPassword(req.body);
    createSuccess(res, "OTP sent to your email");
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    await AuthService.verifyOtp(req.body);
    createSuccess(res, "OTP verified successfully");
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    await AuthService.changePassword(req.body);
    createSuccess(res, "Password changed successfully");
  } catch (error) {
    handleServiceError(res, error);
  }
};
