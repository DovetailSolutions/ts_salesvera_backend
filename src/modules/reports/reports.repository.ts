import { Op } from "sequelize";
import { User, Attendance, Leave, Meeting, CompanyLeave, Task, Expense, Quotations, Invoices } from "../../config/dbConnection";

// ============================================================
// Reports repository — raw record fetches for the Download Reports
// (Insights) module. All three domains are scoped by the same
// pre-resolved `employeeIds` list (see reports.service.ts) so a manager's
// report and an admin's/owner's report use identical query shapes, just
// over a different-sized employee set.
//
// Quotations/Invoices below read from the Tally-linked models purely for a
// read-only summary sheet (counts/status breakdown) — no write path, no
// business logic, nothing shared with or imported from the frozen
// quotation/invoice controllers/routes. See reports.service.ts for why.
// ============================================================

export const findScopedEmployees = (employeeIds: number[]) =>
  User.findAll({
    where: { id: { [Op.in]: employeeIds } },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "role"],
    order: [["role", "ASC"], ["firstName", "ASC"]],
  });

export const findScopedAttendance = (employeeIds: number[], fromDate: string, toDate: string) =>
  Attendance.findAll({
    where: {
      employee_id: { [Op.in]: employeeIds },
      date: { [Op.between]: [fromDate, toDate] },
    },
    include: [{ model: CompanyLeave, as: "leaveType", attributes: ["id", "leaveName"] }],
    order: [["employee_id", "ASC"], ["date", "ASC"]],
  });

export const findScopedLeaves = (employeeIds: number[], fromDate: string, toDate: string) =>
  Leave.findAll({
    where: {
      employee_id: { [Op.in]: employeeIds },
      // Overlap, not containment — a leave spanning into or out of the
      // requested range still belongs in the report, same convention as
      // the existing overlap checks in leave.service.ts.
      from_date: { [Op.lte]: toDate },
      to_date: { [Op.gte]: fromDate },
    },
    include: [{ model: CompanyLeave, as: "leaveTypeRef", attributes: ["id", "leaveName"] }],
    order: [["employee_id", "ASC"], ["from_date", "ASC"]],
  });

export const findScopedMeetings = (employeeIds: number[], fromDate: Date, toDate: Date) =>
  Meeting.findAll({
    where: {
      userId: { [Op.in]: employeeIds },
      scheduledTime: { [Op.between]: [fromDate, toDate] },
    },
    order: [["userId", "ASC"], ["scheduledTime", "ASC"]],
  });

export const findScopedTasks = (employeeIds: number[], fromDate: Date, toDate: Date) =>
  Task.findAll({
    where: {
      [Op.or]: [
        { assignedTo: { [Op.in]: employeeIds } },
        { assignedBy: { [Op.in]: employeeIds } },
      ],
      createdAt: { [Op.between]: [fromDate, toDate] },
    } as any,
    order: [["assignedTo", "ASC"], ["createdAt", "ASC"]],
  });

// Expense.date is a free-text string field (no fixed format enforced at
// creation) — filtered by parsed date in the service layer instead of a SQL
// range, same "date || createdAt" fallback the ExpenseManagement.jsx UI
// already relies on.
export const findScopedExpenses = (employeeIds: number[]) =>
  Expense.findAll({
    where: { userId: { [Op.in]: employeeIds } },
    order: [["userId", "ASC"], ["id", "ASC"]],
  });

// Quotations/Invoices: company-wide by default; restricted to `employeeIds`
// (the creating userId) only for a manager's own-team scoping — see
// reports.service.ts. Read-only, attributes-limited — never touches the
// frozen quotation/invoice controllers or the `invoice`/`quotation` JSON
// payload column itself.
export const findScopedQuotations = (companyId: number, employeeIds: number[] | null, fromDate: Date, toDate: Date) =>
  Quotations.findAll({
    where: {
      companyId,
      ...(employeeIds ? { userId: { [Op.in]: employeeIds } } : {}),
      createdAt: { [Op.between]: [fromDate, toDate] },
    } as any,
    attributes: ["id", "userId", "status", "quotationNumber", "referenceNumber", "customerName", "isConsumed", "createdAt"],
    order: [["createdAt", "DESC"]],
  });

export const findScopedInvoices = (companyId: number, employeeIds: number[] | null, fromDate: Date, toDate: Date) =>
  Invoices.findAll({
    where: {
      companyId,
      ...(employeeIds ? { userId: { [Op.in]: employeeIds } } : {}),
      createdAt: { [Op.between]: [fromDate, toDate] },
    } as any,
    attributes: ["id", "userId", "status", "invoiceNumber", "customerName", "quotationNumber", "invoiceDate", "createdAt"],
    order: [["createdAt", "DESC"]],
  });
