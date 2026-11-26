import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as MySalesController from "./mySales.controller";

// ============================================================
// "My Sales" (employee self-service, read-only) — mounted at "/api" in
// server.ts, so these are "/api/my-sales/...".
//
// Access: logged in + quotation:view (the employee's own sale order
// permission) + the Advance plan (order_management in planFeatures.ts).
// Results are always limited to the caller's own documents — see
// mySales.service.ts. Query: page, limit, search, status.
// ============================================================
const router = Router();
const canView = [tokenCheck, checkPermission("quotation", "view")];

router.get("/my-sales/counts", ...canView, MySalesController.getCounts);
router.get("/my-sales/sale-orders", ...canView, MySalesController.listSaleOrders);
router.get("/my-sales/proforma-invoices", ...canView, MySalesController.listProformaInvoices);
router.get("/my-sales/invoices", ...canView, MySalesController.listInvoices);

export default router;
