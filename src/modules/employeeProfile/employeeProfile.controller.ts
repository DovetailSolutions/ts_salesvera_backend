import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as Service from "./employeeProfile.service";

// ============================================================
// Thin HTTP layer — mirrors attendanceRegularization.controller.ts's shape.
// ============================================================

const callerContext = (req: Request) => {
  const userData = req.userData as JwtPayload;
  return {
    callerId: Number(userData?.userId),
    callerRole: (userData as any)?.role as string | undefined,
    callerCompanyId: (userData as any)?.companyId ? Number((userData as any).companyId) : null,
  };
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.getProfile(callerContext(req), Number(req.params.userId));
    createSuccess(res, "Employee profile fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.updateProfile(callerContext(req), Number(req.params.userId), req.body || {});
    createSuccess(res, "Employee profile updated", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const listBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.listBankAccounts(callerContext(req), Number(req.params.userId));
    createSuccess(res, "Bank accounts fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const addBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.addBankAccount(callerContext(req), Number(req.params.userId), req.body || {});
    createSuccess(res, "Bank account added", result, 201);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.updateBankAccountDetails(
      callerContext(req),
      Number(req.params.userId),
      Number(req.params.bankAccountId),
      req.body || {}
    );
    createSuccess(res, "Bank account updated", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const deleteBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.deleteBankAccount(
      callerContext(req),
      Number(req.params.userId),
      Number(req.params.bankAccountId)
    );
    createSuccess(res, "Bank account deactivated", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const setPrimaryBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.setPrimaryBankAccount(
      callerContext(req),
      Number(req.params.userId),
      Number(req.params.bankAccountId)
    );
    createSuccess(res, "Primary bank account updated", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const revealBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Service.revealBankAccount(
      callerContext(req),
      Number(req.params.userId),
      Number(req.params.bankAccountId)
    );
    createSuccess(res, "Bank account revealed", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
