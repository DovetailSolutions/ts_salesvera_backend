import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as BranchService from "./branch.service";

// ============================================================
// Branch controller — thin HTTP layer, extracted verbatim from admin.ts's
// addBranch/updateBranch/getBranch/getBranchById.
// ============================================================

export const addBranch = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const branch = await BranchService.addBranch(Number(userData.userId), req.body);
    return createSuccess(res, "Branch added successfully", branch);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const { id } = req.params || {};
    if (!id || isNaN(Number(id))) {
      return badRequest(res, "Valid branch id is required");
    }

    const branch = await BranchService.updateBranch(Number(id), Number(userData.userId), req.body);
    return createSuccess(res, "Branch updated successfully", branch);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const getBranch = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await BranchService.listBranches({
      userId: Number(userData.userId),
      role: userData.role as string | undefined,
      companyId: req.query.companyId as string | undefined,
      page,
      limit,
      search: (req.query.search as string) || "",
    });

    return createSuccess(res, "Branch fetched successfully", result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};

export const getBranchById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!req.params.id) {
      return badRequest(res, "Branch id is required");
    }
    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Branch id must be a number");
    }
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const branch = await BranchService.getBranchById(Number(req.params.id), Number(userData.userId));
    return createSuccess(res, "Branch fetched successfully", branch);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};
