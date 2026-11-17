import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as ReportsService from "./reports.service";
import { getCompanySubscription, resolveTenantUserId } from "../subscription/featureAccess.service";

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
    // Sections outside the tenant's plan come back empty, with the list of
    // what was left out, so a Lite tenant still gets its attendance/leave
    // report but never Pro/Advance data.
    const ent = await getCompanySubscription(
      await resolveTenantUserId(Number(userData.userId), String(userData.role))
    );
    const excluded: string[] = [];
    const r: any = result;
    if (!ent.features.client_visits) { r.meetings = []; excluded.push("meetings"); }
    if (!ent.features.expenses) { r.expenses = []; excluded.push("expenses"); }
    if (!ent.features.order_management) { r.quotations = []; r.invoices = []; excluded.push("quotations", "invoices"); }
    r.excludedByPlan = excluded;
    createSuccess(res, "Report generated successfully", r);
  } catch (error) {
    handleServiceError(res, error);
  }
};
