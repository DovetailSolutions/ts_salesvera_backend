import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import * as BulkSyncController from "../controller/bulkSync";

const router = Router();

// POST /admin/bulk/invoices      — date-scoped sales vouchers from Tally
// POST /admin/bulk/quotations    — date-scoped quotation vouchers from Tally
// POST /admin/bulk/clients       — full ledger (Sundry Debtors) master push
// POST /admin/bulk/stock-items   — full stock item master push

router.post("/invoices",     tokenCheck, BulkSyncController.bulkInvoices);
router.post("/quotations",   tokenCheck, BulkSyncController.bulkQuotations);
router.post("/clients",      tokenCheck, BulkSyncController.bulkClients);
router.post("/stock-items",  tokenCheck, BulkSyncController.bulkStockItems);

export default router;
