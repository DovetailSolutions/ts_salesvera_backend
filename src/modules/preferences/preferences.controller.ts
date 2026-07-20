import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as PreferencesService from "./preferences.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

export const getMyPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await PreferencesService.getMyPreferences(Number(userData.userId));
    createSuccess(res, "Preferences fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateMyPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await PreferencesService.updateMyPreferences(Number(userData.userId), req.body);
    createSuccess(res, "Preferences updated successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
