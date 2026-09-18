import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden, notFound, conflict } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as AssetService from "./asset.service";
import * as AssetBulkService from "./asset.bulk.service";
import * as AssetExportService from "./asset.export.service";

// ============================================================
// Asset Management controller — thin HTTP layer. The caller (id, role,
// active company) always comes from req.userData, which tokenCheck resolves
// from the verified JWT; nothing that scopes or authorizes an action is read
// from the request body or query.
// ============================================================

const actorOf = (req: Request): AssetService.Actor => {
  const userData = req.userData as JwtPayload;
  return {
    userId: Number(userData?.userId),
    role: String(userData?.role),
    companyId: userData?.companyId != null ? Number(userData.companyId) : null,
  };
};

// Same shape as the other module controllers, extended with 404/409 so
// "not found" and "conflicts with current state" are distinguishable.
const handleError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message, error.meta ?? {});
    if (error.status === 404) return notFound(res, error.message, error.meta ?? {});
    if (error.status === 409) return conflict(res, error.message, error.meta ?? {});
    return badRequest(res, error.message, error.meta ?? {});
  }
  console.error("Asset module error:", error);
  return res.status(500).json({ success: false, code: 500, message: "Something went wrong", data: {} });
};

const wrap =
  (message: string, handler: (req: Request) => Promise<any>) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      createSuccess(res, message, await handler(req));
    } catch (error) {
      handleError(res, error);
    }
  };

export const getMeta = wrap("Asset metadata fetched", async () => AssetService.getMeta());
export const getStats = wrap("Asset statistics fetched", (req) => AssetService.getStats(actorOf(req)));

export const listCategories = wrap("Asset types fetched", (req) => AssetService.listCategories(actorOf(req), req.query));
export const createCategory = wrap("Asset type created", (req) => AssetService.createCategory(actorOf(req), req.body));
export const updateCategory = wrap("Asset type updated", (req) => AssetService.updateCategory(actorOf(req), req.params.id, req.body));
export const deleteCategory = wrap("Asset type deleted", (req) => AssetService.deleteCategory(actorOf(req), req.params.id));

export const listAssets = wrap("Assets fetched", (req) => AssetService.listAssets(actorOf(req), req.query));
export const getAsset = wrap("Asset fetched", (req) => AssetService.getAsset(actorOf(req), req.params.id));
export const getAssetHistory = wrap("Asset history fetched", (req) => AssetService.getAssetHistory(actorOf(req), req.params.id));
export const createAsset = wrap("Asset created", (req) => AssetService.createAsset(actorOf(req), req.body));
export const updateAsset = wrap("Asset updated", (req) => AssetService.updateAsset(actorOf(req), req.params.id, req.body));

export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await AssetService.deleteAsset(actorOf(req), req.params.id);
    createSuccess(
      res,
      result.result === "retired"
        ? `Asset ${result.assetCode} has assignment history, so it was retired instead of deleted`
        : `Asset ${result.assetCode} deleted`,
      result
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const listAssignableUsers = wrap("Assignable people fetched", (req) => AssetService.listAssignableUsers(actorOf(req), req.query));
export const assignAsset = wrap("Asset assigned", (req) => AssetService.assignAsset(actorOf(req), req.params.id, req.body));
export const returnAsset = wrap("Asset returned", (req) => AssetService.returnAsset(actorOf(req), req.params.id, req.body));
export const listAssignments = wrap("Asset assignments fetched", (req) => AssetService.listAssignments(actorOf(req), req.query));

export const validateBulkAssets = wrap("CSV validated", (req) =>
  AssetBulkService.validateBulkAssets(actorOf(req), req.file as Express.Multer.File | undefined)
);

export const importBulkAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await AssetBulkService.importBulkAssets(actorOf(req), req.file as Express.Multer.File | undefined);
    createSuccess(res, `${result.created} asset${result.created === 1 ? "" : "s"} imported`, result);
  } catch (error) {
    handleError(res, error);
  }
};

export const exportAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { buffer, filename, count, truncated } = await AssetExportService.exportAssetsExcel(actorOf(req), req.query);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Row-Count": String(count),
      "X-Export-Truncated": String(truncated),
      "Access-Control-Expose-Headers": "Content-Disposition, X-Export-Row-Count, X-Export-Truncated",
    });
    res.send(buffer);
  } catch (error) {
    handleError(res, error);
  }
};

export const listMyAssets = wrap("Your assets fetched", (req) => AssetService.listMyAssets(actorOf(req), req.query));
