import { ServiceError } from "../shared/serviceError";
import { getAllChildUserIds } from "../shared/userHierarchy";
import { hasCompanyAccess, resolveCompanyEmployeeIds } from "../shared/companyAccess";
import * as ReportsRepo from "./reports.repository";

// ============================================================
// Reports (Insights) service — the Download Reports module. Always scoped
// to one explicit company (companyId is required, never inferred), so a
// caller managing/owning multiple companies never gets their data mixed
// together — this matters even for "manager", who can legitimately be
// assigned to more than one company via CompanyManager.
// ============================================================

const MAX_RANGE_DAYS = 366 * 2; // generous cap — a couple of years in one go

export const generateReport = async (
  loggedInId: number,
  role: string | undefined,
  companyId: number,
  fromDateStr: string,
  toDateStr: string
) => {
  if (!companyId) throw new ServiceError("companyId is required");
  if (!fromDateStr || !toDateStr) throw new ServiceError("fromDate and toDate are required");

  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) throw new ServiceError("Invalid date format");
  if (toDate < fromDate) throw new ServiceError("toDate must be after fromDate");

  // toDate as parsed above lands on midnight — anything scheduled/created
  // later that same calendar day would otherwise fall outside the
  // Op.between range and silently disappear from the report.
  const toDateEnd = new Date(toDate);
  toDateEnd.setHours(23, 59, 59, 999);

  const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (spanDays > MAX_RANGE_DAYS) throw new ServiceError(`Date range too large (max ${MAX_RANGE_DAYS} days)`);

  const allowed = await hasCompanyAccess(companyId, loggedInId, role);
  if (!allowed) throw new ServiceError("You do not have access to this company", 403);

  const companyRoster = await resolveCompanyEmployeeIds(companyId);

  // Manager: their own team within THIS specific company only — a manager
  // assigned to more than one company (a real, supported case via
  // CompanyManager) must never see another company's team just because
  // both happen to trace back to them as creator.
  let employeeIds: number[];
  if (role === "manager") {
    const childIds = await getAllChildUserIds(loggedInId);
    const ownIdsInThisCompany = new Set([loggedInId, ...childIds]);
    employeeIds = companyRoster.allIds.filter((id) => ownIdsInThisCompany.has(id));
  } else {
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

  const [employees, attendance, leaves, meetings, tasks, expensesRaw, quotations, invoices] = await Promise.all([
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
  const expenses = (expensesRaw as any[]).filter((e) => {
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
};
