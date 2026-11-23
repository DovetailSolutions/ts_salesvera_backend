import { Op, Transaction } from "sequelize";
import { User, Category, SubCategory } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getAllChildUserIds } from "../shared/userHierarchy";
import { StockMovement } from "./inventory.models";
import { getTallyBranchLock } from "../shared/tallyBranchLock";

// ============================================================
// Inventory stock for sale orders.
//
// Rule: a sale order takes its stock the moment it is created (draft,
// sent, accepted, imported all hold it) and gives exactly that stock back
// when it is rejected, cancelled or deleted. Accepting a draft doesn't take
// it a second time. An order created before this rule (never deducted) takes
// its stock on its next status change to a holding status.
//
// Only sub-items with trackStock = true have stock. Everything else
// (services, and every sub-item that existed before tracking was added) is
// left alone, as is any order line without a subCategoryId (free-text or
// Tally-imported lines).
//
// Every change runs inside the caller's transaction with the sale order row
// and the affected sub-items locked, and is written to
// inventory_stock_movements. The ledger's latest row for an order says
// whether its stock is currently out, which is what makes a repeated accept
// (double click, retry, two requests at once) deduct only once.
// ============================================================

export interface Actor {
  userId: number;
  role: string;
}

// Statuses in which a sale order no longer needs its stock.
const RELEASED_STATUSES = ["rejected", "cancelled", "deleted"];
const holdsStock = (status: string | null | undefined) => !!status && !RELEASED_STATUSES.includes(String(status));

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Whose inventory a user works with — the same creator-chain walk
// GET /admin/getcategory uses to decide which categories a user sees:
// managers/employees use their nearest admin's, everyone else their own.
export const resolveInventoryOwnerId = async (userId: number, role: string): Promise<number> => {
  if (role !== "manager" && role !== "employee") return Number(userId);
  let currentId = Number(userId);
  let ownerId = Number(userId);
  for (let depth = 0; depth < 20; depth++) {
    const current: any = await User.findByPk(currentId, {
      attributes: ["id", "role"],
      include: [{ model: User, as: "creators", attributes: ["id", "role"], through: { attributes: [] } }],
    });
    const plain = current?.get({ plain: true });
    const creator = plain?.creators?.[0];
    if (!creator) {
      if (plain?.role === "admin" || plain?.role === "super_admin") ownerId = currentId;
      break;
    }
    if (creator.role === "admin" || creator.role === "super_admin") {
      ownerId = Number(creator.id);
      break;
    }
    currentId = Number(creator.id);
  }
  return ownerId;
};

// Same visibility as the sale order list (getQuotationPdfList2): the
// caller's own orders and those of everyone they created, at any depth.
export const assertCanChangeSaleOrder = async (caller: Actor, orderUserId: number) => {
  if (caller.role === "super_admin") return;
  if (Number(orderUserId) === Number(caller.userId)) return;
  const team = await getAllChildUserIds(Number(caller.userId));
  if (!team.includes(Number(orderUserId))) {
    throw new ServiceError("You do not have access to this sale order", 403);
  }
};

// Order lines that point at a sub-item, merged per sub-item (two lines of
// the same item deduct their combined quantity).
const linesBySubItem = (quotation: any) => {
  const items: any[] = Array.isArray(quotation?.quotation?.items) ? quotation.quotation.items : [];
  const map = new Map<number, { quantity: number; name: string; invalid: boolean }>();
  for (const item of items) {
    const subId = Number(item?.subCategoryId);
    if (!Number.isInteger(subId) || subId <= 0) continue;
    const qty = Number(item?.quantity);
    const entry = map.get(subId) ?? { quantity: 0, name: item?.itemName || `Item #${subId}`, invalid: false };
    if (!Number.isFinite(qty) || qty <= 0) entry.invalid = true;
    else entry.quantity = round3(entry.quantity + qty);
    map.set(subId, entry);
  }
  return map;
};

const lockSubItems = (ids: number[], transaction: Transaction) =>
  SubCategory.findAll({
    where: { id: { [Op.in]: ids } },
    order: [["id", "ASC"]],
    lock: transaction.LOCK.UPDATE,
    transaction,
  }) as Promise<any[]>;

