import * as XLSX from "xlsx";
import { Op } from "sequelize";
import { sequelize, Category, SubCategory } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { StockMovement } from "./inventory.models";
import { Actor, resolveInventoryOwnerId } from "./inventory.service";

// ============================================================
// Bulk upload of inventory items (sub-categories) from CSV or Excel.
//
// Two calls, same file (same flow as the asset bulk import):
//   validate — parses and checks every row, saves nothing, returns a
//              row-numbered error report + preview.
//   import   — re-runs the exact same checks and, only if EVERY row is
//              valid, creates all items in ONE transaction (all-or-nothing).
//
// Every row names its category, which must already exist in the uploader's
// inventory (a typo never silently creates a new category). An item name
// already in that category — or repeated in the file — is an error, so an
// upload never changes existing items. Items are saved exactly like the
// Inventory page's "Add item" (same fields and defaults); a stock quantity
// is recorded in the stock ledger like any other stock set from Inventory.
// ============================================================

export const BULK_MAX_ROWS = 1000;

// Canonical fields, in template order. Header matching ignores case,
// spaces, punctuation and "*", so "Item Name*", "item_name" and "ItemName"
// all map to the same field.
const COLUMN_ALIASES: Record<string, string[]> = {
  category: ["category", "categoryname", "itemcategory"],
  name: ["itemname", "item", "name", "subcategory", "subcategoryname", "product", "productname", "service", "servicename"],
  amount: ["amount", "price", "rate", "sellingprice", "mrp"],
  gst: ["gst", "gstpercent", "gstrate", "tax", "taxpercent", "taxrate"],
  unit: ["unit", "uom"],
  hsnCode: ["hsn", "hsncode", "sac", "saccode", "hsnsac", "hsnsaccode"],
  baseUnit: ["baseunit"],
  secondaryUnit: ["secondaryunit"],
  trackStock: ["trackstock", "stocktracked", "trackinventory"],
  stockQuantity: ["stock", "stockquantity", "quantity", "openingstock", "qty"],
  gstEditable: ["gsteditable", "gstedit", "allowgstchange"],
  priceEditable: ["priceeditable", "totaledit", "amounteditable", "allowpricechange"],
  discountEditable: ["discounteditable", "discountedit", "allowdiscount"],
};
const REQUIRED_COLUMNS: Record<string, string> = { category: "Category", name: "Item Name", amount: "Amount", gst: "GST %" };

// Same units the Inventory form offers, with the spellings people type.
const UNIT_ALIASES: Record<string, string[]> = {
  pcs: ["pcs", "pc", "piece", "pieces"],
  nos: ["nos", "no", "number", "numbers"],
  kg: ["kg", "kgs", "kilogram", "kilograms"],
  g: ["g", "gm", "gms", "gram", "grams"],
  l: ["l", "ltr", "litre", "litres", "liter", "liters"],
  ml: ["ml", "millilitre", "milliliter", "millilitres", "milliliters"],
  m: ["m", "mtr", "meter", "meters", "metre", "metres"],
  sqm: ["sqm", "sqmeter", "squaremeter", "squaremeters"],
  cbm: ["cbm", "cubicmeter", "cubicmeters"],
  box: ["box", "boxes"],
  hr: ["hr", "hrs", "hour", "hours"],
  day: ["day", "days"],
  month: ["month", "months"],
};

const normalizeHeader = (h: unknown) => String(h ?? "").toLowerCase().replace(/[^a-z]/g, "");
// Same rule as the single "Add item" duplicate check: case and spaces ignored.
const normalizeName = (s: string) => s.replace(/\s+/g, "").toLowerCase();

const parseUnit = (value: string, label: string): string | null => {
  if (!value) return null;
  const key = value.toLowerCase().replace(/[^a-z]/g, "");
  const unit = Object.keys(UNIT_ALIASES).find((u) => UNIT_ALIASES[u].includes(key));
  if (!unit) throw new Error(`${label} "${value}" isn't a known unit (use pcs, nos, kg, g, l, ml, m, sqm, cbm, box, hr, day or month)`);
  return unit;
};

const parseYesNo = (value: string, label: string): boolean => {
  if (!value) return false;
  const v = value.toLowerCase();
  if (["yes", "y", "true", "1", "on"].includes(v)) return true;
  if (["no", "n", "false", "0", "off"].includes(v)) return false;
  throw new Error(`${label} must be Yes or No`);
};

const parseNumber = (value: string, label: string, min: number, max: number): number => {
  const n = Number(value.replace(/,/g, "").replace(/^₹\s*/, ""));
  if (value === "" || !Number.isFinite(n)) throw new Error(`${label} must be a number`);
  if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return Math.round(n * 1000) / 1000;
};

interface RowError {
  row: number; // spreadsheet line number (header is line 1)
  messages: string[];
}

interface ValidRow {
  row: number;
  categoryId: number;
  categoryName: string;
  name: string;
  amount: number;
  gst: number;
  unit: string | null;
  hsnCode: string | null;
  baseUnit: string | null;
  secondaryUnit: string | null;
  trackStock: boolean;
  stockQuantity: number | null;
  gstEditable: boolean;
  priceEditable: boolean;
  discountEditable: boolean;
}

