import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden, notFound } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as AccessExtensionService from "./accessExtension.service";

// ============================================================
// Access-extension controller — thin HTTP layer. Every value that
// authorizes or scopes a mutation (callerId, callerRole) comes from the
// verified JWT (req.userData), never the request body — see
// accessExtension.service.ts for why (a caller cannot request/approve on
// another tenant's behalf by supplying a different id).
// ============================================================

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    if (error.status === 404) return notFound(res, error.message);
    return badRequest(res, error.message, error.meta);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

const getPagination = (req: Request) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// GET /admin/access-status — the caller's own subscription/usage/expiry.
export const getMyAccessStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const status = await AccessExtensionService.getMyAccessStatus(Number(userData?.userId), (userData as any)?.role);
    createSuccess(res, "Access status fetched", status);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// POST /admin/access-extension-requests — tenant owner ("user") only.
export const submitExtensionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const request = await AccessExtensionService.submitExtensionRequest(
      Number(userData?.userId),
      (userData as any)?.role,
      req.body
    );
    createSuccess(res, "Extension request submitted", request);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/access-extension-requests — the caller's own requests.
export const listMyExtensionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { page, limit, offset } = getPagination(req);
    const result = await AccessExtensionService.listMyExtensionRequests(Number(userData?.userId), page, limit, offset);
    createSuccess(res, "Extension requests fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /super-admin/access-extension-requests — every tenant's requests.
export const listAllExtensionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status ? String(req.query.status) : undefined;
    const result = await AccessExtensionService.listAllExtensionRequests(status, page, limit, offset);
    createSuccess(res, "Extension requests fetched", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// POST /super-admin/access-extension-requests/:id/approve
export const approveExtensionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const requestId = Number(req.params.id);
    if (!requestId) { badRequest(res, "A valid request id is required"); return; }
    const request = await AccessExtensionService.approveExtensionRequest(
      Number(userData?.userId),
      requestId,
      req.body?.reviewComment
    );
    createSuccess(res, "Extension request approved", request);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// POST /super-admin/access-extension-requests/:id/reject
export const rejectExtensionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const requestId = Number(req.params.id);
    if (!requestId) { badRequest(res, "A valid request id is required"); return; }
    const request = await AccessExtensionService.rejectExtensionRequest(
      Number(userData?.userId),
      requestId,
      req.body?.reviewComment
    );
    createSuccess(res, "Extension request rejected", request);
  } catch (error) {
    handleServiceError(res, error);
  }
};
