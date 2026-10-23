import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import { handleInventoryFileUpload } from "./inventory.upload";
import * as InventoryController from "./inventory.controller";

// ============================================================
// Inventory routes — mounted at "/admin" in server.ts.
// Bulk item upload: validate (dry run, saves nothing) then import
// (all-or-nothing). Admin and company owner only — the service checks again.
// ============================================================
const router = Router();
const inventoryManagers = [tokenCheck, authorizeRoles("admin", "user")];

router.post("/inventory/items/bulk/validate", ...inventoryManagers, handleInventoryFileUpload, InventoryController.validateBulkItems);
router.post("/inventory/items/bulk/import", ...inventoryManagers, handleInventoryFileUpload, InventoryController.importBulkItems);

export default router;
