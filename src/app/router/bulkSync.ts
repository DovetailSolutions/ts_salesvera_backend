import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import * as BulkSyncController from "../controller/bulkSync";

const router = Router();

// POST /admin/bulk/invoices      — date-scoped sales vouchers from Tally
// POST /admin/bulk/quotations    — date-scoped quotation vouchers from Tally
// POST /admin/bulk/clients       — full ledger (Sundry Debtors) master push
// POST /admin/bulk/stock-items   — full stock item master push

router.post("/invoices",     tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), BulkSyncController.bulkInvoices);
router.post("/quotations",   tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), BulkSyncController.bulkQuotations);
router.post("/clients",      tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), BulkSyncController.bulkClients);
router.post("/stock-items",  tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), BulkSyncController.bulkStockItems);

export default router;
 