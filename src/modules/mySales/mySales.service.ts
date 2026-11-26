import { Op } from "sequelize";
import { Quotations, Invoices } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";

// ============================================================
// "My Sales" — an employee's own sale orders, proforma invoices and
// invoices, read-only. Backs the employee "My Sales" page.
//
// Scope is always the caller (never read from the request):
//   sale orders        → quotations created by the caller
//   proforma invoices  → invoices created by the caller, or made from one of
//                        the caller's sale orders (quotationId)
//   invoices           → those proformas once finalized (isFinalized)
// Cancelled / deleted documents are never shown, same as the admin lists.
// ============================================================

export type DocType = "sale-orders" | "proforma-invoices" | "invoices";

const HIDDEN = ["cancelled", "deleted"];
const MAX_LIMIT = 50;

const parsePaging = (query: any) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || 10));
  return { page, limit, offset: (page - 1) * limit };
};

const likeOf = (s: string) => ({ [Op.iLike]: `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%` });

const statusFilter = (raw: any) => {
  const list = String(raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && !HIDDEN.includes(s));
  return list.length ? { [Op.in]: list } : { [Op.notIn]: HIDDEN };
};

// The caller's own sale order ids — used to find proformas made from them.
const ownQuotationIds = async (userId: number): Promise<number[]> =>
  (await Quotations.findAll({ where: { userId }, attributes: ["id"] })).map((q: any) => Number(q.id));

export const listMySales = async (type: DocType, userId: number, query: any) => {
  if (!userId) throw new ServiceError("Unauthorized request");
  const { page, limit, offset } = parsePaging(query);
  const search = String(query.search || "").trim();

  if (type === "sale-orders") {
    const where: any = { userId, status: statusFilter(query.status) };
    if (search) {
      where[Op.or] = [{ customerName: likeOf(search) }, { quotationNumber: likeOf(search) }, { referenceNumber: likeOf(search) }];
    }
    const { rows, count } = await Quotations.findAndCountAll({
      where,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit,
      offset,
    });
    const data = rows.map((r: any) => {
      const plain = r.toJSON();
      // Some rows store the document one level deeper (quotation.quotation).
      return { ...plain, quotation: plain.quotation?.quotation || plain.quotation || {} };
    });
    return { data, totalItems: count, page, totalPages: Math.ceil(count / limit) };
  }

  const quotationIds = await ownQuotationIds(userId);
  const mine: any[] = [{ userId }];
  if (quotationIds.length) mine.push({ quotationId: { [Op.in]: quotationIds } });

  const and: any[] = [{ [Op.or]: mine }];
  if (search) {
    and.push({ [Op.or]: [{ customerName: likeOf(search) }, { invoiceNumber: likeOf(search) }, { quotationNumber: likeOf(search) }] });
  }
  const where: any = { status: statusFilter(query.status), [Op.and]: and };
  if (type === "invoices") where.isFinalized = true;

  const { rows, count } = await Invoices.findAndCountAll({
    where,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit,
    offset,
  });
  return { data: rows, totalItems: count, page, totalPages: Math.ceil(count / limit) };
};

// Tab badges: how many documents the caller has of each kind.
export const mySalesCounts = async (userId: number) => {
  if (!userId) throw new ServiceError("Unauthorized request");
  const quotationIds = await ownQuotationIds(userId);
  const mine: any[] = [{ userId }];
  if (quotationIds.length) mine.push({ quotationId: { [Op.in]: quotationIds } });
  const base = { status: { [Op.notIn]: HIDDEN }, [Op.or]: mine };

  const [saleOrders, proformaInvoices, invoices] = await Promise.all([
    Quotations.count({ where: { userId, status: { [Op.notIn]: HIDDEN } } }),
    Invoices.count({ where: base }),
    Invoices.count({ where: { ...base, isFinalized: true } }),
  ]);
  return { saleOrders, proformaInvoices, invoices };
};
