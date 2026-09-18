import * as XLSX from "xlsx";
import { getISTDateString } from "../shared/dateUtils";
import { Asset } from "./asset.models";
import { Actor, buildAssetQuery, requireAdminCompany } from "./asset.service";

// ============================================================
// Excel (.xlsx) export of the asset register — same library and response
// shape as the attendance report export. Uses the exact filters/sort of the
// on-screen list (buildAssetQuery), always scoped to the admin's company.
// Cells are written as plain values (never formulas), so text that starts
// with "=" in an asset name can't execute when the file is opened.
// ============================================================

export const EXPORT_MAX_ROWS = 10000;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDateTime = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const ist = new Date(new Date(d).getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 16).replace("T", " ");
};
const label = (v: string | null | undefined) =>
  String(v ?? "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const exportAssetsExcel = async (actor: Actor, query: any) => {
  const companyId = await requireAdminCompany(actor);
  const { where, include, order } = buildAssetQuery(companyId, query);

  const assets = await Asset.findAll({
    where,
    attributes: [
      "id", "assetCode", "name", "brand", "model", "serialNumber", "purchaseDate",
      "purchasePrice", "status", "condition", "description", "createdAt", "updatedAt",
    ],
    include,
    order,
    limit: EXPORT_MAX_ROWS + 1,
  });

  const truncated = assets.length > EXPORT_MAX_ROWS;
  const rows = (truncated ? assets.slice(0, EXPORT_MAX_ROWS) : assets).map((a: any) => {
    const holder = a.activeAssignment?.assignedTo;
    return {
      "Asset Code": a.assetCode,
      "Asset Type": a.category?.name ?? "",
      "Asset Name": a.name,
      "Brand": a.brand ?? "",
      "Model": a.model ?? "",
      "Serial Number": a.serialNumber ?? "",
      "Status": label(a.status),
      "Condition": label(a.condition),
      "Assigned To": holder ? `${holder.firstName ?? ""} ${holder.lastName ?? ""}`.trim() : "",
      "Holder Role": holder ? label(holder.role) : "",
      "Holder Employee Code": holder?.employeeCode ?? "",
      "Holder Email": holder?.email ?? "",
      "Assigned Date": a.activeAssignment ? getISTDateString(new Date(a.activeAssignment.assignedAt)) : "",
      "Purchase Date": a.purchaseDate ?? "",
      "Purchase Price (INR)": a.purchasePrice != null ? Number(a.purchasePrice) : "",
      "Description": a.description ?? "",
      "Created (IST)": istDateTime(a.createdAt),
      "Last Updated (IST)": istDateTime(a.updatedAt),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "No assets match the selected filters": "" }]);
  if (rows.length) {
    const widths = [12, 16, 28, 14, 18, 20, 13, 11, 22, 12, 18, 28, 13, 13, 18, 36, 17, 17];
    worksheet["!cols"] = widths.map((wch) => ({ wch }));
    // Excel's filter dropdowns on the header row.
    worksheet["!autofilter"] = { ref: worksheet["!ref"] as string };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    buffer,
    filename: `assets-${getISTDateString()}.xlsx`,
    count: rows.length,
    truncated,
  };
};
