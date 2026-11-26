import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as Service from "./taskDashboard.service";

// Thin HTTP layer — the caller always comes from the verified JWT.
const actorOf = (req: Request): Service.Actor => {
  const u = req.userData as JwtPayload;
  return { userId: Number(u?.userId), role: String(u?.role), companyId: u?.companyId != null ? Number(u.companyId) : null };
};

const fail = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message, error.meta ?? {});
    return badRequest(res, error.message, error.meta ?? {});
  }
  console.error("Task dashboard error:", error);
  return res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
};

export const getMy = async (req: Request, res: Response): Promise<void> => {
  try {
    createSuccess(res, "Your task dashboard fetched", await Service.getMyDashboard(actorOf(req), req.query));
  } catch (e) {
    fail(res, e);
  }
};

export const getTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    createSuccess(res, "Team task performance fetched", await Service.getTeamDashboard(actorOf(req), req.query));
  } catch (e) {
    fail(res, e);
  }
};

export const getMember = async (req: Request, res: Response): Promise<void> => {
  try {
    createSuccess(res, "Member task dashboard fetched", await Service.getMemberDashboard(actorOf(req), Number(req.params.userId), req.query));
  } catch (e) {
    fail(res, e);
  }
};
