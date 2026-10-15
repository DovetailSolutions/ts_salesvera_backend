import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as PolicyService from "./attendancePolicy.service";

// ============================================================
// Attendance policy controller — thin HTTP layer. The caller (id, role,
// active company) always comes from req.userData resolved by tokenCheck;
// nothing that scopes or authorizes an action is read from the request.
// ============================================================

const actorOf = (req: Request): PolicyService.PolicyActor => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String(userData?.role),
    companyId: userData?.companyId != null ? Number(userData.companyId) : null,
  };
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message, error.meta ?? {});
    return badRequest(res, error.message, error.meta ?? {});
  }
  console.error("Attendance policy module error:", error);
  return res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
};

const wrap =
  (message: string, handler: (req: Request) => Promise<any>) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      createSuccess(res, message, await handler(req));
    } catch (error) {
      handleError(res, error);
    }
  };

export const getPolicies = wrap("Attendance policies loaded", (req) => PolicyService.getPolicies(actorOf(req)));
export const savePolicy = wrap("Attendance policy saved", (req) => PolicyService.savePolicy(actorOf(req), req.body));
export const previewPolicy = wrap("Attendance policy preview", (req) => PolicyService.previewPolicy(actorOf(req), req.body));
