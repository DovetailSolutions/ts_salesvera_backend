import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden, notFound } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as ManagerCapabilitiesService from "./managerCapabilities.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    if (error.status === 404) return notFound(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

// Admin-only audit endpoint — read-only, never mutates a permission/user
// record. Route-gated to admin/super_admin (see
// managerCapabilities.routes.ts's authorizeRoles).
export const getManagerCapabilities = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const managerId = Number(req.params.managerId);
    const result = await ManagerCapabilitiesService.getManagerCapabilities(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId,
      managerId
    );
    createSuccess(res, "Manager capabilities fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getManagerCapabilitiesOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const requestedManagerId = req.query.managerId ? Number(req.query.managerId) : undefined;
    const result = await ManagerCapabilitiesService.getManagerCapabilitiesOverview(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId,
      requestedManagerId
    );
    createSuccess(res, "Manager capabilities overview fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompanyManagersList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const managers = await ManagerCapabilitiesService.getCompanyManagers(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId
    );
    createSuccess(res, "Company managers fetched successfully", managers);
  } catch (error) {
    handleServiceError(res, error);
  }
};

