"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.generateReport = void 0;
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
const companyAccess_1 = require("../shared/companyAccess");
const ReportsRepo = __importStar(require("./reports.repository"));
// ============================================================
// Reports (Insights) service — the Download Reports module. Always scoped
// to one explicit company (companyId is required, never inferred), so a
// caller managing/owning multiple companies never gets their data mixed
// together — this matters even for "manager", who can legitimately be
// assigned to more than one company via CompanyManager.
// ============================================================
const MAX_RANGE_DAYS = 366 * 2; // generous cap — a couple of years in one go
const generateReport = (loggedInId, role, companyId, fromDateStr, toDateStr) => __awaiter(void 0, void 0, void 0, function* () {
    if (!companyId)
        throw new serviceError_1.ServiceError("companyId is required");
    if (!fromDateStr || !toDateStr)
        throw new serviceError_1.ServiceError("fromDate and toDate are required");
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()))
        throw new serviceError_1.ServiceError("Invalid date format");
    if (toDate < fromDate)
        throw new serviceError_1.ServiceError("toDate must be after fromDate");
    // toDate as parsed above lands on midnight — anything scheduled/created
    // later that same calendar day would otherwise fall outside the
    // Op.between range and silently disappear from the report.
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);
    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (spanDays > MAX_RANGE_DAYS)
        throw new serviceError_1.ServiceError(`Date range too large (max ${MAX_RANGE_DAYS} days)`);
    const allowed = yield (0, companyAccess_1.hasCompanyAccess)(companyId, loggedInId, role);
    if (!allowed)
        throw new serviceError_1.ServiceError("You do not have access to this company", 403);
    const companyRoster = yield (0, companyAccess_1.resolveCompanyEmployeeIds)(companyId);
    // Manager: their own team within THIS specific company only — a manager
    // assigned to more than one company (a real, supported case via
    // CompanyManager) must never see another company's team just because
    // both happen to trace back to them as creator.
    let employeeIds;
    if (role === "manager") {
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        const ownIdsInThisCompany = new Set([loggedInId, ...childIds]);
        employeeIds = companyRoster.allIds.filter((id) => ownIdsInThisCompany.has(id));
    }
    else {
        // admin/user/super_admin: the whole company's roster — hasCompanyAccess
        // above already verified they're actually entitled to it.
        employeeIds = companyRoster.allIds;
    }
    // Quotations/Invoices are company-level Tally-linked records, not
    // per-employee ones — admin/user/super_admin see the whole company's
    // sales activity (they're entitled to the company itself), a manager
    // only sees the slice their own team actually created.
    const quotationInvoiceUserFilter = role === "manager" ? employeeIds : null;
    if (employeeIds.length === 0) {
        return {
            companyId,
            dateRange: { fromDate: fromDateStr, toDate: toDateStr },
            employees: [],
            attendance: [],
            leaves: [],
            meetings: [],
            tasks: [],
            expenses: [],
            quotations: [],
            invoices: [],
        };
    }
    const [employees, attendance, leaves, meetings, tasks, expensesRaw, quotations, invoices] = yield Promise.all([
        ReportsRepo.findScopedEmployees(employeeIds),
        ReportsRepo.findScopedAttendance(employeeIds, fromDateStr, toDateStr),
        ReportsRepo.findScopedLeaves(employeeIds, fromDateStr, toDateStr),
        ReportsRepo.findScopedMeetings(employeeIds, fromDate, toDateEnd),
        ReportsRepo.findScopedTasks(employeeIds, fromDate, toDateEnd),
        ReportsRepo.findScopedExpenses(employeeIds),
        ReportsRepo.findScopedQuotations(companyId, quotationInvoiceUserFilter, fromDate, toDateEnd),
        ReportsRepo.findScopedInvoices(companyId, quotationInvoiceUserFilter, fromDate, toDateEnd),
    ]);
    // Expense.date has no enforced format (free-text from the mobile client),
    // so it can't be filtered in SQL — parse it the same way the
    // ExpenseManagement.jsx UI already does ("date field, fall back to
    // createdAt") and filter to the requested range here instead.
    const expenses = expensesRaw.filter((e) => {
        const parsed = new Date(e.date || e.createdAt);
        return !isNaN(parsed.getTime()) && parsed >= fromDate && parsed <= toDateEnd;
    });
    return {
        companyId,
        dateRange: { fromDate: fromDateStr, toDate: toDateStr },
        employees,
        attendance,
        leaves,
        meetings,
        tasks,
        expenses,
        quotations,
        invoices,
    };
});
exports.generateReport = generateReport;