// The last ledger row for this order tells whether its stock is out now:
// "sale" → deducted; "sale_reversal" or nothing → not deducted.
const lastOrderMovement = (quotationId: number, transaction: Transaction) =>
  StockMovement.findOne({
    where: { quotationId, type: { [Op.in]: ["sale", "sale_reversal"] } },
    order: [["id", "DESC"]],
    transaction,
  });

const deductForOrder = async (quotation: any, actor: Actor, transaction: Transaction) => {
  const lines = linesBySubItem(quotation);
  if (lines.size === 0) return;

  const owner: any = await User.findByPk(quotation.userId, { attributes: ["id", "role"], transaction });
  const inventoryOwnerId = await resolveInventoryOwnerId(Number(quotation.userId), owner?.role ?? "");
  const subItems = await lockSubItems(Array.from(lines.keys()), transaction);

  // Users see sub-items through their category (GET /getcategory filters
  // categories by adminId), so an item belongs to the inventory when either
  // it or its category is owned by the inventory's admin.
  const categoryIds = Array.from(new Set(subItems.filter((s) => s.trackStock).map((s) => Number(s.CategoryId))));
  const categories: any[] = categoryIds.length
    ? await Category.findAll({ where: { id: { [Op.in]: categoryIds } }, attributes: ["id", "adminId"], transaction })
    : [];
  const categoryOwner = new Map(categories.map((c) => [Number(c.id), Number(c.adminId)]));

  for (const sub of subItems) {
    if (!sub.trackStock) continue; // service / untracked: no stock to move
    // Item set to take its stock on proforma invoices instead (migration 0048).
    if (sub.stockDeductOn === "proforma_invoice") continue;
    const line = lines.get(Number(sub.id))!;
    const name = sub.sub_category_name || line.name;
    if (Number(sub.adminId) !== inventoryOwnerId && categoryOwner.get(Number(sub.CategoryId)) !== inventoryOwnerId) {
      throw new ServiceError(`${name} is not part of this company's inventory`);
    }
    if (line.invalid || line.quantity <= 0) {
      throw new ServiceError(`Enter a valid quantity (greater than 0) for ${name}`);
    }
    const available = Number(sub.stockQuantity ?? 0);
    // "Allow orders when out of stock": the order goes through instead of
    // being refused, but the balance stops at zero (never negative).
    if (line.quantity > available && !sub.allowOutOfStock) {
      throw new ServiceError(
        `Insufficient stock for ${name}. Available quantity: ${available}. Requested quantity: ${line.quantity}.`,
        400,
        { code: "INSUFFICIENT_STOCK", subCategoryId: Number(sub.id), available, requested: line.quantity }
      );
    }
    // Stock owned by Tally: the order is still checked against Tally's count
    // above, but never deducts it — the next Tally sync is the only thing
    // that changes this number.
    if (sub.stockFromTally) continue;
    // Only what is actually on hand is taken; the ledger row records that
    // real amount, so a later reversal puts back exactly it.
    const taken = round3(Math.min(line.quantity, Math.max(available, 0)));
    const balance = round3(available - taken);
    await sub.update({ stockQuantity: balance }, { transaction });
    await StockMovement.create(
      {
        subCategoryId: Number(sub.id),
        quotationId: Number(quotation.id),
        type: "sale",
        quantity: -taken,
        balanceAfter: balance,
        actorId: Number(actor.userId),
        actorRole: actor.role,
        note: `Sale order ${quotation.quotationNumber ?? quotation.id} (${quotation.status})`,
      },
      { transaction }
    );
  }
};

