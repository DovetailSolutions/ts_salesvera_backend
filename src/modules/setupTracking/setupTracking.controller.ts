import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { ServiceError } from "../shared/serviceError";
import * as SetupTrackingService from "./setupTracking.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return res.status(400).json({ success: false, message });
};

export const getTenantSetup = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = Number(req.params.id);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const data = await SetupTrackingService.getTenantSetupStatus(targetUserId);
    res.status(200).json({ success: true, message: "Tenant setup status fetched", data });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const setTenantSetup = (action: "complete" | "skip" | "reopen") =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userData = req.userData as JwtPayload;
      const targetUserId = Number(req.params.id);
      if (isNaN(targetUserId)) {
        res.status(400).json({ success: false, message: "Invalid user ID" });
        return;
      }
      const data = await SetupTrackingService.setTenantSetupStatus(
        targetUserId,
        action,
        Number(userData.userId),
        userData.role as string | undefined,
        req.body?.reason
      );
      res.status(200).json({ success: true, message: `Tenant setup ${action}d`, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  };

export const getCompanySetup = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const companyId = Number(req.params.id);
    if (isNaN(companyId)) {
      res.status(400).json({ success: false, message: "Invalid company ID" });
      return;
    }
    const data = await SetupTrackingService.getCompanySetupStatus(
      companyId,
      Number(userData.userId),
      userData.role as string | undefined
    );
    res.status(200).json({ success: true, message: "Company setup status fetched", data });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const setCompanySetup = (action: "complete" | "skip" | "reopen") =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userData = req.userData as JwtPayload;
      const companyId = Number(req.params.id);
      if (isNaN(companyId)) {
        res.status(400).json({ success: false, message: "Invalid company ID" });
        return;
      }
      const data = await SetupTrackingService.setCompanySetupStatus(
        companyId,
        action,
        Number(userData.userId),
        userData.role as string | undefined,
        req.body?.reason
      );
      res.status(200).json({ success: true, message: `Company setup ${action}d`, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  };
