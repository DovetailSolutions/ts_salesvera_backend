import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as ShiftService from "./shift.service";

// ============================================================
// Shift controller — thin HTTP layer, extracted verbatim from admin.ts's
// addShift/updateShift/getShift/getShiftById.
// ============================================================

export const addShift = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const created = await ShiftService.addShift(Number(userData.userId), req.body);
    return createSuccess(res, "Shift(s) added successfully", created);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const updateShift = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const { id } = req.params || {};
    if (!id || isNaN(Number(id))) {
      return badRequest(res, "Valid shift id is required");
    }

    const updated = await ShiftService.updateShift(Number(id), Number(userData.userId), req.body);
    return createSuccess(res, "Shift updated successfully", updated);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const getShift = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await ShiftService.listShifts({
      userId: Number(userData.userId),
      role: userData.role as string | undefined,
      page,
      limit,
      search: (req.query.search as string) || "",
      branchId: req.query.branchId as string | undefined,
      companyId: req.query.companyId as string | undefined,
    });

    return createSuccess(res, "Shifts fetched successfully", result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};

export const getShiftById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }
    if (!req.params.id) {
      return badRequest(res, "Shift id is required");
    }
    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Shift id must be a number");
    }

    const shift = await ShiftService.getShiftById(Number(req.params.id), Number(userData.userId));
    return createSuccess(res, "Shift fetched successfully", shift);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};
