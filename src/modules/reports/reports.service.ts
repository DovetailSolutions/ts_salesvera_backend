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

  if (employeeIds.length === 0) {
    return {
      companyId,
      dateRange: { fromDate: fromDateStr, toDate: toDateStr },
      employees: [],
      attendance: [],
      leaves: [],
      meetings: [],
    };
  }

  const [employees, attendance, leaves, meetings] = await Promise.all([
    ReportsRepo.findScopedEmployees(employeeIds),
    ReportsRepo.findScopedAttendance(employeeIds, fromDateStr, toDateStr),
    ReportsRepo.findScopedLeaves(employeeIds, fromDateStr, toDateStr),
    ReportsRepo.findScopedMeetings(employeeIds, fromDate, toDate),
  ]);

  return {
    companyId,
    dateRange: { fromDate: fromDateStr, toDate: toDateStr },
    employees,
    attendance,
    leaves,
    meetings,
  };
};
