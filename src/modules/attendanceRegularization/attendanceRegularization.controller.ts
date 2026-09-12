import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import { checkPermission } from "../../config/checkPermission";
import * as Service from "./attendanceRegularization.service";

// ============================================================
// Thin HTTP layer — mirrors attendanceSecurity.controller.ts's shape.
// ============================================================

// ============================================================
// authorizeCreateRegularization — dedicated role gate for POST create.
//
// ROOT CAUSE this replaces: the create route used to be gated purely by
// checkPermission("attendance", "create") — the SAME permission flag used
// for "Mark Team Attendance" (admin/manager marking someone present).
// Because those are two conceptually different actions sharing one
// permission, whichever users happened to hold attendance:create governed
// who could create a regularization — backwards from the fixed business
// rule (sale_person/manager: always allowed, admin: never allowed): an
// admin commonly holds attendance:create (for marking team attendance) and
// could therefore create regularizations, while a manager commonly does
// NOT hold it and was wrongly blocked.
//
// This is a hard, non-configurable role rule (not something a company
// should be able to grant/revoke via the permissions table), so it is
// enforced by role here rather than via checkPermission. Any role this
// gate doesn't have an opinion on (e.g. "user") falls back to the exact
// previous checkPermission("attendance","create") behavior, unchanged.
// ============================================================
export const authorizeCreateRegularization = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const userData = req.userData as JwtPayload;
  const role = (userData as any)?.role as string | undefined;

  if (role === "admin") {
    return res.status(403).json({
      success: false,
      message:
        "Admins cannot create attendance regularization requests. Admins review and manage existing requests instead.",
    });
  }

  if (role === "super_admin" || role === "manager" || role === "sale_person") {
    return next();
  }

  return checkPermission("attendance", "create")(req, res, next);
};

const callerContext = (req: Request) => {
  const userData = req.userData as JwtPayload;
  return {
    callerId: Number(userData?.userId),
    callerRole: (userData as any)?.role as string | undefined,
    callerCompanyId: (userData as any)?.companyId ? Number((userData as any).companyId) : null,
  };
};

export const getRequestTypes = async (_req: Request, res: Response): Promise<void> => {
  const types = Object.entries(Service.REQUEST_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  createSuccess(res, "Request types fetched", types);
};

export const createRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const attachmentUrl = (req.file as any)?.location ?? null;
    const result = await Service.createRequest(callerId, callerRole, callerCompanyId, req.body || {}, attachmentUrl);
    createSuccess(res, "Regularization request submitted", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const cancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId } = callerContext(req);
    const result = await Service.cancelRequest(callerId, Number(req.params.id));
    createSuccess(res, "Regularization request cancelled", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getMyRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId } = callerContext(req);
    const { status, page, limit } = req.query as any;
    const result = await Service.getMyRequests(callerId, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    createSuccess(res, "My regularization requests fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const listRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const { status, requestType, userId, dateFrom, dateTo, page, limit } = req.query as any;
    const result = await Service.getRequests(callerId, callerRole, callerCompanyId, {
      status,
      requestType,
      userId: userId ? Number(userId) : undefined,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    createSuccess(res, "Regularization requests fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getRequestDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await Service.getRequestDetail(callerId, callerRole, callerCompanyId, Number(req.params.id));
    createSuccess(res, "Regularization request fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const approveRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await Service.approveRequest(callerId, callerRole, callerCompanyId, Number(req.params.id), req.body?.comment);
    createSuccess(res, "Regularization request approved", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const rejectRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerId, callerRole, callerCompanyId } = callerContext(req);
    const result = await Service.rejectRequest(callerId, callerRole, callerCompanyId, Number(req.params.id), req.body?.comment);
    createSuccess(res, "Regularization request rejected", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
