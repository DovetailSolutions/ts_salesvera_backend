"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkStockItems = exports.bulkClients = exports.bulkQuotations = exports.bulkInvoices = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const errorMessage_1 = require("../middlewear/errorMessage");
// ─── Logger ───────────────────────────────────────────────────────────────────
const log = (tag, msg, data) => {
    const ts = new Date().toISOString();
    const extra = data ? " " + JSON.stringify(data) : "";
    console.log(`[${ts}] [BulkSync][${tag}] ${msg}${extra}`);
};
const logError = (tag, msg, err, data) => {
    const ts = new Date().toISOString();
    const extra = data ? " " + JSON.stringify(data) : "";
    const errMsg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[${ts}] [BulkSync][${tag}] ERROR ${msg}${extra} | ${errMsg}`);
    if (stack)
        console.error(stack);
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 500;
const validateEnvelope = (body) => {
    return (body &&
        body.company &&
        typeof body.company.guid === "string" &&
        Array.isArray(body.records) &&
        body.records.length > 0);
};
const buildSummary = (results) => ({
    received: results.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    failed: results.filter((r) => r.status === "failed").length,
});
// Split array into chunks of size n
const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n)
        out.push(arr.slice(i, i + n));
    return out;
};
// ─── POST /admin/bulk/invoices ────────────────────────────────────────────────
const bulkInvoices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    try {
        const { userId, companyId } = req.userData;
        if (!validateEnvelope(req.body)) {
            log("invoices", "Invalid envelope", { userId, companyId });
            (0, errorMessage_1.badRequest)(res, "Invalid envelope: company.guid and records[] are required");
            return;
        }
        const { records } = req.body;
        log("invoices", "Started", { userId, companyId, total: records.length });
        const results = [];
        // Separate valid from invalid records up-front
        const valid = records.filter((r) => {
            if (!r.tallyGuid) {
                logError("invoices", "Record skipped — tallyGuid missing", null, { record: r });
                results.push({ tallyGuid: "", status: "failed", error: "tallyGuid missing" });
                return false;
            }
            return true;
        });
        const guids = valid.map((r) => r.tallyGuid);
        // One query to fetch all existing records
        const existingRows = yield dbConnection_1.Invoices.findAll({
            where: { guid: { [sequelize_1.Op.in]: guids }, companyId: Number(companyId) },
            attributes: ["id", "guid", "invoiceNumber", "customerName", "invoiceDate", "alterid"],
        });
        const existingMap = new Map(existingRows.map((e) => [e.guid, e]));
        const toCreate = [];
        const toUpdate = [];
        for (const record of valid) {
            const ex = existingMap.get(record.tallyGuid);
            if (ex)
                toUpdate.push({ record, existing: ex });
            else
                toCreate.push(record);
        }
        log("invoices", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });
        // Bulk create in chunks
        let chunkIndex = 0;
        for (const ch of chunk(toCreate, CHUNK_SIZE)) {
            chunkIndex++;
            try {
                const created = yield dbConnection_1.Invoices.bulkCreate(ch.map((r) => {
                    var _a;
                    return ({
                        guid: r.tallyGuid,
                        invoiceNumber: r.voucherNumber || r.tallyGuid,
                        customerName: r.party || "",
                        invoiceDate: r.date ? new Date(r.date) : null,
                        invoice: r,
                        status: r.status,
                        userId: Number(userId),
                        companyId: Number(companyId),
                        alterid: (_a = r.alterId) !== null && _a !== void 0 ? _a : null,
                    });
                }));
                created.forEach((row, i) => {
                    results.push({ tallyGuid: ch[i].tallyGuid, status: "created", id: row.id });
                });
                log("invoices", `Create chunk ${chunkIndex} done`, { size: ch.length });
            }
            catch (err) {
                logError("invoices", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid) });
                ch.forEach((r) => results.push({
                    tallyGuid: r.tallyGuid,
                    status: "failed",
                    error: err instanceof Error ? err.message : "bulk create failed",
                }));
            }
        }
        // Parallel updates in chunks
        chunkIndex = 0;
        for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
            chunkIndex++;
            const settled = yield Promise.allSettled(ch.map(({ record, existing }) => {
                var _a, _b, _c;
                return existing.update({
                    invoiceNumber: (_a = record.voucherNumber) !== null && _a !== void 0 ? _a : existing.invoiceNumber,
                    customerName: (_b = record.party) !== null && _b !== void 0 ? _b : existing.customerName,
                    invoiceDate: record.date ? new Date(record.date) : existing.invoiceDate,
                    invoice: record,
                    status: record.status,
                    alterid: (_c = record.alterId) !== null && _c !== void 0 ? _c : existing.alterid,
                });
            }));
            let chunkFailed = 0;
            settled.forEach((result, i) => {
                const { record, existing } = ch[i];
                if (result.status === "fulfilled") {
                    results.push({ tallyGuid: record.tallyGuid, status: "updated", id: existing.id });
                }
                else {
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
        log("invoices", "Completed", Object.assign(Object.assign({}, summary), { elapsedMs: Date.now() - start }));
        (0, errorMessage_1.createSuccess)(res, "Bulk invoices processed", { summary, results });
    }
    catch (error) {
        logError("invoices", "Unhandled exception", error, { elapsedMs: Date.now() - start });
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong", error);
    }
});
exports.bulkInvoices = bulkInvoices;
// ─── POST /admin/bulk/quotations ──────────────────────────────────────────────
const bulkQuotations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    try {
        const { userId, companyId } = req.userData;
        if (!validateEnvelope(req.body)) {
            log("quotations", "Invalid envelope", { userId, companyId });
            (0, errorMessage_1.badRequest)(res, "Invalid envelope: company.guid and records[] are required");
            return;
        }
        const { records } = req.body;
        log("quotations", "Started", { userId, companyId, total: records.length });
        const results = [];
        const valid = records.filter((r) => {
            if (!r.tallyGuid) {
                logError("quotations", "Record skipped — tallyGuid missing", null, { record: r });
                results.push({ tallyGuid: "", status: "failed", error: "tallyGuid missing" });
                return false;
            }
            return true;
        });
        const guids = valid.map((r) => r.tallyGuid);
        const existingRows = yield dbConnection_1.Quotations.findAll({
            where: { guid: { [sequelize_1.Op.in]: guids }, companyId: Number(companyId) },
            attributes: ["id", "guid", "quotationNumber", "customerName", "alterid"],
        });
        const existingMap = new Map(existingRows.map((e) => [e.guid, e]));
        const toCreate = [];
        const toUpdate = [];
        for (const record of valid) {
            const ex = existingMap.get(record.tallyGuid);
            if (ex)
                toUpdate.push({ record, existing: ex });
            else
                toCreate.push(record);
        }
        log("quotations", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });
        let chunkIndex = 0;
        for (const ch of chunk(toCreate, CHUNK_SIZE)) {
            chunkIndex++;
            try {
                const created = yield dbConnection_1.Quotations.bulkCreate(ch.map((r) => {
                    var _a;
                    return ({
                        guid: r.tallyGuid,
                        quotationNumber: r.voucherNumber || r.tallyGuid,
                        referenceNumber: r.referenceNumber || "",
                        customerName: r.party || "",
                        quotation: r,
                        status: r.status,
                        isConsumed: false,
                        userId: Number(userId),
                        companyId: Number(companyId),
                        alterid: (_a = r.alterId) !== null && _a !== void 0 ? _a : null,
                    });
                }));
                created.forEach((row, i) => {
                    results.push({ tallyGuid: ch[i].tallyGuid, status: "created", id: row.id });
                });
                log("quotations", `Create chunk ${chunkIndex} done`, { size: ch.length });
            }
            catch (err) {
                logError("quotations", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid) });
                ch.forEach((r) => results.push({
                    tallyGuid: r.tallyGuid,
                    status: "failed",
                    error: err instanceof Error ? err.message : "bulk create failed",
                }));
            }
        }
        chunkIndex = 0;
        for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
            chunkIndex++;
            const settled = yield Promise.allSettled(ch.map(({ record, existing }) => {
                var _a, _b, _c;
                return existing.update({
                    quotationNumber: (_a = record.voucherNumber) !== null && _a !== void 0 ? _a : existing.quotationNumber,
                    customerName: (_b = record.party) !== null && _b !== void 0 ? _b : existing.customerName,
                    quotation: record,
                    status: record.status,
                    alterid: (_c = record.alterId) !== null && _c !== void 0 ? _c : existing.alterid,
                });
            }));
            let chunkFailed = 0;
            settled.forEach((result, i) => {
                const { record, existing } = ch[i];
                if (result.status === "fulfilled") {
                    results.push({ tallyGuid: record.tallyGuid, status: "updated", id: existing.id });
                }
                else {
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
        log("quotations", "Completed", Object.assign(Object.assign({}, summary), { elapsedMs: Date.now() - start }));
        (0, errorMessage_1.createSuccess)(res, "Bulk quotations processed", { summary, results });
    }
    catch (error) {
        logError("quotations", "Unhandled exception", error, { elapsedMs: Date.now() - start });
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong", error);
    }
});
exports.bulkQuotations = bulkQuotations;
// ─── POST /admin/bulk/clients ─────────────────────────────────────────────────
const bulkClients = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    try {
        const { userId } = req.userData;
        if (!validateEnvelope(req.body)) {
            log("clients", "Invalid envelope", { userId });
            (0, errorMessage_1.badRequest)(res, "Invalid envelope: company.guid and records[] are required");
            return;
        }
        const { records } = req.body;
        log("clients", "Started", { userId, total: records.length });
        const results = [];
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
        const orClauses = [];
        if (guids.length)
            orClauses.push({ tallyGuid: { [sequelize_1.Op.in]: guids } });
        if (mobiles.length)
            orClauses.push({ mobile: { [sequelize_1.Op.in]: mobiles } });
        if (emails.length)
            orClauses.push({ email: { [sequelize_1.Op.in]: emails } });
        const existingRows = yield dbConnection_1.MeetingUser.findAll({
            where: { userId: Number(userId), [sequelize_1.Op.or]: orClauses },
        });
        // Build lookup maps
        const byGuid = new Map();
        const byMobile = new Map();
        const byEmail = new Map();
        for (const row of existingRows) {
            if (row.tallyGuid)
                byGuid.set(row.tallyGuid, row);
            if (row.mobile)
                byMobile.set(row.mobile, row);
            if (row.email)
                byEmail.set(row.email, row);
        }
        const toCreate = [];
        const toUpdate = [];
        for (const record of valid) {
            const tallyGuid = record.tallyGuid || record.guid || "";
            const mobile = record.mobile || record.phone || "";
            const email = record.email || "";
            const ex = (tallyGuid && byGuid.get(tallyGuid)) ||
                (mobile && byMobile.get(mobile)) ||
                (email && byEmail.get(email));
            if (ex)
                toUpdate.push({ record, existing: ex });
            else
                toCreate.push(record);
        }
        log("clients", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });
        let chunkIndex = 0;
        for (const ch of chunk(toCreate, CHUNK_SIZE)) {
            chunkIndex++;
            try {
                const created = yield dbConnection_1.MeetingUser.bulkCreate(ch.map((r) => ({
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
                })));
                created.forEach((row, i) => {
                    results.push({ tallyGuid: ch[i].tallyGuid || ch[i].guid || "", status: "created", id: row.id });
                });
                log("clients", `Create chunk ${chunkIndex} done`, { size: ch.length });
            }
            catch (err) {
                logError("clients", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid || r.guid) });
                ch.forEach((r) => results.push({
                    tallyGuid: r.tallyGuid || r.guid || "",
                    status: "failed",
                    error: err instanceof Error ? err.message : "bulk create failed",
                }));
            }
        }
        chunkIndex = 0;
        for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
            chunkIndex++;
            const settled = yield Promise.allSettled(ch.map(({ record, existing }) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                const tallyGuid = record.tallyGuid || record.guid || "";
                return existing.update({
                    tallyGuid: tallyGuid || existing.tallyGuid,
                    name: (_a = record.name) !== null && _a !== void 0 ? _a : existing.name,
                    companyName: (_b = record.companyName) !== null && _b !== void 0 ? _b : existing.companyName,
                    state: (_c = record.state) !== null && _c !== void 0 ? _c : existing.state,
                    city: (_d = record.city) !== null && _d !== void 0 ? _d : existing.city,
                    country: (_e = record.country) !== null && _e !== void 0 ? _e : existing.country,
                    address: (_f = record.address) !== null && _f !== void 0 ? _f : existing.address,
                    gstNumber: (_g = record.gstNumber) !== null && _g !== void 0 ? _g : existing.gstNumber,
                    panNumber: (_h = record.panNumber) !== null && _h !== void 0 ? _h : existing.panNumber,
                    status: record.status,
                });
            }));
            let chunkFailed = 0;
            settled.forEach((result, i) => {
                const { record, existing } = ch[i];
                const tallyGuid = record.tallyGuid || record.guid || "";
                if (result.status === "fulfilled") {
                    results.push({ tallyGuid, status: "updated", id: existing.id });
                }
                else {
                    chunkFailed++;
                    logError("clients", `Update failed for guid=${tallyGuid}`, result.reason, { existingId: existing.id });
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
        log("clients", "Completed", Object.assign(Object.assign({}, summary), { elapsedMs: Date.now() - start }));
        (0, errorMessage_1.createSuccess)(res, "Bulk clients processed", { summary, results });
    }
    catch (error) {
        logError("clients", "Unhandled exception", error, { elapsedMs: Date.now() - start });
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong", error);
    }
});
exports.bulkClients = bulkClients;
// ─── POST /admin/bulk/stock-items ─────────────────────────────────────────────
const bulkStockItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    try {
        const { userId } = req.userData;
        if (!validateEnvelope(req.body)) {
            log("stock-items", "Invalid envelope", { userId });
            (0, errorMessage_1.badRequest)(res, "Invalid envelope: company.guid and records[] are required");
            return;
        }
        const { records } = req.body;
        log("stock-items", "Started", { userId, total: records.length });
        const results = [];
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
        const existingRows = yield dbConnection_1.SubCategory.findAll({
            where: {
                adminId: Number(userId),
                [sequelize_1.Op.or]: [
                    ...(guids.length ? [{ tallyGuid: { [sequelize_1.Op.in]: guids } }] : []),
                    { sub_category_name: { [sequelize_1.Op.in]: names } },
                ],
            },
        });
        const byGuid = new Map();
        const byName = new Map();
        for (const row of existingRows) {
            if (row.tallyGuid)
                byGuid.set(row.tallyGuid, row);
            byName.set(row.sub_category_name, row);
        }
        const toCreate = [];
        const toUpdate = [];
        for (const record of valid) {
            const tallyGuid = record.tallyGuid || record.guid || "";
            const name = (record.name || record.stockItemName || "").trim();
            const ex = (tallyGuid && byGuid.get(tallyGuid)) || byName.get(name);
            if (ex)
                toUpdate.push({ record, existing: ex });
            else
                toCreate.push(record);
        }
        log("stock-items", "Partitioned", { toCreate: toCreate.length, toUpdate: toUpdate.length });
        let chunkIndex = 0;
        for (const ch of chunk(toCreate, CHUNK_SIZE)) {
            chunkIndex++;
            try {
                const created = yield dbConnection_1.SubCategory.bulkCreate(ch.map((r) => {
                    var _a, _b, _c, _d, _e, _f;
                    return ({
                        tallyGuid: r.tallyGuid || r.guid || undefined,
                        sub_category_name: (r.name || r.stockItemName || "").trim(),
                        CategoryId: r.CategoryId || r.categoryId || null,
                        adminId: Number(userId),
                        managerId: Number(userId),
                        amount: (_b = (_a = r.amount) !== null && _a !== void 0 ? _a : r.rate) !== null && _b !== void 0 ? _b : null,
                        text: (_c = r.tax) !== null && _c !== void 0 ? _c : null,
                        gst: (_d = r.gst) !== null && _d !== void 0 ? _d : null,
                        unit: (_e = r.unit) !== null && _e !== void 0 ? _e : null,
                        hsnCode: (_f = r.hsnCode) !== null && _f !== void 0 ? _f : null,
                        status: r.status,
                    });
                }));
                created.forEach((row, i) => {
                    results.push({ tallyGuid: ch[i].tallyGuid || ch[i].guid || "", status: "created", id: row.id });
                });
                log("stock-items", `Create chunk ${chunkIndex} done`, { size: ch.length });
            }
            catch (err) {
                logError("stock-items", `Create chunk ${chunkIndex} failed`, err, { size: ch.length, guids: ch.map((r) => r.tallyGuid || r.guid) });
                ch.forEach((r) => results.push({
                    tallyGuid: r.tallyGuid || r.guid || "",
                    status: "failed",
                    error: err instanceof Error ? err.message : "bulk create failed",
                }));
            }
        }
        chunkIndex = 0;
        for (const ch of chunk(toUpdate, CHUNK_SIZE)) {
            chunkIndex++;
            const settled = yield Promise.allSettled(ch.map(({ record, existing }) => {
                var _a, _b, _c, _d, _e, _f, _g;
                return existing.update({
                    tallyGuid: record.tallyGuid || record.guid || existing.tallyGuid,
                    amount: (_b = (_a = record.amount) !== null && _a !== void 0 ? _a : record.rate) !== null && _b !== void 0 ? _b : existing.amount,
                    text: (_d = (_c = record.tax) !== null && _c !== void 0 ? _c : record.gst) !== null && _d !== void 0 ? _d : existing.text,
                    unit: (_e = record.unit) !== null && _e !== void 0 ? _e : existing.unit,
                    hsnCode: (_f = record.hsnCode) !== null && _f !== void 0 ? _f : existing.hsnCode,
                    gst: (_g = record.gst) !== null && _g !== void 0 ? _g : existing.gst,
                });
            }));
            let chunkFailed = 0;
            settled.forEach((result, i) => {
                const { record, existing } = ch[i];
                const tallyGuid = record.tallyGuid || record.guid || "";
                if (result.status === "fulfilled") {
                    results.push({ tallyGuid, status: "updated", id: existing.id });
                }
                else {
                    chunkFailed++;
                    logError("stock-items", `Update failed for guid=${tallyGuid}`, result.reason, { existingId: existing.id });
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
        log("stock-items", "Completed", Object.assign(Object.assign({}, summary), { elapsedMs: Date.now() - start }));
        (0, errorMessage_1.createSuccess)(res, "Bulk stock items processed", { summary, results });
    }
    catch (error) {
        logError("stock-items", "Unhandled exception", error, { elapsedMs: Date.now() - start });
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong", error);
    }
});
exports.bulkStockItems = bulkStockItems;
