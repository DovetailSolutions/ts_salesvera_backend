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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validateEnvelope = (body: any): body is BulkEnvelope => {
  
  return (
    body &&
    typeof body.guid === "string" &&
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

// ─── POST /admin/bulk/invoices ────────────────────────────────────────────────

export const bulkInvoices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, companyId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records, financialYear } = req.body as BulkEnvelope;
    const results: RecordResult[] = [];

    for (const record of records) {
      const tallyGuid: string = record.tallyGuid;

      if (!tallyGuid) {
        results.push({ tallyGuid: "", status: "failed", error: "tallyGuid missing" });
        continue;
      }

      try {
        const existing = await Invoices.findOne({
          where: { guid: tallyGuid, companyId: Number(companyId) },
        });

        if (existing) {
          await existing.update({
            invoiceNumber: record.voucherNumber ?? existing.invoiceNumber,
            customerName: record.party ?? existing.customerName,
            invoiceDate: record.date ? new Date(record.date) : existing.invoiceDate,
            invoice: record,
            status: "imported",
            alterid: record.alterId ?? existing.alterid,
          });
          results.push({ tallyGuid, status: "updated", id: existing.id });
        } else {
          const created = await Invoices.create({
            guid: tallyGuid,
            invoiceNumber: record.voucherNumber || tallyGuid,
            customerName: record.party || "",
            invoiceDate: record.date ? new Date(record.date) : null,
            invoice: record,
            status: "imported",
            userId: Number(userId),
            companyId: Number(companyId),
            alterid: record.alterId ?? null,
          });
          results.push({ tallyGuid, status: "created", id: created.id });
        }
      } catch (err) {
        results.push({
          tallyGuid,
          status: "failed",
          error: err instanceof Error ? err.message : "insert failed",
        });
      }
    }

    createSuccess(res, "Bulk invoices processed", {
      summary: buildSummary(results),
      results,
    });
  } catch (error) {
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
  try {
    const { userId, companyId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records } = req.body as BulkEnvelope;
    const results: RecordResult[] = [];

    for (const record of records) {
      const tallyGuid: string = record.tallyGuid;

      if (!tallyGuid) {
        results.push({ tallyGuid: "", status: "failed", error: "tallyGuid missing" });
        continue;
      }

      try {
        const existing = await Quotations.findOne({
          where: { guid: tallyGuid, companyId: Number(companyId) },
        });

        if (existing) {
          await existing.update({
            quotationNumber: record.voucherNumber ?? existing.quotationNumber,
            customerName: record.party ?? existing.customerName,
            quotation: record,
            status: "imported",
            alterid: record.alterId ?? existing.alterid,
          });
          results.push({ tallyGuid, status: "updated", id: existing.id });
        } else {
          const created = await Quotations.create({
            guid: tallyGuid,
            quotationNumber: record.voucherNumber || tallyGuid,
            referenceNumber: record.referenceNumber || "",
            customerName: record.party || "",
            quotation: record,
            status: "imported",
            isConsumed: false,
            userId: Number(userId),
            companyId: Number(companyId),
            alterid: record.alterId ?? null,
          });
          results.push({ tallyGuid, status: "created", id: created.id });
        }
      } catch (err) {
        results.push({
          tallyGuid,
          status: "failed",
          error: err instanceof Error ? err.message : "insert failed",
        });
      }
    }

    createSuccess(res, "Bulk quotations processed", {
      summary: buildSummary(results),
      results,
    });
  } catch (error) {
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
  try {
    const { userId } = req.userData as JwtPayload;

    console.log(">>>>>>>>>>>>>",req.body.guid)

    // if (!validateEnvelope(req.body.guid)) {
    //   badRequest(res, "Invalid envelope: company.guid and records[] are required");
    //   return;
    // }

    const { records } = req.body as BulkEnvelope;
    const results: RecordResult[] = [];

    for (const record of records) {
      const tallyGuid: string = record.tallyGuid || record.guid || "";
      const mobile: string = record.mobile || record.phone || "";
      const email: string = record.email || "";

      if (!tallyGuid && !mobile && !email) {
        results.push({ tallyGuid, status: "failed", error: "tallyGuid, mobile, or email required" });
        continue;
      }

      try {
        // 1. GUID-first lookup
        let existing = tallyGuid
          ? await MeetingUser.findOne({ where: { tallyGuid } })
          : null;

        // 2. Fallback to mobile / email
        if (!existing) {
          const duplicateChecks: any[] = [];
          if (mobile) duplicateChecks.push({ mobile });
          if (email) duplicateChecks.push({ email });
          if (duplicateChecks.length) {
            existing = await MeetingUser.findOne({ where: { [Op.or]: duplicateChecks } });
          }
        }

        if (existing) {
          await existing.update({
            tallyGuid: tallyGuid || (existing as any).tallyGuid,
            name: record.name ?? existing.name,
            companyName: record.companyName ?? existing.companyName,
            state: record.state ?? existing.state,
            city: record.city ?? existing.city,
            country: record.country ?? existing.country,
            address: record.address ?? existing.address,
            gstNumber: record.gstNumber ?? existing.gstNumber,
            panNumber: record.panNumber ?? existing.panNumber,
            status: "imported",
          });
          results.push({ tallyGuid, status: "updated", id: (existing as any).id });
        } else {
          const created = await MeetingUser.create({
            tallyGuid: tallyGuid || null,
            name: record.name || "",
            email: email || null,
            mobile: mobile || null,
            companyName: record.companyName || "",
            customerType: record.customerType || "existing",
            state: record.state || "",
            city: record.city || null,
            country: record.country || "",
            address: record.address || null,
            gstNumber: record.gstNumber || null,
            panNumber: record.panNumber || null,
            userId: Number(userId),
            status: "imported",
          });
          results.push({ tallyGuid, status: "created", id: (created as any).id });
        }
      } catch (err) {
        results.push({
          tallyGuid,
          status: "failed",
          error: err instanceof Error ? err.message : "insert failed",
        });
      }
    }

    createSuccess(res, "Bulk clients processed", {
      summary: buildSummary(results),
      results,
    });
  } catch (error) {
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
  try {
    const { userId } = req.userData as JwtPayload;

    if (!validateEnvelope(req.body)) {
      badRequest(res, "Invalid envelope: company.guid and records[] are required");
      return;
    }

    const { records } = req.body as BulkEnvelope;
    const results: RecordResult[] = [];

    for (const record of records) {
      const tallyGuid: string = record.tallyGuid || record.guid || "";
      const name: string = (record.name || record.stockItemName || "").trim();
      const categoryId = record.CategoryId || record.categoryId;

      if (!name) {
        results.push({ tallyGuid, status: "failed", error: "name is required" });
        continue;
      }

      try {
        // 1. GUID-first lookup
        let existing = tallyGuid
          ? await SubCategory.findOne({ where: { tallyGuid, adminId: Number(userId) } })
          : null;

        // 2. Fallback to name + CategoryId
        if (!existing) {
          const where: any = { sub_category_name: name, adminId: Number(userId) };
          if (categoryId) where.CategoryId = categoryId;
          existing = await SubCategory.findOne({ where });
        }

        if (existing) {
          await existing.update({
            tallyGuid: tallyGuid || existing.tallyGuid,
            amount: record.amount ?? record.rate ?? existing.amount,
            text: record.tax ?? record.gst ?? existing.text,
            unit: record.unit ?? existing.unit,
            hsnCode: record.hsnCode ?? existing.hsnCode,
            gst: record.gst ?? existing.gst,
          });
          results.push({ tallyGuid, status: "updated", id: (existing as any).id });
        } else {
          const created = await SubCategory.create({
            tallyGuid: tallyGuid || undefined,
            sub_category_name: name,
            CategoryId: categoryId || null,
            adminId: Number(userId),
            managerId: Number(userId),
            amount: record.amount ?? record.rate ?? null,
            text: record.tax ?? null,
            gst: record.gst ?? null,
            unit: record.unit ?? null,
            hsnCode: record.hsnCode ?? null,
            status: "draft",
          });
          results.push({ tallyGuid, status: "created", id: (created as any).id });
        }
      } catch (err) {
        results.push({
          tallyGuid,
          status: "failed",
          error: err instanceof Error ? err.message : "insert failed",
        });
      }
    }

    createSuccess(res, "Bulk stock items processed", {
      summary: buildSummary(results),
      results,
    });
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
  }
};
