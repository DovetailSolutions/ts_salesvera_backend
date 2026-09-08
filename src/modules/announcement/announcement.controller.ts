import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as AnnouncementService from "./announcement.service";

// ============================================================
// Announcement controller — thin HTTP layer, same shape as leave.controller.ts.
// req.userData.companyId is always server-resolved by tokenCheck — never
// read company/role/recipient info from the request body here.
// ============================================================

const getCaller = (req: Request) => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String((userData as any)?.role),
    companyId: (userData as any)?.companyId ? Number((userData as any).companyId) : null,
  };
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getCaller(req);
    const result = await AnnouncementService.createAnnouncement(userId, role, companyId, req.body);
    createSuccess(res, "Announcement created", result, 201);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getRecipientCandidates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getCaller(req);
    const result = await AnnouncementService.getRecipientCandidates(userId, role, companyId);
    createSuccess(res, "Authorized recipients fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getSent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.getSentAnnouncements(userId, req.query as any);
    res.status(200).json({
      success: true,
      message: "Sent announcements fetched",
      data: result.data,
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      totalPages: result.totalPages,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getReceived = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.getReceivedAnnouncements(userId, req.query as any);
    res.status(200).json({
      success: true,
      message: "Received announcements fetched",
      data: result.data,
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      totalPages: result.totalPages,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const unreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.getUnreadCount(userId);
    createSuccess(res, "Unread count fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.getAnnouncementDetail(Number(req.params.id), userId);
    createSuccess(res, "Announcement fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getRecipientBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.getRecipientBreakdown(Number(req.params.id), userId, req.query as any);
    res.status(200).json({
      success: true,
      message: "Recipient breakdown fetched",
      data: result.data,
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      totalPages: result.totalPages,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.markRead(Number(req.params.id), userId);
    createSuccess(res, "Marked as read", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.markAllRead(userId);
    createSuccess(res, "All announcements marked as read", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const cancel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getCaller(req);
    const result = await AnnouncementService.cancelAnnouncement(Number(req.params.id), userId);
    createSuccess(res, "Announcement cancelled", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
