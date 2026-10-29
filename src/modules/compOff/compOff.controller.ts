import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as CompOffService from "./compOff.service";

const actorOf = (req: Request): CompOffService.CompOffActor => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String(userData?.role || ""),
    companyId: (userData as any)?.companyId ? Number((userData as any).companyId) : null,
  };
};

export const listCompOff = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await CompOffService.listCompOff(actorOf(req), req.query);
    createSuccess(res, "Comp-off requests fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const reviewCompOff = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await CompOffService.reviewCompOff(actorOf(req), req.params.id, req.body);
    createSuccess(res, `Comp-off ${result.status}`, result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
