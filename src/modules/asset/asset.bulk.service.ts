import * as XLSX from "xlsx";
import { Op, QueryTypes, fn, col } from "sequelize";
import { sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getISTDateString } from "../shared/dateUtils";
import { Asset, AssetAuditLog, AssetCategory } from "./asset.models";
import {
  Actor,
  isUniqueViolation,
  isValidDateOnly,
  optionalText,
  parseCondition,
  parsePrice,
  requireAdminCompany,
  requiredText,
} from "./asset.service";
import { ASSET_CODE_PAD_WIDTH, ASSET_CODE_SEQUENCE, EDITABLE_STATUSES } from "./asset.constants";

// ============================================================
// Bulk asset import from CSV.
//
// Two calls, same file:
//   validate — parses and checks every row, saves nothing, returns a
//              row-numbered error report + preview.
//   import   — re-runs the exact same validation and, only if EVERY row is
//              valid, creates all assets in ONE transaction (all-or-nothing),
//              so a file can never be half-imported or partly re-imported.
//
// The upload is read from memory and never stored (asset lists carry serial
// numbers and prices; the app's default upload path is a public-read
// bucket). Row rules are the same helpers the single-asset API uses.
// ============================================================

export const BULK_MAX_ROWS = 1000;

// Canonical columns, in template order. Header matching ignores case,
// spaces, underscores and "*" so "Asset Type*", "asset_type" and
// "AssetType" all map to the same field.
const COLUMN_ALIASES: Record<string, string[]> = {
  assetType: ["assettype", "type", "category", "assetcategory"],
  name: ["assetname", "name"],
  brand: ["brand", "make"],
  model: ["model"],
  serialNumber: ["serialnumber", "serialno", "serial"],
  purchaseDate: ["purchasedate", "dateofpurchase"],
  purchasePrice: ["purchaseprice", "price", "cost"],
  condition: ["condition"],
  status: ["status"],
  description: ["description", "notes", "remarks"],
};
const REQUIRED_COLUMNS = ["assetType", "name"];
const normalizeHeader = (h: unknown) => String(h ?? "").toLowerCase().replace(/[^a-z]/g, "");

interface RowError {
  row: number; // spreadsheet line number (header is line 1)
  messages: string[];
}

interface ValidRow {
  row: number;
  categoryId: number;
  categoryName: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  condition: string;
  status: string;
  description: string | null;
}

// Accepts 2026-08-01, 01-08-2026 and 01/08/2026 (day first, as used in India).
const parseCsvDate = (value: string): string | null => {
  const s = value.trim();
  if (!s) return null;
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) iso = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (!iso || !isValidDateOnly(iso)) throw new Error("Purchase date must be YYYY-MM-DD or DD-MM-YYYY");
  if (iso > getISTDateString()) throw new Error("Purchase date cannot be in the future");
  return iso;
};

