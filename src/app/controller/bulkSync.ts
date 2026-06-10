import { Request, Response } from "express-serve-static-core";
import { JwtPayload } from "jsonwebtoken";
import { Op } from "sequelize";
import {
  Invoices,
  Quotations,
  MeetingUser,
  SubCategory,
} from "../../config/dbConnection";
import {
  createSuccess,
  badRequest,
} from "../middlewear/errorMessage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkEnvelope {
  source: string;
  company: { name: string; guid: string };
  financialYear?: string;
  dateRange?: { from: string; to: string };
  batch: { uploadId: string; index: number; total: number };
  records: Record<string, any>[];
}

interface RecordResult {
  tallyGuid: string;
  status: "created" | "updated" | "failed";
  id?: number;
  error?: string;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const log = (tag: string, msg: string, data?: Record<string, any>) => {
  const ts = new Date().toISOString();
  const extra = data ? " " + JSON.stringify(data) : "";
  console.log(`[${ts}] [BulkSync][${tag}] ${msg}${extra}`);
};

const logError = (tag: string, msg: string, err: unknown, data?: Record<string, any>) => {
  const ts = new Date().toISOString();
  const extra = data ? " " + JSON.stringify(data) : "";
  const errMsg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${ts}] [BulkSync][${tag}] ERROR ${msg}${extra} | ${errMsg}`);
  if (stack) console.error(stack);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 500;

const validateEnvelope = (body: any): body is BulkEnvelope => {
  return (
    body &&
    body.company &&
    typeof body.company.guid === "string" &&
    Array.isArray(body.records) &&
    body.records.length > 0
  );
};

const buildSummary = (results: RecordResult[]) => ({
  received: results.length,
  created: results.filter((r) => r.status === "created").length,
  updated: results.filter((r) => r.status === "updated").length,
  failed: results.filter((r) => r.status === "failed").length,
});

// Split array into chunks of size n
const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// ─── POST /admin/bulk/invoices ────────────────────────────────────────────────

export const bulkInvoices = async (
  req: Request,
  res: Response
): Promise<void> => {
  const start = Date.now();
  try {
    const { userId, companyId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      log("invoices", "Invalid envelope", { userId, companyId });
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records } = req.body as BulkEnvelope;
    log("invoices", "Started", { userId, companyId, total: records.length });

    const results: RecordResult[] = [];

    // Separate valid from invalid records up-front
    const valid = records.filter((r) => {
      if (!r.tallyGuid) {
        logError("invoices", "Record skipped — tallyGuid missing", null, { record: r });
        results.push({ tallyGuid: "", status: "failed", error: "tallyGuid missing" });
        return false;
      }
      return true;
    });

    const guids = valid.map((r) => r.tallyGuid as string);

    // One query to fetch all existing records
    const existingRows = await Invoices.findAll({
      where: { guid: { [Op.in]: guids }, companyId: Number(companyId) },
      attributes: ["id", "guid", "invoiceNumber", "customerName", "invoiceDate", "alterid"],
    });
    const existingMap = new Map(existingRows.map((e: any) => [e.guid as string, e]));

    const toCreate: Record<string, any>[] = [];
    const toUpdate: { record: Record<string, any>; existing: any }[] = [];

    for (const record of valid) {
      const ex = existingMap.get(record.tallyGuid);
      if (ex) toUpdate.push({ record, existing: ex });
      else toCreate.push(record);
    }

    log("invoices", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });

    // Bulk create in chunks
    let chunkIndex = 0;
    for (const ch of chunk(toCreate, CHUNK_SIZE)) {
      chunkIndex++;
      try {
        const created = await Invoices.bulkCreate(
          ch.map((r) => ({
            guid: r.tallyGuid,
            invoiceNumber: r.voucherNumber || r.tallyGuid,
            customerName: r.party || "",
            invoiceDate: r.date ? new Date(r.date) : null,
            invoice: r,
            status: r.status,
            userId: Number(userId),
            companyId: Number(companyId),
            alterid: r.alterId ?? null,
          }))
        );
        created.forEach((row: any, i: number) => {
          results.push({ tallyGuid: ch[i].tallyGuid, status: "created", id: row.id });
        });
        log("invoices", `Create chunk ${chunkIndex} done`, { size: ch.length });
      } catch (err) {
        logError("invoices", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid) });
        ch.forEach((r) =>
          results.push({
            tallyGuid: r.tallyGuid,
            status: "failed",
            error: err instanceof Error ? err.message : "bulk create failed",
          })
        );
      }
    }

    // Parallel updates in chunks
    chunkIndex = 0;
    for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
      chunkIndex++;
      const settled = await Promise.allSettled(
        ch.map(({ record, existing }) =>
          existing.update({
            invoiceNumber: record.voucherNumber ?? existing.invoiceNumber,
            customerName: record.party ?? existing.customerName,
            invoiceDate: record.date ? new Date(record.date) : existing.invoiceDate,
            invoice: record,
            status: record.status,
            alterid: record.alterId ?? existing.alterid,
          })
        )
      );
      let chunkFailed = 0;
      settled.forEach((result, i) => {
        const { record, existing } = ch[i];
        if (result.status === "fulfilled") {
          results.push({ tallyGuid: record.tallyGuid, status: "updated", id: existing.id });
        } else {
          chunkFailed++;
          logError("invoices", `Update failed for guid=${record.tallyGuid}`, result.reason, { existingId: existing.id });
          results.push({
            tallyGuid: record.tallyGuid,
            status: "failed",
            error: result.reason instanceof Error ? result.reason.message : "update failed",
          });
        }
      });
      log("invoices", `Update chunk ${chunkIndex} done`, { size: ch.length, failed: chunkFailed });
    }

    const summary = buildSummary(results);
    log("invoices", "Completed", { ...summary, elapsedMs: Date.now() - start });

    createSuccess(res, "Bulk invoices processed", { summary, results });
  } catch (error) {
    logError("invoices", "Unhandled exception", error, { elapsedMs: Date.now() - start });
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
  }
};

// ─── POST /admin/bulk/quotations ──────────────────────────────────────────────

export const bulkQuotations = async (
  req: Request,
  res: Response
): Promise<void> => {
  const start = Date.now();
  try {
    const { userId, companyId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      log("quotations", "Invalid envelope", { userId, companyId });
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records } = req.body as BulkEnvelope;
    log("quotations", "Started", { userId, companyId, total: records.length });

    const results: RecordResult[] = [];

    const valid = records.filter((r) => {
      if (!r.tallyGuid) {
        logError("quotations", "Record skipped — tallyGuid missing", null, { record: r });
        results.push({ tallyGuid: "", status: "failed", error: "tallyGuid missing" });
        return false;
      }
      return true;
    });

    const guids = valid.map((r) => r.tallyGuid as string);

    const existingRows = await Quotations.findAll({
      where: { guid: { [Op.in]: guids }, companyId: Number(companyId) },
      attributes: ["id", "guid", "quotationNumber", "customerName", "alterid"],
    });
    const existingMap = new Map(existingRows.map((e: any) => [e.guid as string, e]));

    const toCreate: Record<string, any>[] = [];
    const toUpdate: { record: Record<string, any>; existing: any }[] = [];

    for (const record of valid) {
      const ex = existingMap.get(record.tallyGuid);
      if (ex) toUpdate.push({ record, existing: ex });
      else toCreate.push(record);
    }

    log("quotations", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });

    let chunkIndex = 0;
    for (const ch of chunk(toCreate, CHUNK_SIZE)) {
      chunkIndex++;
      try {
        const created = await Quotations.bulkCreate(
          ch.map((r) => ({
            guid: r.tallyGuid,
            quotationNumber: r.voucherNumber || r.tallyGuid,
            referenceNumber: r.referenceNumber || "",
            customerName: r.party || "",
            quotation: r,
            status: r.status,
            isConsumed: false,
            userId: Number(userId),
            companyId: Number(companyId),
            alterid: r.alterId ?? null,
          }))
        );
        created.forEach((row: any, i: number) => {
          results.push({ tallyGuid: ch[i].tallyGuid, status: "created", id: row.id });
        });
        log("quotations", `Create chunk ${chunkIndex} done`, { size: ch.length });
      } catch (err) {
        logError("quotations", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid) });
        ch.forEach((r) =>
          results.push({
            tallyGuid: r.tallyGuid,
            status: "failed",
            error: err instanceof Error ? err.message : "bulk create failed",
          })
        );
      }
    }

    chunkIndex = 0;
    for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
      chunkIndex++;
      const settled = await Promise.allSettled(
        ch.map(({ record, existing }) =>
          existing.update({
            quotationNumber: record.voucherNumber ?? existing.quotationNumber,
            customerName: record.party ?? existing.customerName,
            quotation: record,
            status: record.status,
            alterid: record.alterId ?? existing.alterid,
          })
        )
      );
      let chunkFailed = 0;
      settled.forEach((result, i) => {
        const { record, existing } = ch[i];
        if (result.status === "fulfilled") {
          results.push({ tallyGuid: record.tallyGuid, status: "updated", id: existing.id });
        } else {
          chunkFailed++;
          logError("quotations", `Update failed for guid=${record.tallyGuid}`, result.reason, { existingId: existing.id });
          results.push({
            tallyGuid: record.tallyGuid,
            status: "failed",
            error: result.reason instanceof Error ? result.reason.message : "update failed",
          });
        }
      });
      log("quotations", `Update chunk ${chunkIndex} done`, { size: ch.length, failed: chunkFailed });
    }

    const summary = buildSummary(results);
    log("quotations", "Completed", { ...summary, elapsedMs: Date.now() - start });

    createSuccess(res, "Bulk quotations processed", { summary, results });
  } catch (error) {
    logError("quotations", "Unhandled exception", error, { elapsedMs: Date.now() - start });
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
  }
};

// ─── POST /admin/bulk/clients ─────────────────────────────────────────────────

export const bulkClients = async (
  req: Request,
  res: Response
): Promise<void> => {
  const start = Date.now();
  try {
    const { userId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      log("clients", "Invalid envelope", { userId });
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records } = req.body as BulkEnvelope;
    log("clients", "Started", { userId, total: records.length });

    const results: RecordResult[] = [];

    const valid = records.filter((r) => {
      const tallyGuid = r.tallyGuid || r.guid || "";
      const mobile = r.mobile || r.phone || "";
      const email = r.email || "";
      if (!tallyGuid && !mobile && !email) {
        logError("clients", "Record skipped — missing all identifiers", null, { record: r });
        results.push({ tallyGuid: "", status: "failed", error: "tallyGuid, mobile, or email required" });
        return false;
      }
      return true;
    });

    const guids = valid.map((r) => r.tallyGuid || r.guid).filter(Boolean);
    const mobiles = valid.map((r) => r.mobile || r.phone).filter(Boolean);
    const emails = valid.map((r) => r.email).filter(Boolean);

    // One query to find all matching clients
    const orClauses: any[] = [];
    if (guids.length) orClauses.push({ tallyGuid: { [Op.in]: guids } });
    if (mobiles.length) orClauses.push({ mobile: { [Op.in]: mobiles } });
    if (emails.length) orClauses.push({ email: { [Op.in]: emails } });

    const existingRows = await MeetingUser.findAll({
      where: { [Op.or]: orClauses },
    });

    // Build lookup maps
    const byGuid = new Map<string, any>();
    const byMobile = new Map<string, any>();
    const byEmail = new Map<string, any>();
    for (const row of existingRows) {
      if ((row as any).tallyGuid) byGuid.set((row as any).tallyGuid, row);
      if ((row as any).mobile) byMobile.set((row as any).mobile, row);
      if ((row as any).email) byEmail.set((row as any).email, row);
    }

    const toCreate: Record<string, any>[] = [];
    const toUpdate: { record: Record<string, any>; existing: any }[] = [];

    for (const record of valid) {
      const tallyGuid = record.tallyGuid || record.guid || "";
      const mobile = record.mobile || record.phone || "";
      const email = record.email || "";
      const ex =
        (tallyGuid && byGuid.get(tallyGuid)) ||
        (mobile && byMobile.get(mobile)) ||
        (email && byEmail.get(email));
      if (ex) toUpdate.push({ record, existing: ex });
      else toCreate.push(record);
    }

    log("clients", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });

    let chunkIndex = 0;
    for (const ch of chunk(toCreate, CHUNK_SIZE)) {
      chunkIndex++;
      try {
        const created = await MeetingUser.bulkCreate(
          ch.map((r) => ({
            tallyGuid: r.tallyGuid || r.guid || null,
            name: r.name || "",
            email: r.email || null,
            mobile: r.mobile || r.phone || null,
            companyName: r.companyName || "",
            customerType: r.customerType || "existing",
            state: r.state || "",
            city: r.city || null,
            country: r.country || "",
            address: r.address || null,
            gstNumber: r.gstNumber || null,
            panNumber: r.panNumber || null,
            userId: Number(userId),
            status: r.status,
          }))
        );
        created.forEach((row: any, i: number) => {
          results.push({ tallyGuid: ch[i].tallyGuid || ch[i].guid || "", status: "created", id: row.id });
        });
        log("clients", `Create chunk ${chunkIndex} done`, { size: ch.length });
      } catch (err) {
        logError("clients", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid || r.guid) });
        ch.forEach((r) =>
          results.push({
            tallyGuid: r.tallyGuid || r.guid || "",
            status: "failed",
            error: err instanceof Error ? err.message : "bulk create failed",
          })
        );
      }
    }

    chunkIndex = 0;
    for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
      chunkIndex++;
      const settled = await Promise.allSettled(
        ch.map(({ record, existing }) => {
          const tallyGuid = record.tallyGuid || record.guid || "";
          return existing.update({
            tallyGuid: tallyGuid || (existing as any).tallyGuid,
            name: record.name ?? existing.name,
            companyName: record.companyName ?? existing.companyName,
            state: record.state ?? existing.state,
            city: record.city ?? existing.city,
            country: record.country ?? existing.country,
            address: record.address ?? existing.address,
            gstNumber: record.gstNumber ?? existing.gstNumber,
            panNumber: record.panNumber ?? existing.panNumber,
            status: record.status,
          });
        })
      );
      let chunkFailed = 0;
      settled.forEach((result, i) => {
        const { record, existing } = ch[i];
        const tallyGuid = record.tallyGuid || record.guid || "";
        if (result.status === "fulfilled") {
          results.push({ tallyGuid, status: "updated", id: (existing as any).id });
        } else {
          chunkFailed++;
          logError("clients", `Update failed for guid=${tallyGuid}`, result.reason, { existingId: (existing as any).id });
          results.push({
            tallyGuid,
            status: "failed",
            error: result.reason instanceof Error ? result.reason.message : "update failed",
          });
        }
      });
      log("clients", `Update chunk ${chunkIndex} done`, { size: ch.length, failed: chunkFailed });
    }

    const summary = buildSummary(results);
    log("clients", "Completed", { ...summary, elapsedMs: Date.now() - start });

    createSuccess(res, "Bulk clients processed", { summary, results });
  } catch (error) {
    logError("clients", "Unhandled exception", error, { elapsedMs: Date.now() - start });
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
  }
};

// ─── POST /admin/bulk/stock-items ─────────────────────────────────────────────

export const bulkStockItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  const start = Date.now();
  try {
    const { userId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      log("stock-items", "Invalid envelope", { userId });
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records } = req.body as BulkEnvelope;
    log("stock-items", "Started", { userId, total: records.length });

    const results: RecordResult[] = [];

    const valid = records.filter((r) => {
      const name = (r.name || r.stockItemName || "").trim();
      if (!name) {
        logError("stock-items", "Record skipped — name missing", null, { tallyGuid: r.tallyGuid || r.guid });
        results.push({ tallyGuid: r.tallyGuid || r.guid || "", status: "failed", error: "name is required" });
        return false;
      }
      return true;
    });

    const guids = valid.map((r) => r.tallyGuid || r.guid).filter(Boolean);
    const names = valid.map((r) => (r.name || r.stockItemName || "").trim());

    // Fetch existing by guid OR name+adminId in one query
    const existingRows = await SubCategory.findAll({
      where: {
        adminId: Number(userId),
        [Op.or]: [
          ...(guids.length ? [{ tallyGuid: { [Op.in]: guids } }] : []),
          { sub_category_name: { [Op.in]: names } },
        ],
      },
    });

    const byGuid = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const row of existingRows) {
      if ((row as any).tallyGuid) byGuid.set((row as any).tallyGuid, row);
      byName.set((row as any).sub_category_name, row);
    }

    const toCreate: Record<string, any>[] = [];
    const toUpdate: { record: Record<string, any>; existing: any }[] = [];

    for (const record of valid) {
      const tallyGuid = record.tallyGuid || record.guid || "";
      const name = (record.name || record.stockItemName || "").trim();
      const ex = (tallyGuid && byGuid.get(tallyGuid)) || byName.get(name);
      if (ex) toUpdate.push({ record, existing: ex });
      else toCreate.push(record);
    }

    log("stock-items", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });

    let chunkIndex = 0;
    for (const ch of chunk(toCreate, CHUNK_SIZE)) {
      chunkIndex++;
      try {
        const created = await SubCategory.bulkCreate(
          ch.map((r) => ({
            tallyGuid: r.tallyGuid || r.guid || undefined,
            sub_category_name: (r.name || r.stockItemName || "").trim(),
            CategoryId: r.CategoryId || r.categoryId || null,
            adminId: Number(userId),
            managerId: Number(userId),
            amount: r.amount ?? r.rate ?? null,
            text: r.tax ?? null,
            gst: r.gst ?? null,
            unit: r.unit ?? null,
            hsnCode: r.hsnCode ?? null,
            status: r.status,
          }))
        );
        created.forEach((row: any, i: number) => {
          results.push({ tallyGuid: ch[i].tallyGuid || ch[i].guid || "", status: "created", id: row.id });
        });
        log("stock-items", `Create chunk ${chunkIndex} done`, { size: ch.length });
      } catch (err) {
        logError("stock-items", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid || r.guid) });
        ch.forEach((r) =>
          results.push({
            tallyGuid: r.tallyGuid || r.guid || "",
            status: "failed",
            error: err instanceof Error ? err.message : "bulk create failed",
          })
        );
      }
    }

    chunkIndex = 0;
    for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
      chunkIndex++;
      const settled = await Promise.allSettled(
        ch.map(({ record, existing }) =>
          existing.update({
            tallyGuid: record.tallyGuid || record.guid || existing.tallyGuid,
            amount: record.amount ?? record.rate ?? existing.amount,
            text: record.tax ?? record.gst ?? existing.text,
            unit: record.unit ?? existing.unit,
            hsnCode: record.hsnCode ?? existing.hsnCode,
            gst: record.gst ?? existing.gst,
          })
        )
      );
      let chunkFailed = 0;
      settled.forEach((result, i) => {
        const { record, existing } = ch[i];
        const tallyGuid = record.tallyGuid || record.guid || "";
        if (result.status === "fulfilled") {
          results.push({ tallyGuid, status: "updated", id: (existing as any).id });
        } else {
          chunkFailed++;
          logError("stock-items", `Update failed for guid=${tallyGuid}`, result.reason, { existingId: (existing as any).id });
          results.push({
            tallyGuid,
            status: "failed",
            error: result.reason instanceof Error ? result.reason.message : "update failed",
          });
        }
      });
      log("stock-items", `Update chunk ${chunkIndex} done`, { size: ch.length, failed: chunkFailed });
    }

    const summary = buildSummary(results);
    log("stock-items", "Completed", { ...summary, elapsedMs: Date.now() - start });

    createSuccess(res, "Bulk stock items processed", { summary, results });
  } catch (error) {
    logError("stock-items", "Unhandled exception", error, { elapsedMs: Date.now() - start });
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
  }
};
