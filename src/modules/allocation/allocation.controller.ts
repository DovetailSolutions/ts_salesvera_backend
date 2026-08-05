import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as AllocationService from "./allocation.service";

// ============================================================
// Allocation controller — thin HTTP layer over allocation.service.
// Mounted on /admin in server.ts.
// ============================================================

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

export const bulkAssignBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await AllocationService.bulkAssignBranches(
      Number(userData?.userId),
      userData?.role,
      callerCompanyId,
      req.body
    );
    createSuccess(res, "Branches allocated successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const bulkAssignShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await AllocationService.bulkAssignShift(
      Number(userData?.userId),
      userData?.role,
      callerCompanyId,
      req.body
    );
    createSuccess(res, "Shift allocated successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/allocations?userIds=1,2,3 — current branch(es)/shift for one or
// more users in a single round trip. Accepts either a comma-separated
// string (the common query-param shape) or repeated userIds[] params.
export const getAllocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const raw = req.query.userIds;
    const userIds = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : raw;
    const result = await AllocationService.getAllocations(
      Number(userData?.userId),
      userData?.role,
      callerCompanyId,
      userIds
    );
    createSuccess(res, "Allocations fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
