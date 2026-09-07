import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as AttendanceSecurityService from "./attendanceSecurity.service";

// ============================================================
// Attendance Security controller — thin HTTP layer, mirrors
// attendance.controller.ts / geoFencing.controller.ts's shape.
// ============================================================

const callerContext = (req: Request) => {
  const userData = req.userData as JwtPayload;
  return {
    callerId: Number(userData?.userId),
    callerRole: (userData as any)?.role as string | undefined,
    callerCompanyId: (userData as any)?.companyId ? Number((userData as any).companyId) : null,
  };
};

export const getMy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId } = callerContext(req);
    const result = await AttendanceSecurityService.getMySettings(callerId);
    createSuccess(res, "Attendance security settings fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getForUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await AttendanceSecurityService.getSettingsForUser(
      callerId,
      callerRole,
      callerCompanyId,
      Number(req.params.userId)
    );
    createSuccess(res, "Attendance security settings fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateForUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await AttendanceSecurityService.updateSettingsForUser(
      callerId,
      callerRole,
      callerCompanyId,
      Number(req.params.userId),
      req.body || {}
    );
    createSuccess(res, "Attendance security settings updated", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const bulkUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const { userIds, settings } = req.body || {};
    const result = await AttendanceSecurityService.bulkUpdateSettings(
      callerId,
      callerRole,
      callerCompanyId,
      Array.isArray(userIds) ? userIds.map(Number) : [],
      settings || {}
    );
    createSuccess(res, "Bulk attendance security settings applied", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const listDeviceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const { status, page, limit } = req.query as any;
    const result = await AttendanceSecurityService.getDeviceRequests(callerId, callerRole, callerCompanyId, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    createSuccess(res, "Device change requests fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getDeviceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await AttendanceSecurityService.getDeviceRequestDetail(
      callerId,
      callerRole,
      callerCompanyId,
      Number(req.params.id)
    );
    createSuccess(res, "Device change request fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const approveDeviceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await AttendanceSecurityService.approveDeviceRequest(
      callerId,
      callerRole,
      callerCompanyId,
      Number(req.params.id),
      req.body?.note
    );
    createSuccess(res, "Device approved", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const rejectDeviceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await AttendanceSecurityService.rejectDeviceRequest(
      callerId,
      callerRole,
      callerCompanyId,
      Number(req.params.id),
      req.body?.reason
    );
    createSuccess(res, "Device rejected", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const revokeDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await AttendanceSecurityService.revokeTrustedDevice(
      callerId,
      callerRole,
      callerCompanyId,
      Number(req.params.userId)
    );
    createSuccess(res, "Trusted device revoked", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getAuditLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const { userId, eventType, page, limit } = req.query as any;
    const result = await AttendanceSecurityService.getAuditLog(callerId, callerRole, callerCompanyId, {
      userId: userId ? Number(userId) : undefined,
      eventType,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    createSuccess(res, "Audit log fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