// Puts back exactly what the order's latest acceptance took out — read from
// the ledger, not from the order's (editable) item list.
const restoreForOrder = async (quotation: any, actor: Actor, newStatus: string, transaction: Transaction) => {
  const lastReversal = await StockMovement.findOne({
    where: { quotationId: Number(quotation.id), type: "sale_reversal" },
    order: [["id", "DESC"]],
    transaction,
  });
  const sales: any[] = await StockMovement.findAll({
    where: {
      quotationId: Number(quotation.id),
      type: "sale",
      ...(lastReversal ? { id: { [Op.gt]: lastReversal.id } } : {}),
    },
    transaction,
  });
  if (sales.length === 0) return;

  const back = new Map<number, number>();
  for (const s of sales) back.set(Number(s.subCategoryId), round3((back.get(Number(s.subCategoryId)) ?? 0) - Number(s.quantity)));

  const subItems = await lockSubItems(Array.from(back.keys()), transaction);
  for (const sub of subItems) {
    if (sub.stockFromTally) continue; // Tally owns this count now — don't add old deductions back
    const qty = back.get(Number(sub.id))!;
    const balance = round3(Number(sub.stockQuantity ?? 0) + qty);
    await sub.update({ stockQuantity: balance }, { transaction });
    await StockMovement.create(
      {
        subCategoryId: Number(sub.id),
        quotationId: Number(quotation.id),
        type: "sale_reversal",
        quantity: qty,
        balanceAfter: balance,
        actorId: Number(actor.userId),
        actorRole: actor.role,
        note: `Sale order ${quotation.quotationNumber ?? quotation.id} marked ${newStatus}`,
      },
      { transaction }
    );
  }
};

// Call on every sale order status change, inside the transaction that saves
// it, with the order row already locked FOR UPDATE.
export const applySaleOrderStock = async (
  quotation: any,
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
  actor: Actor,
  transaction: Transaction
) => {
  // Only a real change (or creating the order) can move stock — re-saving an
  // order with the same status (e.g. a Tally re-sync) never does.
  if (previousStatus && previousStatus === nextStatus) return;

  const holds = holdsStock(nextStatus);
  const last = await lastOrderMovement(Number(quotation.id), transaction);
  const deducted = last?.type === "sale";

  if (holds && !deducted) await deductForOrder(quotation, actor, transaction);
  else if (!holds && deducted) await restoreForOrder(quotation, actor, String(nextStatus), transaction);
};

export type StockDeductOn = "sale_order" | "proforma_invoice";
const STOCK_DEDUCT_ON: StockDeductOn[] = ["sale_order", "proforma_invoice"];

type StockInput = { trackStock?: boolean; stockQuantity?: number | null; allowOutOfStock?: boolean; stockDeductOn?: StockDeductOn };

// True when the request carries any stock field at all.
export const hasStockInput = (input: StockInput) =>
  input.trackStock !== undefined || input.stockQuantity !== undefined || input.allowOutOfStock !== undefined || input.stockDeductOn !== undefined;

// Stock fields from the Inventory form. trackStock switches tracking on/off;
// stockQuantity sets the on-hand amount (recorded as an adjustment);
// allowOutOfStock lets sale orders take the item when out of stock (stock stays at 0).
export const parseStockInput = (body: any): StockInput => {
  const out: StockInput = {};
  if (body?.trackStock !== undefined) out.trackStock = body.trackStock === true || body.trackStock === "true";
  if (body?.allowOutOfStock !== undefined) out.allowOutOfStock = body.allowOutOfStock === true || body.allowOutOfStock === "true";
  if (body?.stockDeductOn !== undefined && body.stockDeductOn !== null && body.stockDeductOn !== "") {
    if (!STOCK_DEDUCT_ON.includes(body.stockDeductOn)) {
      throw new ServiceError("stockDeductOn must be 'sale_order' or 'proforma_invoice'");
    }
    out.stockDeductOn = body.stockDeductOn;
  }
  if (body?.stockQuantity !== undefined && body.stockQuantity !== "" && body.stockQuantity !== null) {
    const n = Number(body.stockQuantity);
    if (!Number.isFinite(n) || n < 0) throw new ServiceError("Stock quantity must be 0 or more");
    if (n >= 1e11) throw new ServiceError("Stock quantity is too large");
    out.stockQuantity = round3(n);
  }
  return out;
};

