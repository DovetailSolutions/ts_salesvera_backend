import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as BirthdayService from "./birthday.service";

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await BirthdayService.getSettings(req.userData as JwtPayload, req.query.companyId);
    createSuccess(res, "Birthday settings fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await BirthdayService.updateSettings(req.userData as JwtPayload, req.body);
    createSuccess(res, "Birthday settings updated successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const previewTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await BirthdayService.previewTemplate(req.userData as JwtPayload, req.body);
    createSuccess(res, "Template preview generated", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getBirthdays = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await BirthdayService.getBirthdays(req.userData as JwtPayload, req.query);
    createSuccess(res, "Birthdays fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getRecentRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await BirthdayService.getRecentRuns(req.userData as JwtPayload, req.query);
    createSuccess(res, "Birthday announcement history fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
