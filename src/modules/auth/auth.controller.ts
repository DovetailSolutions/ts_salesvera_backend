import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as AuthService from "./auth.service";

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
    const result = await AuthService.login(req.body);
    createSuccess(res, "Login successful", result);
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
    await AuthService.logout(Number(userData.userId), req.body);
    createSuccess(res, "Logout successful");
  } catch (error) {
    handleServiceError(res, error);
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
