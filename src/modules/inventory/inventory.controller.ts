import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as InventoryBulkService from "./inventory.bulk.service";

// ============================================================
// Inventory controller — thin HTTP layer for the bulk item upload. The
// caller always comes from req.userData (resolved by tokenCheck).
// ============================================================

const actorOf = (req: Request) => {
  const userData = req.userData as JwtPayload;
  return { userId: Number(userData?.userId), role: String(userData?.role) };
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    // meta carries the row-numbered error report on a refused import.
    return badRequest(res, error.message, error.meta ?? {});
  }
  console.error("Inventory bulk upload error:", error);
  return res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
};

export const validateBulkItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await InventoryBulkService.validateBulkItems(actorOf(req), req.file as Express.Multer.File | undefined);
    createSuccess(res, "File checked", result);
  } catch (error) {
    handleError(res, error);
  }
};

export const importBulkItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await InventoryBulkService.importBulkItems(actorOf(req), req.file as Express.Multer.File | undefined);
    createSuccess(res, `${result.created} item${result.created === 1 ? "" : "s"} imported`, result);
  } catch (error) {
    handleError(res, error);
  }
};
