import * as XLSX from "xlsx";
import { Op } from "sequelize";
import { Quotations, Invoices, User } from "../../config/dbConnection";
import { userHasPermission } from "../../config/checkPermission";
import { getISTDateString } from "../shared/dateUtils";
import { ServiceError } from "../shared/serviceError";

// ============================================================
// Sales document reports — Excel (.xlsx) download of Sale Orders,
// Proforma Invoices and Invoices.
//
// One download can be:
//   • a single document   → ?ids=12
//   • selected documents  → ?ids=12,15,19
//   • a date range        → ?startDate=2026-11-01&endDate=2026-11-30
//     (both optional; dates are IST calendar days on createdAt — the same
//     date the lists show), optionally narrowed by ?status= and ?search=.
//
// Rows are scoped exactly like the on-screen lists (getQuotationPdfList2 /
// getInvoice in app/controller/admin.ts): the caller plus every user below
// them in the createdBy hierarchy, never cancelled/deleted, draft proformas
// only with proformainvoice:view, invoices company-isolated. Passing ids
// never widens that scope — an id outside it is simply not exported.
//
// The workbook has two sheets: "Summary" (one row per document) and
// "Line Items" (one row per item). Cells are plain values, never formulas.
// ============================================================

export type ReportType = "sale-orders" | "proforma-invoices" | "invoices";

export interface Actor {
  userId: number;
  role: string;
  companyId: number | null;
}

export const EXPORT_MAX_ROWS = 10000;
const MAX_IDS = 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const TITLES: Record<ReportType, string> = {
  "sale-orders": "Sale_Orders",
  "proforma-invoices": "Proforma_Invoices",
  invoices: "Invoices",
};

// ── helpers ─────────────────────────────────────────────────

const istDate = (d: Date | string | null | undefined) => (d ? getISTDateString(new Date(d)) : "");

const num = (v: any): number | "" => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
};

const text = (v: any) => (v === null || v === undefined ? "" : String(v));

