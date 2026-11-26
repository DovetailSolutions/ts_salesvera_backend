import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as MySalesService from "./mySales.service";

// Thin HTTP layer — the caller always comes from the verified JWT.
const userIdOf = (req: Request) => Number((req.userData as JwtPayload)?.userId);

const fail = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) return badRequest(res, error.message, error.meta ?? {});
  console.error("My Sales error:", error);
  return res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
};

const list =
  (type: MySalesService.DocType, message: string) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      createSuccess(res, message, await MySalesService.listMySales(type, userIdOf(req), req.query));
    } catch (error) {
      fail(res, error);
    }
  };

export const listSaleOrders = list("sale-orders", "Your sale orders fetched");
export const listProformaInvoices = list("proforma-invoices", "Your proforma invoices fetched");
export const listInvoices = list("invoices", "Your invoices fetched");

export const getCounts = async (req: Request, res: Response): Promise<void> => {
  try {
    createSuccess(res, "Your sales counts fetched", await MySalesService.mySalesCounts(userIdOf(req)));
  } catch (error) {
    fail(res, error);
  }
};