const parseFile = (file: Express.Multer.File | undefined) => {
  if (!file || !file.buffer || file.size === 0) throw new ServiceError("Please upload a CSV file");

  const BOM = String.fromCharCode(0xfeff);
  const text = file.buffer.toString("utf8").replace(new RegExp(`^${BOM}`), "");
  // raw: true keeps every cell as the literal text in the file — no guessing
  // dates/numbers, no stripping leading zeros from serial numbers.
  const workbook = XLSX.read(text, { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ServiceError("The CSV file is empty");

  const lines: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: true });
  const headerIndex = lines.findIndex((l) => l.some((c) => String(c).trim() !== ""));
  if (headerIndex === -1) throw new ServiceError("The CSV file is empty");

  const header = lines[headerIndex].map(normalizeHeader);
  const columnIndex: Record<string, number> = {};
  const unknownColumns: string[] = [];
  header.forEach((h, i) => {
    if (!h) return;
    const field = Object.keys(COLUMN_ALIASES).find((k) => COLUMN_ALIASES[k].includes(h));
    if (field && columnIndex[field] === undefined) columnIndex[field] = i;
    else if (!field) unknownColumns.push(String(lines[headerIndex][i]));
  });

  const missing = REQUIRED_COLUMNS.filter((c) => columnIndex[c] === undefined);
  if (missing.length) {
    throw new ServiceError(
      `Missing required column(s): ${missing.map((m) => (m === "assetType" ? "Asset Type" : "Asset Name")).join(", ")}. Download the template for the expected format.`
    );
  }

  const dataRows = lines
    .map((cells, i) => ({ line: i + 1, cells }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some((c) => String(c).trim() !== ""));

  if (dataRows.length === 0) throw new ServiceError("The CSV file has no asset rows");
  if (dataRows.length > BULK_MAX_ROWS) {
    throw new ServiceError(`A single upload can contain at most ${BULK_MAX_ROWS} assets (this file has ${dataRows.length})`);
  }

  const get = (cells: string[], field: string) =>
    columnIndex[field] === undefined ? "" : String(cells[columnIndex[field]] ?? "").trim();

  return { dataRows, get, unknownColumns };
};

const validateFile = async (companyId: number, file: Express.Multer.File | undefined) => {
  const { dataRows, get, unknownColumns } = parseFile(file);

  const categories = await AssetCategory.findAll({
    where: { isActive: true, [Op.or]: [{ companyId: null }, { companyId }] },
    attributes: ["id", "name", "companyId"],
  });
  // A company's own type wins over a default with the same name.
  const categoryByName = new Map<string, { id: number; name: string }>();
  categories
    .sort((a: any, b: any) => (a.companyId == null ? -1 : 1) - (b.companyId == null ? -1 : 1))
    .forEach((c: any) => categoryByName.set(c.name.toLowerCase(), { id: c.id, name: c.name }));

  const errors: RowError[] = [];
  const valid: ValidRow[] = [];
  const serialFirstRow = new Map<string, number>();

  for (const { line, cells } of dataRows) {
    const messages: string[] = [];
    const attempt = <T>(fnc: () => T): T | undefined => {
      try {
        return fnc();
      } catch (e: any) {
        messages.push(e?.message || "Invalid value");
        return undefined;
      }
    };

    const typeName = get(cells, "assetType");
    const category = typeName ? categoryByName.get(typeName.toLowerCase()) : undefined;
    if (!typeName) messages.push("Asset Type is required");
    else if (!category) messages.push(`Unknown asset type "${typeName}"`);

    const name = attempt(() => requiredText(get(cells, "name"), "Asset Name", 150));
    const brand = attempt(() => optionalText(get(cells, "brand"), "Brand", 100));
    const model = attempt(() => optionalText(get(cells, "model"), "Model", 100));
    const serialNumber = attempt(() => optionalText(get(cells, "serialNumber"), "Serial Number", 100));
    const purchaseDate = attempt(() => parseCsvDate(get(cells, "purchaseDate")));
    const purchasePrice = attempt(() => parsePrice(get(cells, "purchasePrice").replace(/[₹,\s]/g, "")));
    const condition = attempt(() => parseCondition(get(cells, "condition"), "GOOD"));

    let status = "AVAILABLE";
    const rawStatus = get(cells, "status");
    if (rawStatus) {
      status = rawStatus.toUpperCase();
      if (status === "ASSIGNED") messages.push("Status can't be ASSIGNED in a bulk upload — assign assets after importing");
      else if (!EDITABLE_STATUSES.includes(status as any)) messages.push(`Status must be one of: ${EDITABLE_STATUSES.join(", ")}`);
    }

    const description = attempt(() => optionalText(get(cells, "description"), "Description", 2000));

    if (serialNumber) {
      const key = serialNumber.toLowerCase();
      const firstRow = serialFirstRow.get(key);
      if (firstRow !== undefined) messages.push(`Serial number "${serialNumber}" is repeated (also on row ${firstRow})`);
      else serialFirstRow.set(key, line);
    }

    if (messages.length) {
      errors.push({ row: line, messages });
    } else {
      valid.push({
        row: line,
        categoryId: category!.id,
        categoryName: category!.name,
        name: name!,
        brand: brand ?? null,
        model: model ?? null,
        serialNumber: serialNumber ?? null,
        purchaseDate: purchaseDate ?? null,
        purchasePrice: purchasePrice ?? null,
        condition: condition as string,
        status,
        description: description ?? null,
      });
    }
  }

  // Serial numbers already used in this company — one query for the file.
  const serials = Array.from(serialFirstRow.keys());
  if (serials.length) {
    const existing: any[] = await Asset.findAll({
      where: { companyId, [Op.and]: [sequelize.where(fn("LOWER", col("serialNumber")), { [Op.in]: serials })] },
      attributes: ["assetCode", "serialNumber"],
    });
    const codeBySerial = new Map(existing.map((a: any) => [String(a.serialNumber).toLowerCase(), a.assetCode]));
    for (let i = valid.length - 1; i >= 0; i--) {
      const v = valid[i];
      const code = v.serialNumber ? codeBySerial.get(v.serialNumber.toLowerCase()) : undefined;
      if (code) {
        errors.push({ row: v.row, messages: [`Serial number "${v.serialNumber}" already exists (${code})`] });
        valid.splice(i, 1);
      }
    }
    errors.sort((a, b) => a.row - b.row);
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

export const validateBulkAssets = async (actor: Actor, file: Express.Multer.File | undefined) => {
  const companyId = await requireAdminCompany(actor);
  const { valid, ...report } = await validateFile(companyId, file);
  return {
    ...report,
    preview: valid.slice(0, 20).map((v) => ({
      row: v.row,
      assetType: v.categoryName,
      name: v.name,
      brand: v.brand,
      model: v.model,
      serialNumber: v.serialNumber,
      purchaseDate: v.purchaseDate,
      purchasePrice: v.purchasePrice,
      condition: v.condition,
      status: v.status,
    })),
  };
};

export const importBulkAssets = async (actor: Actor, file: Express.Multer.File | undefined) => {
  const companyId = await requireAdminCompany(actor);
  const { valid, ...report } = await validateFile(companyId, file);

  if (report.invalidRows > 0) {
    throw new ServiceError(
      `Nothing was imported — ${report.invalidRows} row(s) have errors. Fix them and upload again.`,
      400,
      { ...report }
    );
  }

  const actorId = Number(actor.userId);
  try {
    const created = await sequelize.transaction(async (transaction) => {
      // Allocate the whole block of asset codes in one atomic statement
      // (row-locked by the UPDATE) instead of one round trip per asset.
      // Inside this transaction on purpose: if the import rolls back, the
      // numbers are released too, so a failed import leaves no gap.
      const [seq] = await sequelize.query<{ prefix: string; start: number }>(
        `UPDATE "business_id_sequences"
            SET "nextNumber" = "nextNumber" + :count, "updatedAt" = NOW()
          WHERE "entityType" = :entityType
          RETURNING "prefix", "nextNumber" - :count AS "start"`,
        { replacements: { count: valid.length, entityType: ASSET_CODE_SEQUENCE }, type: QueryTypes.SELECT, transaction }
      );
      if (!seq) throw new ServiceError("Asset code sequence is not configured");

      const codeFor = (i: number) => `${seq.prefix}${String(Number(seq.start) + i).padStart(ASSET_CODE_PAD_WIDTH, "0")}`;

      const assets = await Asset.bulkCreate(
        valid.map((v, i) => ({
          assetCode: codeFor(i),
          companyId,
          categoryId: v.categoryId,
          name: v.name,
          brand: v.brand,
          model: v.model,
          serialNumber: v.serialNumber,
          purchaseDate: v.purchaseDate,
          purchasePrice: v.purchasePrice,
          status: v.status,
          condition: v.condition,
          description: v.description,
          createdBy: actorId,
          updatedBy: actorId,
        })),
        { transaction, returning: ["id", "assetCode"] }
      );

      await AssetAuditLog.bulkCreate(
        assets.map((a: any, i) => ({
          companyId,
          assetId: a.id,
          action: "ASSET_CREATED",
          actorId,
          actorRole: actor.role,
          targetUserId: null,
          detail: { assetCode: a.assetCode, name: valid[i].name, source: "bulk_csv", csvRow: valid[i].row },
        })),
        { transaction }
      );

      return assets;
    });

    return {
      created: created.length,
      firstAssetCode: (created[0] as any)?.assetCode ?? null,
      lastAssetCode: (created[created.length - 1] as any)?.assetCode ?? null,
    };
  } catch (err) {
    // Another admin added a matching serial number between validation and insert.
    if (isUniqueViolation(err, "assets_company_serial_uq")) {
      throw new ServiceError("A serial number in this file was just added by someone else. Validate the file again.", 409);
    }
    throw err;
  }
};