const titleCase = (v: any) => {
  const s = text(v);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

const joinAddr = (...parts: any[]) => parts.map(text).map((p) => p.trim()).filter(Boolean).join(", ");

// "YYYY-MM-DD" (IST calendar day) → UTC instant at that day's IST midnight.
const istDayStart = (s: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ServiceError(`Invalid date "${s}", expected YYYY-MM-DD`);
  const d = new Date(`${s}T00:00:00.000+05:30`);
  if (Number.isNaN(d.getTime())) throw new ServiceError(`Invalid date "${s}"`);
  return d;
};

const parseList = (v: any): string[] => {
  if (v === undefined || v === null || v === "") return [];
  const raw = Array.isArray(v) ? v : String(v).split(",");
  return raw.map((s) => String(s).trim()).filter(Boolean);
};

const parseIds = (v: any): number[] => {
  const ids = parseList(v).map(Number);
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new ServiceError("ids must be a comma-separated list of numeric ids");
  if (ids.length > MAX_IDS) throw new ServiceError(`At most ${MAX_IDS} documents can be selected per download`);
  return Array.from(new Set(ids));
};

// Same walk as the list endpoints: caller + all users they (transitively) created.
const teamUserIds = async (rootId: number): Promise<number[]> => {
  const team = new Set<number>([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const parents = await User.findAll({
      where: { id: { [Op.in]: frontier } },
      attributes: ["id"],
      include: [{ model: User, as: "createdUsers", attributes: ["id"] }],
    });
    frontier = [];
    for (const p of parents as any[]) {
      for (const c of p.createdUsers || []) {
        const id = Number(c.id);
        if (!team.has(id)) {
          team.add(id);
          frontier.push(id);
        }
      }
    }
  }
  return Array.from(team);
};

const userNames = async (ids: number[]): Promise<Map<number, string>> => {
  const map = new Map<number, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return map;
  const users = await User.findAll({ where: { id: { [Op.in]: unique } }, attributes: ["id", "firstName", "lastName"] });
  for (const u of users as any[]) {
    const first = text(u.firstName).trim();
    const last = text(u.lastName).trim();
    map.set(Number(u.id), last && last !== first ? `${first} ${last}` : first);
  }
  return map;
};

// ── query building ──────────────────────────────────────────

interface Filters {
  ids: number[];
  start: Date | null;
  endExclusive: Date | null;
  statuses: string[];
  search: string;
}

const parseFilters = (query: any): Filters => {
  const ids = parseIds(query.ids);
  const startDate = text(query.startDate).trim();
  const endDate = text(query.endDate).trim();
  const start = startDate ? istDayStart(startDate) : null;
  const endExclusive = endDate ? new Date(istDayStart(endDate).getTime() + 24 * 60 * 60 * 1000) : null;
  if (start && endExclusive && start >= endExclusive) throw new ServiceError("Start date must be on or before end date");
  const statuses = parseList(query.status).map((s) => s.toLowerCase());
  return { ids, start, endExclusive, statuses, search: text(query.search).trim() };
};

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected", "imported", "pending"];

const buildWhere = async (type: ReportType, actor: Actor, f: Filters) => {
  const team = await teamUserIds(actor.userId);
  const where: any = { userId: { [Op.in]: team } };
  const and: any[] = [];

  let blocked = ["cancelled", "deleted"];
  if (type !== "sale-orders") {
    const canViewDraft = await userHasPermission(actor.userId, actor.role, "proformainvoice", "view");
    if (!canViewDraft && type === "proforma-invoices") blocked = [...blocked, "draft"];
    // Company isolation, failing open on NULL like getInvoice.
    if (actor.companyId) where.companyId = { [Op.or]: [actor.companyId, null] };
  }
  and.push({ status: { [Op.notIn]: blocked } });

  const statuses = f.statuses.filter((s) => ALLOWED_STATUSES.includes(s) && !blocked.includes(s));
  if (f.statuses.length) {
    // An explicit filter that leaves nothing allowed must match nothing, not everything.
    and.push({ status: { [Op.in]: statuses.length ? statuses : ["__none__"] } });
  } else if (type === "proforma-invoices") {
    // Proforma page default: draft + imported.
    and.push({ status: { [Op.in]: ["draft", "imported"].filter((s) => !blocked.includes(s)) } });
  }

  if (type === "invoices") where.isFinalized = true;

  if (f.ids.length) where.id = { [Op.in]: f.ids };
  if (f.start || f.endExclusive) {
    where.createdAt = {
      ...(f.start ? { [Op.gte]: f.start } : {}),
      ...(f.endExclusive ? { [Op.lt]: f.endExclusive } : {}),
    };
  }

  if (f.search) {
    const like = { [Op.iLike]: `%${f.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` };
    and.push({
      [Op.or]:
        type === "sale-orders"
          ? [{ customerName: like }, { quotationNumber: like }, { referenceNumber: like }]
          : [{ customerName: like }, { invoiceNumber: like }, { quotationNumber: like }],
    });
  }

  where[Op.and] = and;
  return where;
};

// ── row mapping ─────────────────────────────────────────────

const docOf = (type: ReportType, row: any) => {
  if (type === "sale-orders") return row.quotation?.quotation || row.quotation || {};
  return row.invoice || {};
};

const summaryRow = (type: ReportType, row: any, doc: any, createdBy: string) => {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const common = {
    "Customer Name": text(row.customerName || doc.billToName || doc.customerName),
    "Company": text(doc.companyName),
    "Branch": text(doc.branchName),
    "Bill To": text(doc.billToName),
    "Bill To Address": joinAddr(doc.billToAddress, doc.billToCity, doc.billToState, doc.billToCountry, doc.billToPincode),
    "Customer GST": text(doc.billToGstNumber || doc.billToGst),
    "Ship To": text(doc.shipToName),
    "Ship To Address": joinAddr(doc.shipToAddress, doc.shipToCity, doc.shipToState, doc.shipToCountry, doc.shipToPincode),
    "Status": titleCase(row.status),
    "Items": items.length,
    "Sub Total (INR)": num(doc.subTotal),
    "CGST (INR)": num(doc.cgst),
    "SGST (INR)": num(doc.sgst),
    "IGST (INR)": num(doc.igst),
    "Discount (INR)": num(doc.overallDiscount),
    "Grand Total (INR)": num(doc.totalValue),
    "Bank": text(doc.bankName),
    "Notes": text(doc.notes || doc.narration),
    "Created By": createdBy,
    "Created On": istDate(row.createdAt),
  };

  if (type === "sale-orders") {
    return {
      "Sale Order No.": text(row.quotationNumber || doc.quotationNumber),
      "Sale Order Date": text(doc.date) || istDate(row.createdAt),
      "Reference No.": text(row.referenceNumber || doc.referenceNumber),
      ...common,
    };
  }
  return {
    [type === "invoices" ? "Invoice No." : "Proforma No."]: text(row.invoiceNumber) || `#${row.id}`,
    "Invoice Date": istDate(row.invoiceDate) || istDate(row.createdAt),
    "Sale Order No.": text(row.quotationNumber || (doc.quotationNumber !== "Not Applicable" ? doc.quotationNumber : "")),
    "Reference No.": text(doc.referenceNumber),
    ...common,
    ...(type === "proforma-invoices" ? { "Finalized": row.isFinalized ? "Yes" : "No" } : {}),
    ...(type === "invoices" ? { "Finalized On": istDate(row.finalizedAt) } : {}),
  };
};

const itemRows = (docNo: string, row: any, doc: any) => {
  const items = Array.isArray(doc.items) ? doc.items : [];
  return items.map((it: any, i: number) => ({
    "Document No.": docNo,
    "Customer Name": text(row.customerName || doc.billToName),
    "#": num(it.index) || i + 1,
    "Item": text(it.itemName || it.name),
    "HSN": text(it.hsnCode),
    "Unit": text(it.baseUnit),
    "Quantity": num(it.quantity ?? it.qty),
    "Rate (INR)": num(it.rate),
    "GST %": num(it.gst),
    "Discount (INR)": num(it.discountAmt ?? it.discountAmount ?? it.discount),
    "Value (INR)": num(it.value ?? it.amount),
  }));
};

// ── export ──────────────────────────────────────────────────

export const exportSalesReport = async (type: ReportType, actor: Actor, query: any) => {
  if (!actor.userId) throw new ServiceError("Unauthorized request");
  const f = parseFilters(query);
  const where = await buildWhere(type, actor, f);

  const Model: any = type === "sale-orders" ? Quotations : Invoices;
  const records = await Model.findAll({
    where,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: EXPORT_MAX_ROWS + 1,
  });

  const truncated = records.length > EXPORT_MAX_ROWS;
  const rows = (truncated ? records.slice(0, EXPORT_MAX_ROWS) : records).map((r: any) => r.toJSON());
  const names = await userNames(rows.map((r: any) => Number(r.userId)));

  const summary: any[] = [];
  const lines: any[] = [];
  for (const row of rows) {
    const doc = docOf(type, row);
    const s = summaryRow(type, row, doc, names.get(Number(row.userId)) || "");
    summary.push(s);
    lines.push(...itemRows(String(Object.values(s)[0]), row, doc));
  }

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summary.length ? summary : [{ "No records match the selected filters": "" }]);
  if (summary.length) {
    summarySheet["!cols"] = Object.keys(summary[0]).map((k) => ({
      wch: /Address|Notes/.test(k) ? 40 : /Name|Company|Bill To|Ship To|Created By/.test(k) ? 24 : 16,
    }));
    summarySheet["!autofilter"] = { ref: summarySheet["!ref"] as string };
  }
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const itemSheet = XLSX.utils.json_to_sheet(lines.length ? lines : [{ "No line items": "" }]);
  if (lines.length) {
    itemSheet["!cols"] = [18, 24, 5, 30, 14, 8, 10, 12, 8, 14, 14].map((wch) => ({ wch }));
    itemSheet["!autofilter"] = { ref: itemSheet["!ref"] as string };
  }
  XLSX.utils.book_append_sheet(workbook, itemSheet, "Line Items");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  let suffix = getISTDateString();
  if (f.ids.length === 1 && rows.length === 1) {
    suffix = String(Object.values(summary[0])[0]).replace(/[^A-Za-z0-9_-]+/g, "-");
  } else if (f.ids.length) {
    suffix = `selected-${rows.length}_${suffix}`;
  } else if (query.startDate || query.endDate) {
    suffix = `${text(query.startDate) || "start"}_to_${text(query.endDate) || getISTDateString()}`;
  }

  return {
    buffer,
    filename: `${TITLES[type]}_${suffix}.xlsx`,
    count: rows.length,
    truncated,
  };
};
