import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import * as BulkSyncController from "../controller/bulkSync";

const router = Router();

// POST /admin/bulk/invoices      — date-scoped sales vouchers from Tally
// POST /admin/bulk/quotations    — date-scoped quotation vouchers from Tally
// POST /admin/bulk/clients       — full ledger (Sundry Debtors) master push
// POST /admin/bulk/stock-items   — full stock item master push

router.get("/invoices",     tokenCheck, BulkSyncController.bulkInvoices);
router.get("/quotations",   tokenCheck, BulkSyncController.bulkQuotations);
router.get("/clients",      tokenCheck, BulkSyncController.bulkClients);
router.get("/stock-items",  tokenCheck, BulkSyncController.bulkStockItems);

export default router;
