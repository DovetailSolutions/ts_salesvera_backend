import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as AssetController from "./asset.controller";
import { handleAssetCsvUpload } from "./asset.upload";

// ============================================================
// Asset Management routes — mounted at "/admin" in server.ts like every
// other module router, so "/assets" here is "/admin/assets".
//
// Management is admin-only (authorizeRoles("admin")); the service layer then
// re-verifies the admin's company on every call. "/my-assets" is the
// self-service view for whoever holds assets (employee/manager) and only
// ever returns the caller's own assignments.
//
// Static paths (/assets/meta, /assets/stats, /assets/assignees) are declared
// before "/assets/:id" so they're never captured as an id.
// ============================================================
const router = Router();
const adminOnly = [tokenCheck, authorizeRoles("admin")];

router.get("/assets/meta", ...adminOnly, AssetController.getMeta);
router.get("/assets/stats", ...adminOnly, AssetController.getStats);
router.get("/assets/assignees", ...adminOnly, AssetController.listAssignableUsers);
// Excel export of the asset list — accepts the same filter/sort query as GET /assets.
router.get("/assets/export", ...adminOnly, AssetController.exportAssets);

// Bulk CSV import: validate (dry run, saves nothing) then import (all-or-nothing).
// Role check runs before the upload middleware, so a non-admin's file is never read.
router.post("/assets/bulk/validate", ...adminOnly, handleAssetCsvUpload, AssetController.validateBulkAssets);
router.post("/assets/bulk/import", ...adminOnly, handleAssetCsvUpload, AssetController.importBulkAssets);

router.get("/asset-categories", ...adminOnly, AssetController.listCategories);
router.post("/asset-categories", ...adminOnly, AssetController.createCategory);
router.put("/asset-categories/:id", ...adminOnly, AssetController.updateCategory);
router.delete("/asset-categories/:id", ...adminOnly, AssetController.deleteCategory);

router.get("/asset-assignments", ...adminOnly, AssetController.listAssignments);

router.get("/assets", ...adminOnly, AssetController.listAssets);
router.post("/assets", ...adminOnly, AssetController.createAsset);
router.get("/assets/:id", ...adminOnly, AssetController.getAsset);
router.put("/assets/:id", ...adminOnly, AssetController.updateAsset);
router.delete("/assets/:id", ...adminOnly, AssetController.deleteAsset);
router.post("/assets/:id/assign", ...adminOnly, AssetController.assignAsset);
router.post("/assets/:id/return", ...adminOnly, AssetController.returnAsset);
router.get("/assets/:id/history", ...adminOnly, AssetController.getAssetHistory);

router.get("/my-assets", tokenCheck, authorizeRoles("employee", "manager", "admin", "user"), AssetController.listMyAssets);

export default router;
