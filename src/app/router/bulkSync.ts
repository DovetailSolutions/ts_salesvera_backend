import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_AND_MANAGER } from "../middlewear/rbac";
import { checkPermission } from "../../config/checkPermission";
import * as BulkSyncController from "../controller/bulkSync";

const router = Router();

// POST /admin/bulk/invoices      — date-scoped sales vouchers from Tally
// POST /admin/bulk/quotations    — date-scoped quotation vouchers from Tally
// POST /admin/bulk/clients       — full ledger (Sundry Debtors) master push
// POST /admin/bulk/stock-items   — full stock item master push
//
// Access: admin/manager role (as before), the tenant's Tally add-on (plan
// gate in tokenCheck) and the user's own tally:connect permission.
const tallySync = [tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), checkPermission("tally", "connect")];

router.post("/invoices",     ...tallySync, BulkSyncController.bulkInvoices);
router.post("/quotations",   ...tallySync, BulkSyncController.bulkQuotations);
router.post("/clients",      ...tallySync, BulkSyncController.bulkClients);
router.post("/stock-items",  ...tallySync, BulkSyncController.bulkStockItems);
router.post("/masters",      ...tallySync, BulkSyncController.bulkMasters);

export default router;
