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
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const meeting = await MeetingService.scheduleMeeting(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId,
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
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const meeting = await MeetingService.rescheduleMeeting(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId,
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
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const dashboard = await MeetingService.getMeetingDashboard(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId
    );
    createSuccess(res, "Meeting dashboard fetched successfully", dashboard);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getMeetingDashboardDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const type = String(req.query.type || "total");
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const result = await MeetingService.getMeetingDashboardDetails(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId,
      type,
      page,
      limit,
      userId
    );
    res.status(200).json({
      success: true,
      message: "Meeting dashboard details fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getNewClientsDashboardDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const result = await MeetingService.getNewClientsDetails(
      Number(userData.userId),
      userData.role as string | undefined,
      callerCompanyId,
      page,
      limit
    );
    res.status(200).json({
      success: true,
      message: "New clients fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};
