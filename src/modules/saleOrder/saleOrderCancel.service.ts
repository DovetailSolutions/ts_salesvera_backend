import { Op } from "sequelize";
import { sequelize, Quotations, Invoices } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getTallyBranchLock } from "../shared/tallyBranchLock";
import * as InventoryService from "../inventory/inventory.service";
import { StockMovement } from "../inventory/inventory.models";

// ============================================================
// Cancel a sale order — only when the company is NOT connected to Tally
// (with Tally, Tally is the book of record: cancel it there).
//
// Cancelling undoes what the order did, in ONE transaction:
//   • the order → status "cancelled" (record kept, not deleted);
//   • stock the order took is put back (inventory ledger "sale_reversal" —
//     exactly what was taken, read from the ledger, not the editable items);
//   • proforma invoices made from it (not yet finalized) → "cancelled", and
//     the stock THEY took (items set to deduct on proforma) is put back too.
// Refused when: already cancelled/rejected/deleted, or a FINAL tax invoice
// exists for the order (an issued invoice is a legal document).
// ============================================================

export interface Actor {
  userId: number;
  role: string;
}

const CLOSED = ["cancelled", "rejected", "deleted"];

/** Is this company connected to Tally? (any of its owner/admins has a Tally GUID) */
export const isTallyConnected = async (companyId: number | null | undefined): Promise<boolean> => {
  if (!companyId) return false;
  const lock = await getTallyBranchLock(Number(companyId));
  return !!lock?.tallyConnected;
};

export const TALLY_CANCEL_BLOCKED =
  "This company is connected to Tally, so sale orders can't be cancelled here. Cancel it in Tally — the change will sync.";

export const assertCancelAllowedForCompany = async (companyId: number | null | undefined) => {
  if (await isTallyConnected(companyId)) {
    throw new ServiceError(TALLY_CANCEL_BLOCKED, 403, { code: "TALLY_CONNECTED" });
  }
};

/** The order's company id, or null when not recorded (web orders store 0). */
export const orderCompanyOf = (order: any): number | null => {
  const n = Number(order?.companyId);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const cancelSaleOrder = async (id: number, actor: Actor, callerCompanyId: number | null, reason?: string) => {
  if (!Number.isInteger(id) || id <= 0) throw new ServiceError("Sale order id is required");

  return sequelize.transaction(async (transaction) => {
    const order: any = await (Quotations as any).findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw new ServiceError("Sale order not found", 404);

    await InventoryService.assertCanChangeSaleOrder(actor, Number(order.userId));
    // Orders created from the web are stored with companyId 0 (the form sends
    // none) — treat 0/empty as unknown and use the caller's company.
    const orderCompanyId = orderCompanyOf(order);
    if (
      actor.role !== "super_admin" &&
      callerCompanyId &&
      orderCompanyId != null &&
      orderCompanyId !== Number(callerCompanyId)
    ) {
      throw new ServiceError("You do not have access to this sale order", 403);
    }

    await assertCancelAllowedForCompany(orderCompanyId ?? callerCompanyId);

    const status = String(order.status || "draft");
    if (CLOSED.includes(status)) {
      throw new ServiceError(`This sale order is already ${status}`, 400, { code: "ALREADY_CLOSED", status });
    }

    // Documents made from this order.
    const linked: any[] = await (Invoices as any).findAll({
      where: { quotationId: id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const finalInvoices = linked.filter((inv) => inv.isFinalized && !CLOSED.includes(String(inv.status)));
    if (finalInvoices.length) {
      const nums = finalInvoices.map((i) => i.invoiceNumber || `#${i.id}`).join(", ");
      throw new ServiceError(
        `A tax invoice (${nums}) has already been issued for this sale order, so it can't be cancelled.`,
        400,
        { code: "INVOICE_ISSUED", invoices: finalInvoices.map((i) => i.id) }
      );
    }

    // Ledger position before this cancel — rows after it are what we put back.
    const ledgerBefore = Number((await (StockMovement as any).max("id", { transaction })) || 0);

    // 1) Proforma invoices from this order → cancelled, their stock back.
    const proformas = linked.filter((inv) => !inv.isFinalized && !CLOSED.includes(String(inv.status)));
    for (const inv of proformas) {
      const prev = inv.status;
      inv.status = "cancelled";
      await InventoryService.applyProformaStock(inv, prev, "cancelled", actor, transaction);
      await inv.save({ transaction });
    }

    // 2) The order → cancelled, its stock back.
    order.status = "cancelled";
    await InventoryService.applySaleOrderStock(order, status, "cancelled", actor, transaction);
    if (reason && order.quotation && typeof order.quotation === "object") {
      order.quotation = { ...order.quotation, cancelReason: String(reason).slice(0, 500), cancelledAt: new Date().toISOString() };
    }
    await order.save({ transaction });

    // What was put back — the ledger rows this cancel just wrote.
    const restored: any[] = await (StockMovement as any).findAll({
      where: {
        [Op.or]: [
          { quotationId: id, type: "sale_reversal" },
          ...(proformas.length ? [{ invoiceId: { [Op.in]: proformas.map((p) => p.id) }, type: "proforma_reversal" }] : []),
        ],
        id: { [Op.gt]: ledgerBefore },
      },
      attributes: ["subCategoryId", "quantity", "balanceAfter", "type"],
      transaction,
    });

    return {
      id,
      quotationNumber: order.quotationNumber ?? null,
      previousStatus: status,
      status: "cancelled",
      proformasCancelled: proformas.map((p) => ({ id: p.id, invoiceNumber: p.invoiceNumber ?? null })),
      stockRestored: restored.map((r) => ({
        subCategoryId: Number(r.subCategoryId),
        quantity: Number(r.quantity),
        balanceAfter: Number(r.balanceAfter),
        from: r.type === "sale_reversal" ? "sale_order" : "proforma_invoice",
      })),
    };
  });
};