const readRows = (file: Express.Multer.File | undefined): string[][] => {
  if (!file || !file.buffer || file.size === 0) throw new ServiceError("Please upload a CSV or Excel file");
  const isExcel = (file.originalname || "").toLowerCase().endsWith(".xlsx");
  let workbook: XLSX.WorkBook;
  try {
    if (isExcel) {
      workbook = XLSX.read(file.buffer, { type: "buffer" });
    } else {
      const BOM = String.fromCharCode(0xfeff);
      const text = file.buffer.toString("utf8").replace(new RegExp(`^${BOM}`), "");
      // raw: keep every cell as the literal text (no guessing, no lost leading zeros in HSN codes).
      workbook = XLSX.read(text, { type: "string", raw: true });
    }
  } catch {
    throw new ServiceError("The file couldn't be read. Save it as .csv or .xlsx and try again.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ServiceError("The file is empty");
  // raw: false gives Excel cells as their displayed text.
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: true }) as string[][];
};

const parseFile = (file: Express.Multer.File | undefined) => {
  const lines = readRows(file);
  const headerIndex = lines.findIndex((l) => l.some((c) => String(c).trim() !== ""));
  if (headerIndex === -1) throw new ServiceError("The file is empty");

  const header = lines[headerIndex].map(normalizeHeader);
  const columnIndex: Record<string, number> = {};
  const unknownColumns: string[] = [];
  header.forEach((h, i) => {
    if (!h) return;
    const field = Object.keys(COLUMN_ALIASES).find((k) => COLUMN_ALIASES[k].includes(h));
    if (field && columnIndex[field] === undefined) columnIndex[field] = i;
    else if (!field) unknownColumns.push(String(lines[headerIndex][i]));
  });

  const missing = Object.keys(REQUIRED_COLUMNS).filter((c) => columnIndex[c] === undefined);
  if (missing.length) {
    throw new ServiceError(
      `Missing required column(s): ${missing.map((m) => REQUIRED_COLUMNS[m]).join(", ")}. Download the template for the expected format.`
    );
  }

  const dataRows = lines
    .map((cells, i) => ({ line: i + 1, cells }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some((c) => String(c).trim() !== ""));
  if (dataRows.length === 0) throw new ServiceError("The file has no item rows");
  if (dataRows.length > BULK_MAX_ROWS) {
    throw new ServiceError(`A single upload can contain at most ${BULK_MAX_ROWS} items (this file has ${dataRows.length})`);
  }

  const get = (cells: string[], field: string) =>
    columnIndex[field] === undefined ? "" : String(cells[columnIndex[field]] ?? "").trim();
  return { dataRows, get, unknownColumns };
};

// Only an admin or the company owner manages inventory — the same people
// who can add items on the Inventory page.
const requireInventoryManager = async (actor: Actor) => {
  if (!["admin", "user"].includes(actor.role)) {
    throw new ServiceError("Only an admin or the company owner can upload inventory items", 403);
  }
  return resolveInventoryOwnerId(Number(actor.userId), actor.role);
};

const validateFile = async (ownerId: number, file: Express.Multer.File | undefined) => {
  const { dataRows, get, unknownColumns } = parseFile(file);

  // This user's categories (what their Inventory page lists), by name.
  const categories: any[] = await Category.findAll({ where: { adminId: ownerId }, attributes: ["id", "category_name"] });
  const categoryByName = new Map<string, any>();
  for (const c of categories) {
    const key = String(c.category_name || "").trim().toLowerCase();
    if (key && !categoryByName.has(key)) categoryByName.set(key, c);
  }

  // Item names already in those categories.
  const existing: any[] = categories.length
    ? await SubCategory.findAll({
        where: { CategoryId: { [Op.in]: categories.map((c) => c.id) } },
        attributes: ["CategoryId", "sub_category_name"],
      })
    : [];
  const existingKeys = new Set(existing.map((s) => `${s.CategoryId}:${normalizeName(String(s.sub_category_name || ""))}`));

  const errors: RowError[] = [];
  const valid: ValidRow[] = [];
  const seenInFile = new Map<string, number>(); // key → first row number

  for (const { line, cells } of dataRows) {
    const messages: string[] = [];
    const attempt = <T>(fn: () => T): T | null => {
      try { return fn(); } catch (e: any) { messages.push(e.message); return null; }
    };

    const categoryText = get(cells, "category");
    const name = get(cells, "name");
    const category = categoryText ? categoryByName.get(categoryText.toLowerCase()) : null;
    if (!categoryText) messages.push("Category is required");
    else if (!category) messages.push(`Category "${categoryText}" doesn't exist in your inventory — add it first or fix the spelling`);
    if (!name) messages.push("Item name is required");
    else if (name.length > 255) messages.push("Item name must be 255 characters or fewer");

    const amount = attempt(() => parseNumber(get(cells, "amount"), "Amount", 0, 1e10));
    const gst = attempt(() => parseNumber(get(cells, "gst"), "GST %", 0, 100));
    const unit = attempt(() => parseUnit(get(cells, "unit"), "Unit"));
    const baseUnit = attempt(() => parseUnit(get(cells, "baseUnit"), "Base unit"));
    const secondaryUnit = attempt(() => parseUnit(get(cells, "secondaryUnit"), "Secondary unit"));
    const hsnCode = get(cells, "hsnCode") || null;
    if (hsnCode && hsnCode.length > 20) messages.push("HSN / SAC code must be 20 characters or fewer");
    const trackStock = attempt(() => parseYesNo(get(cells, "trackStock"), "Track stock")) ?? false;
    const stockText = get(cells, "stockQuantity");
    let stockQuantity: number | null = null;
    if (stockText) {
      if (!trackStock) messages.push("Stock is only for items with Track stock = Yes (services have no stock)");
      else stockQuantity = attempt(() => parseNumber(stockText, "Stock", 0, 1e11 - 1));
    }
    const gstEditable = attempt(() => parseYesNo(get(cells, "gstEditable"), "GST editable")) ?? false;
    const priceEditable = attempt(() => parseYesNo(get(cells, "priceEditable"), "Price editable")) ?? false;
    const discountEditable = attempt(() => parseYesNo(get(cells, "discountEditable"), "Discount editable")) ?? false;

    if (category && name) {
      const key = `${category.id}:${normalizeName(name)}`;
      if (existingKeys.has(key)) messages.push(`"${name}" already exists in ${category.category_name}`);
      else if (seenInFile.has(key)) messages.push(`"${name}" is repeated in this file (also on row ${seenInFile.get(key)})`);
      else seenInFile.set(key, line);
    }

    if (messages.length) {
      errors.push({ row: line, messages });
      continue;
    }
    valid.push({
      row: line,
      categoryId: Number(category.id),
      categoryName: String(category.category_name),
      name,
      amount: amount as number,
      gst: gst as number,
      unit,
      hsnCode,
      baseUnit,
      secondaryUnit,
      trackStock,
      // Tracking with no quantity starts at 0, as on the Inventory form.
      stockQuantity: trackStock ? stockQuantity ?? 0 : null,
      gstEditable,
      priceEditable,
      discountEditable,
    });
  }

  return {
    totalRows: dataRows.length,
    validRows: valid.length,
    invalidRows: errors.length,
    errors,
    unknownColumns,
    valid,
  };
};

const previewOf = (v: ValidRow) => ({
  row: v.row,
  category: v.categoryName,
  name: v.name,
  amount: v.amount,
  gst: v.gst,
  unit: v.unit,
  hsnCode: v.hsnCode,
  trackStock: v.trackStock,
  stockQuantity: v.stockQuantity,
});

export const validateBulkItems = async (actor: Actor, file: Express.Multer.File | undefined) => {
  const ownerId = await requireInventoryManager(actor);
  const { valid, ...report } = await validateFile(ownerId, file);
  return { ...report, preview: valid.slice(0, 20).map(previewOf) };
};

export const importBulkItems = async (actor: Actor, file: Express.Multer.File | undefined) => {
  const ownerId = await requireInventoryManager(actor);
  const { valid, ...report } = await validateFile(ownerId, file);
  if (report.invalidRows > 0) {
    throw new ServiceError(
      `Nothing was imported — ${report.invalidRows} row(s) have errors. Fix them and upload again.`,
      400,
      { ...report }
    );
  }

  const actorId = Number(actor.userId);
  const created = await sequelize.transaction(async (transaction) => {
    // Saved exactly like the Inventory page's "Add item" (addSubCategory).
    const rows: any[] = await SubCategory.bulkCreate(
      valid.map((v) => ({
        sub_category_name: v.name,
        CategoryId: v.categoryId,
        adminId: actorId,
        managerId: actorId,
        amount: String(v.amount),
        text: String(v.gst),
        gst: String(v.gst),
        unit: v.unit,
        hsnCode: v.hsnCode,
        baseUnit: v.baseUnit,
        secondaryUnit: v.secondaryUnit,
        gstedit: v.gstEditable,
        totaledit: v.priceEditable,
        discountedit: v.discountEditable,
        trackStock: v.trackStock,
        stockQuantity: v.stockQuantity,
        status: "draft",
      })) as any,
      { transaction, returning: true }
    );

    // Opening stock goes into the ledger, like any stock set from Inventory.
    const movements = rows
      .map((r, i) => ({ r, v: valid[i] }))
      .filter(({ v }) => v.trackStock && (v.stockQuantity ?? 0) > 0)
      .map(({ r, v }) => ({
        subCategoryId: Number(r.id),
        quotationId: null,
        type: "adjustment",
        quantity: v.stockQuantity,
        balanceAfter: v.stockQuantity,
        actorId,
        actorRole: actor.role,
        note: "Opening stock from bulk upload",
      }));
    if (movements.length) await StockMovement.bulkCreate(movements as any, { transaction });
    return rows;
  });

  return {
    created: created.length,
    withStock: valid.filter((v) => v.trackStock).length,
    categories: Array.from(new Set(valid.map((v) => v.categoryName))),
  };
};
