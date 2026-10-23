import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden, notFound, conflict } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as ClientService from "./client.service";

// ============================================================
// Client Assignment controller — thin HTTP layer, same shape as the asset
// module's. The caller (id, role, active company) always comes from
// req.userData, which tokenCheck resolves from the verified JWT.
// ============================================================

export const actorOf = (req: Request): ClientService.Actor => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String(userData?.role),
    companyId: userData?.companyId != null ? Number(userData.companyId) : null,
  };
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message, error.meta ?? {});
    if (error.status === 404) return notFound(res, error.message, error.meta ?? {});
    if (error.status === 409) return conflict(res, error.message, error.meta ?? {});
    return badRequest(res, error.message, error.meta ?? {});
  }
  console.error("Client module error:", error);
  return res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
};

const wrap =
  (message: string, handler: (req: Request) => Promise<any>) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      createSuccess(res, message, await handler(req));
    } catch (error) {
      handleError(res, error);
    }
  };

export const listClients = wrap("Clients fetched", (req) => ClientService.listClients(actorOf(req), req.query));
export const listAssignableUsers = wrap("Employees fetched", (req) => ClientService.listAssignableUsers(actorOf(req), req.query));
export const getClientHistory = wrap("Client assignment history fetched", (req) => ClientService.getClientHistory(actorOf(req), req.params.id));
export const assignClients = wrap("Clients assigned", (req) => ClientService.assignClients(actorOf(req), req.body));
export const revokeClients = wrap("Client assignment revoked", (req) => ClientService.revokeClients(actorOf(req), req.body));
export const getTransferPreview = wrap("Transfer preview fetched", (req) => ClientService.getTransferPreview(actorOf(req), req.query));
export const transferClients = wrap("Clients transferred", (req) => ClientService.transferClients(actorOf(req), req.body));
