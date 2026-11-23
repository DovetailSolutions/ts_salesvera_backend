import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as SalesReportService from "./salesReport.service";

// Thin HTTP layer for the sales document reports — the caller always comes
// from the verified JWT (req.userData), never from the query.

const actorOf = (req: Request): SalesReportService.Actor => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String(userData?.role),
    companyId: userData?.companyId != null ? Number(userData.companyId) : null,
  };
};

const download =
  (type: SalesReportService.ReportType) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { buffer, filename, count, truncated } = await SalesReportService.exportSalesReport(type, actorOf(req), req.query);
      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Row-Count": String(count),
        "X-Export-Truncated": String(truncated),
        "Access-Control-Expose-Headers": "Content-Disposition, X-Export-Row-Count, X-Export-Truncated",
      });
      res.send(buffer);
    } catch (error) {
      if (error instanceof ServiceError) {
        if (error.status === 403) {
          forbidden(res, error.message, error.meta ?? {});
          return;
        }
        badRequest(res, error.message, error.meta ?? {});
        return;
      }
      console.error("Sales report export error:", error);
      res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
    }
  };

export const exportSaleOrders = download("sale-orders");
export const exportProformaInvoices = download("proforma-invoices");
export const exportInvoices = download("invoices");