// Company connected to Tally → the Track stock settings (trackStock,
// stockQuantity, allowOutOfStock, stockDeductOn) can't be changed from the
// Inventory page; every other item field stays editable. Only a real change
// is refused — re-sending the current values (the edit form does) passes.
// `current` is the item being edited, or null when creating one.
export const assertStockSettingsEditable = async (
  companyId: number | null | undefined,
  current: any | null,
  input: StockInput
) => {
  if (!hasStockInput(input)) return;
  // Creating an item with tracking off is still fine.
  if (!current && !input.trackStock) return;
  const lock = await getTallyBranchLock(companyId);
  if (!lock?.tallyConnected) return;

  const changed =
    !current ||
    (input.trackStock !== undefined && input.trackStock !== !!current.trackStock) ||
    (input.allowOutOfStock !== undefined && input.allowOutOfStock !== !!current.allowOutOfStock) ||
    (input.stockDeductOn !== undefined && input.stockDeductOn !== (current.stockDeductOn || "sale_order")) ||
    (input.stockQuantity !== undefined && round3(Number(input.stockQuantity ?? 0)) !== round3(Number(current.stockQuantity ?? 0)));

  if (changed) {
    throw new ServiceError("Track stock is managed by Tally while Tally is connected and can't be changed here");
  }
};

export const applyStockInput = async (
  subCategoryId: number,
  input: StockInput,
  actor: Actor,
  transaction: Transaction
) => {
  if (!hasStockInput(input)) return;
  const [sub] = await lockSubItems([Number(subCategoryId)], transaction);
  if (!sub) return;

  if (
    sub.stockFromTally &&
    input.stockQuantity !== undefined &&
    round3(Number(input.stockQuantity ?? 0)) !==round3(Number(sub.stockQuantity ?? 0))
  ) {
    throw new ServiceError("Stock for this item is managed from Tally and can't be changed here");
  }

  const changes: any = {};
  if (input.trackStock !== undefined) changes.trackStock = input.trackStock;
  if (input.allowOutOfStock !== undefined) changes.allowOutOfStock = input.allowOutOfStock;
  if (input.stockDeductOn !== undefined) changes.stockDeductOn = input.stockDeductOn;
  const tracking = input.trackStock ?? !!sub.trackStock;
  if (tracking && input.stockQuantity !== undefined) changes.stockQuantity = input.stockQuantity;
  if (tracking && sub.stockQuantity === null && changes.stockQuantity === undefined) changes.stockQuantity = 0;
  const before = Number(sub.stockQuantity ?? 0);
  await sub.update(changes, { transaction });

  if (changes.stockQuantity !== undefined) {
    const delta = round3(Number(changes.stockQuantity) - before);
    if (delta !== 0) {
      await StockMovement.create(
        {
          subCategoryId: Number(sub.id),
          quotationId: null,
          type: "adjustment",
          quantity: delta,
          balanceAfter: Number(changes.stockQuantity),
          actorId: Number(actor.userId),
          actorRole: actor.role,
          note: "Stock set from Inventory",
        },
        { transaction }
      );
    }
  }
};

// ============================================================
// Proforma invoices (migration 0048).
//
// An item whose stockDeductOn is 'proforma_invoice' takes its stock when a
// proforma invoice is created and gets it back when the invoice is
// rejected, cancelled or deleted — the same rules as sale orders above,
// with the ledger rows keyed by invoiceId ("proforma"/"proforma_reversal").
// Items left on 'sale_order' (the default) are never touched here, so no
// item's stock is ever taken by both documents.
// ============================================================

const linesFromItems = (rawItems: any) => {
  const items: any[] = Array.isArray(rawItems) ? rawItems : [];
  const map = new Map<number, { quantity: number; name: string; invalid: boolean }>();
  for (const item of items) {
    const subId = Number(item?.subCategoryId);
    if (!Number.isInteger(subId) || subId <= 0) continue;
    const qty = Number(item?.quantity);
    const entry = map.get(subId) ?? { quantity: 0, name: item?.itemName || `Item #${subId}`, invalid: false };
    if (!Number.isFinite(qty) || qty <= 0) entry.invalid = true;
    else entry.quantity = round3(entry.quantity + qty);
    map.set(subId, entry);
  }
  return map;
};

const lastInvoiceMovement = (invoiceId: number, transaction: Transaction) =>
  StockMovement.findOne({
    where: { invoiceId, type: { [Op.in]: ["proforma", "proforma_reversal"] } },
    order: [["id", "DESC"]],
    transaction,
  });

