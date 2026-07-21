import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as MeetingService from "./meeting.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

export const scheduleMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { targetUserId, meetingUserId, meetingPurpose, categoryId, subCategoryId, scheduledTime } = req.body || {};
    const meeting = await MeetingService.scheduleMeeting(
      Number(userData.userId),
      userData.role as string | undefined,
      {
        targetUserId: Number(targetUserId),
        meetingUserId: Number(meetingUserId),
        meetingPurpose,
        categoryId: categoryId ? Number(categoryId) : null,
        subCategoryId: subCategoryId ? Number(subCategoryId) : null,
        scheduledTime,
      }
    );
    createSuccess(res, "Meeting scheduled successfully", meeting);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const rescheduleMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { scheduledTime } = req.body || {};
    const meeting = await MeetingService.rescheduleMeeting(
      Number(userData.userId),
      userData.role as string | undefined,
      Number(req.params.id),
      scheduledTime
    );
    createSuccess(res, "Meeting rescheduled successfully", meeting);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getMeetingDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const dashboard = await MeetingService.getMeetingDashboard(
      Number(userData.userId),
      userData.role as string | undefined
    );
    createSuccess(res, "Meeting dashboard fetched successfully", dashboard);
  } catch (error) {
    handleServiceError(res, error);
  }
};
