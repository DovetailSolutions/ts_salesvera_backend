import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as ReportsService from "./reports.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { companyId, fromDate, toDate } = req.query;
    const result = await ReportsService.generateReport(
      Number(userData.userId),
      userData.role as string | undefined,
      Number(companyId),
      String(fromDate || ""),
      String(toDate || "")
    );
    createSuccess(res, "Report generated successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