const deductForProforma = async (invoice: any, actor: Actor, transaction: Transaction) => {
  const lines = linesFromItems(invoice?.invoice?.items);
  if (lines.size === 0) return;

  const subItems = (await lockSubItems(Array.from(lines.keys()), transaction)).filter(
    (s) => s.trackStock && s.stockDeductOn === "proforma_invoice"
  );
  if (subItems.length === 0) return;

  const owner: any = await User.findByPk(invoice.userId, { attributes: ["id", "role"], transaction });
  const inventoryOwnerId = await resolveInventoryOwnerId(Number(invoice.userId), owner?.role ?? "");
  const categoryIds = Array.from(new Set(subItems.map((s) => Number(s.CategoryId))));
  const categories: any[] = await Category.findAll({
    where: { id: { [Op.in]: categoryIds } },
    attributes: ["id", "adminId"],
    transaction,
  });
  const categoryOwner = new Map(categories.map((c) => [Number(c.id), Number(c.adminId)]));

  for (const sub of subItems) {
    const line = lines.get(Number(sub.id))!;
    const name = sub.sub_category_name || line.name;
    if (Number(sub.adminId) !== inventoryOwnerId && categoryOwner.get(Number(sub.CategoryId)) !== inventoryOwnerId) {
      throw new ServiceError(`${name} is not part of this company's inventory`);
    }
    if (line.invalid || line.quantity <= 0) {
      throw new ServiceError(`Enter a valid quantity (greater than 0) for ${name}`);
    }
    const available = Number(sub.stockQuantity ?? 0);
    if (line.quantity > available && !sub.allowOutOfStock) {
      throw new ServiceError(
        `Insufficient stock for ${name}. Available quantity: ${available}. Requested quantity: ${line.quantity}.`,
        400,
        { code: "INSUFFICIENT_STOCK", subCategoryId: Number(sub.id), available, requested: line.quantity }
      );
    }
    // Same rule as sale orders (deductForOrder): stock owned by Tally is
    // checked above but never deducted — only the next Tally sync changes it.
    if (sub.stockFromTally) continue;
    const taken = round3(Math.min(line.quantity, Math.max(available, 0)));
    const balance = round3(available - taken);
    await sub.update({ stockQuantity: balance }, { transaction });
    await StockMovement.create(
      {
        subCategoryId: Number(sub.id),
        quotationId: null,
        invoiceId: Number(invoice.id),
        type: "proforma",
        quantity: -taken,
        balanceAfter: balance,
        actorId: Number(actor.userId),
        actorRole: actor.role,
        note: `Proforma invoice ${invoice.invoiceNumber ?? invoice.id} (${invoice.status})`,
      },
      { transaction }
    );
  }
};

// Puts back exactly what the invoice's latest deduction took — from the ledger.
const restoreForProforma = async (invoice: any, actor: Actor, newStatus: string, transaction: Transaction) => {
  const lastReversal = await StockMovement.findOne({
    where: { invoiceId: Number(invoice.id), type: "proforma_reversal" },
    order: [["id", "DESC"]],
    transaction,
  });
  const taken: any[] = await StockMovement.findAll({
    where: {
      invoiceId: Number(invoice.id),
      type: "proforma",
      ...(lastReversal ? { id: { [Op.gt]: lastReversal.id } } : {}),
    },
    transaction,
  });
  if (taken.length === 0) return;

  const back = new Map<number, number>();
  for (const s of taken) back.set(Number(s.subCategoryId), round3((back.get(Number(s.subCategoryId)) ?? 0) - Number(s.quantity)));

  const subItems = await lockSubItems(Array.from(back.keys()), transaction);
  for (const sub of subItems) {
    if (sub.stockFromTally) continue; // Tally owns this count now — don't add old deductions back
    const qty = back.get(Number(sub.id))!;
    const balance = round3(Number(sub.stockQuantity ?? 0) + qty);
    await sub.update({ stockQuantity: balance }, { transaction });
    await StockMovement.create(
      {
        subCategoryId: Number(sub.id),
        quotationId: null,
        invoiceId: Number(invoice.id),
        type: "proforma_reversal",
        quantity: qty,
        balanceAfter: balance,
        actorId: Number(actor.userId),
        actorRole: actor.role,
        note: `Proforma invoice ${invoice.invoiceNumber ?? invoice.id} marked ${newStatus}`,
      },
      { transaction }
    );
  }
};

