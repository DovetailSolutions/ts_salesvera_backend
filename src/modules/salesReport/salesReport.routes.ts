import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission, checkInvoiceViewPermission } from "../../config/checkPermission";
import * as SalesReportController from "./salesReport.controller";

// ============================================================
// Sales document report downloads (.xlsx) — mounted at "/admin" in
// server.ts, so these are "/admin/sales-reports/...".
//
// Permissions mirror the list each report comes from:
//   sale orders        → quotation:view           (= /admin/getquotationlist)
//   proforma / invoice → invoice OR proforma view (= /admin/getinvoice)
//
// Query (all optional):
//   ids=1,2,3            single or selected documents
//   startDate=YYYY-MM-DD endDate=YYYY-MM-DD   created-date range (IST)
//   status=draft,accepted                      status filter
//   search=text                                customer / document no.
// ============================================================
const router = Router();

router.get("/sales-reports/sale-orders/export", tokenCheck, checkPermission("quotation", "view"), SalesReportController.exportSaleOrders);
router.get("/sales-reports/proforma-invoices/export", tokenCheck, checkInvoiceViewPermission(), SalesReportController.exportProformaInvoices);
router.get("/sales-reports/invoices/export", tokenCheck, checkInvoiceViewPermission(), SalesReportController.exportInvoices);

export default router;
