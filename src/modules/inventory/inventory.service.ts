import { Op, Transaction } from "sequelize";
import { User, Category, SubCategory } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getAllChildUserIds } from "../shared/userHierarchy";
import { StockMovement } from "./inventory.models";

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
    const line = lines.get(Number(sub.id))!;
    const name = sub.sub_category_name || line.name;
    if (Number(sub.adminId) !== inventoryOwnerId && categoryOwner.get(Number(sub.CategoryId)) !== inventoryOwnerId) {
      throw new ServiceError(`${name} is not part of this company's inventory`);
    }
    if (line.invalid || line.quantity <= 0) {
      throw new ServiceError(`Enter a valid quantity (greater than 0) for ${name}`);
    }
    const available = Number(sub.stockQuantity ?? 0);
    // "Allow orders when out of stock": the balance may go below zero (a
    // backorder) instead of the order being refused.
    if (line.quantity > available && !sub.allowOutOfStock) {
      throw new ServiceError(
        `Insufficient stock for ${name}. Available quantity: ${available}. Requested quantity: ${line.quantity}.`,
        400,
        { code: "INSUFFICIENT_STOCK", subCategoryId: Number(sub.id), available, requested: line.quantity }
      );
    }
    const balance = round3(available - line.quantity);
    await sub.update({ stockQuantity: balance }, { transaction });
    await StockMovement.create(
      {
        subCategoryId: Number(sub.id),
        quotationId: Number(quotation.id),
        type: "sale",
        quantity: -line.quantity,
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

type StockInput = { trackStock?: boolean; stockQuantity?: number | null; allowOutOfStock?: boolean };

// True when the request carries any stock field at all.
export const hasStockInput = (input: StockInput) =>
  input.trackStock !== undefined || input.stockQuantity !== undefined || input.allowOutOfStock !== undefined;

// Stock fields from the Inventory form. trackStock switches tracking on/off;
// stockQuantity sets the on-hand amount (recorded as an adjustment);
// allowOutOfStock lets sale orders take the item below zero.
export const parseStockInput = (body: any): StockInput => {
  const out: StockInput = {};
  if (body?.trackStock !== undefined) out.trackStock = body.trackStock === true || body.trackStock === "true";
  if (body?.allowOutOfStock !== undefined) out.allowOutOfStock = body.allowOutOfStock === true || body.allowOutOfStock === "true";
  if (body?.stockQuantity !== undefined && body.stockQuantity !== "" && body.stockQuantity !== null) {
    const n = Number(body.stockQuantity);
    if (!Number.isFinite(n) || n < 0) throw new ServiceError("Stock quantity must be 0 or more");
    if (n >= 1e11) throw new ServiceError("Stock quantity is too large");
    out.stockQuantity = round3(n);
  }
  return out;
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

  const changes: any = {};
  if (input.trackStock !== undefined) changes.trackStock = input.trackStock;
  if (input.allowOutOfStock !== undefined) changes.allowOutOfStock = input.allowOutOfStock;
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