// Call when a proforma invoice is created (previousStatus null) and on every
// status change, inside the transaction that saves it.
export const applyProformaStock = async (
  invoice: any,
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
  actor: Actor,
  transaction: Transaction
) => {
  if (previousStatus && previousStatus === nextStatus) return;
  const holds = holdsStock(nextStatus);
  const last = await lastInvoiceMovement(Number(invoice.id), transaction);
  const deducted = last?.type === "proforma";
  if (holds && !deducted) await deductForProforma(invoice, actor, transaction);
  else if (!holds && deducted) await restoreForProforma(invoice, actor, String(nextStatus), transaction);
};

// "Allow changes when billing" on proforma invoices: a catalogue item whose
// GST rate / price / discount is locked must be billed with the item's own
// GST rate and amount and no discount. Lines without a subCategoryId
// (free-text) are not checked.
export const assertProformaItemLocks = async (rawItems: any, transaction?: Transaction) => {
  const items: any[] = Array.isArray(rawItems) ? rawItems : [];
  const ids = Array.from(
    new Set(items.map((i) => Number(i?.subCategoryId)).filter((n) => Number.isInteger(n) && n > 0))
  );
  if (ids.length === 0) return;
  const subs: any[] = await SubCategory.findAll({ where: { id: { [Op.in]: ids } }, transaction });
  const byId = new Map(subs.map((s) => [Number(s.id), s]));
  const differs = (a: number, b: number) => Math.abs(a - b) > 0.01;
  const isSet = (v: any) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

  for (const item of items) {
    const sub = byId.get(Number(item?.subCategoryId));
    if (!sub) continue;
    const name = sub.sub_category_name || item?.itemName || "this item";

    if (!sub.totaledit && isSet(sub.amount) && differs(Number(item?.rate) || 0, Number(sub.amount))) {
      throw new ServiceError(`Price of ${name} is locked at Rs ${Number(sub.amount)}`, 400, { code: "ITEM_PRICE_LOCKED", subCategoryId: Number(sub.id) });
    }
    // The item's GST rate as the Inventory page shows and edits it is the
    // `text` column (sent to the UI as "tax"); `gst` is only set on create.
    const itemGst = isSet(sub.text) ? sub.text : sub.gst;
    if (!sub.gstedit && isSet(itemGst) && differs(Number(item?.gst) || 0, Number(itemGst))) {
      throw new ServiceError(`GST rate of ${name} is locked at ${Number(itemGst)}%`, 400, { code: "ITEM_GST_LOCKED", subCategoryId: Number(sub.id) });
    }
    if (!sub.discountedit && (Number(item?.discount) || 0) > 0) {
      throw new ServiceError(`No discount can be given on ${name}`, 400, { code: "ITEM_DISCOUNT_LOCKED", subCategoryId: Number(sub.id) });
    }
  }
};

// ============================================================
// Tally-managed stock. When a Tally stock-item record carries a quantity,
// that item's stock is owned by Tally (sub_categories.stockFromTally): each
// sync sets stockQuantity to Tally's closing balance, and sale orders no
// longer deduct from it.
// ============================================================

// Tally's closing balance from a stock-item record, or null when the record
// doesn't carry one (then the item's stock is left exactly as it is).
// Accepts a number or Tally's text form, e.g. "1,250.500 NOS".
export const parseTallyStock = (record: any): number | null => {
  const raw = record?.stockQuantity ?? record?.closingBalance ?? record?.closingQty ?? record?.closingStock;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(n) && Math.abs(n) < 1e11 ? round3(n) : null;
};

// Row fields to save on a sub-item for a Tally quantity.
export const tallyStockFields = (qty: number) => ({ trackStock: true, stockFromTally: true, stockQuantity: qty });

// Ledger row for a sync that changed the count (null when nothing changed).
export const tallySyncMovement = (subCategoryId: number, before: number, after: number, actor: Actor) => {
  const delta = round3(after - before);
  if (delta === 0) return null;
  return {
    subCategoryId,
    quotationId: null,
    type: "tally_sync" as const,
    quantity: delta,
    balanceAfter: after,
    actorId: Number(actor.userId),
    actorRole: actor.role,
    note: "Stock synced from Tally",
  };
};
