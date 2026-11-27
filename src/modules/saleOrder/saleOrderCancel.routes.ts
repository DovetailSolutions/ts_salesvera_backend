import { Router, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import { cancelSaleOrder, isTallyConnected } from "./saleOrderCancel.service";

// ============================================================
// GET  /admin/sale-orders/cancel-policy      → { canCancel, tallyConnected }
// POST /admin/sale-orders/:id/cancel         { reason? }  (also under /api for mobile)
// Cancel requires the same permission as changing a sale order's status.
// ============================================================

const router = Router();

const caller = (req: Request) => {
  const u = req.userData as JwtPayload;
  return {
    actor: { userId: Number((u as any)?.userId), role: String((u as any)?.role) },
    companyId: (u as any)?.companyId ? Number((u as any).companyId) : null,
  };
};

router.get("/sale-orders/cancel-policy", tokenCheck, async (req: Request, res: Response) => {
  try {
    const { companyId } = caller(req);
    const tallyConnected = await isTallyConnected(companyId);
    createSuccess(res, "Sale order cancel policy", { canCancel: !tallyConnected, tallyConnected });
  } catch (error) {
    handleServiceError(res, error);
  }
});

router.post("/sale-orders/:id/cancel", tokenCheck, checkPermission("quotation", "update"), async (req: Request, res: Response) => {
  try {
    const { actor, companyId } = caller(req);
    const result = await cancelSaleOrder(Number(req.params.id), actor, companyId, req.body?.reason);
    createSuccess(res, "Sale order cancelled", result);
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default router;
