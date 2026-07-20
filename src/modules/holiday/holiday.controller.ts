import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as HolidayService from "./holiday.service";

// ============================================================
// Holiday controller — thin HTTP layer. Extracted verbatim (same routes,
// same request/response shapes) from admin.ts's addHoliday/updateHoliday/
// getHoliday/getHolidayById; only the internals now live in
// holiday.service.ts / holiday.repository.ts.
// ============================================================

export const addHoliday = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const { holidays, companyId } = req.body;
    const created = await HolidayService.createHolidays(Number(userData.userId), holidays, companyId);
    return createSuccess(res, "Holidays added successfully", created);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const updateHoliday = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const { id } = req.params || {};
    if (!id || isNaN(Number(id))) {
      return badRequest(res, "Valid holiday id is required");
    }

    const updated = await HolidayService.updateHoliday(Number(id), Number(userData.userId), req.body);
    return createSuccess(res, "Holiday updated successfully", updated);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const getHoliday = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await HolidayService.listHolidays({
      userId: Number(userData.userId),
      role: userData.role as string | undefined,
      page,
      limit,
      search: (req.query.search as string) || "",
      branchId: req.query.branchId as string | undefined,
      companyId: req.query.companyId as string | undefined,
    });

    return createSuccess(res, "Holidays fetched successfully", result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};

export const getHolidayById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    if (!req.params.id) {
      return badRequest(res, "Holiday id is required");
    }
    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Holiday id must be a number");
    }

    const holiday = await HolidayService.getHolidayById(Number(req.params.id), Number(userData.userId));
    return createSuccess(res, "Holiday fetched successfully", holiday);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};
