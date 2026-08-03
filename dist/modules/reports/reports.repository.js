"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findScopedInvoices = exports.findScopedQuotations = exports.findScopedExpenses = exports.findScopedTasks = exports.findScopedMeetings = exports.findScopedLeaves = exports.findScopedAttendance = exports.findScopedEmployees = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
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
const findScopedEmployees = (employeeIds) => dbConnection_1.User.findAll({
    where: { id: { [sequelize_1.Op.in]: employeeIds } },
    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "role"],
    order: [["role", "ASC"], ["firstName", "ASC"]],
});
exports.findScopedEmployees = findScopedEmployees;
const findScopedAttendance = (employeeIds, fromDate, toDate) => dbConnection_1.Attendance.findAll({
    where: {
        employee_id: { [sequelize_1.Op.in]: employeeIds },
        date: { [sequelize_1.Op.between]: [fromDate, toDate] },
    },
    include: [{ model: dbConnection_1.CompanyLeave, as: "leaveType", attributes: ["id", "leaveName"] }],
    order: [["employee_id", "ASC"], ["date", "ASC"]],
});
exports.findScopedAttendance = findScopedAttendance;
const findScopedLeaves = (employeeIds, fromDate, toDate) => dbConnection_1.Leave.findAll({
    where: {
        employee_id: { [sequelize_1.Op.in]: employeeIds },
        // Overlap, not containment — a leave spanning into or out of the
        // requested range still belongs in the report, same convention as
        // the existing overlap checks in leave.service.ts.
        from_date: { [sequelize_1.Op.lte]: toDate },
        to_date: { [sequelize_1.Op.gte]: fromDate },
    },
    include: [{ model: dbConnection_1.CompanyLeave, as: "leaveTypeRef", attributes: ["id", "leaveName"] }],
    order: [["employee_id", "ASC"], ["from_date", "ASC"]],
});
exports.findScopedLeaves = findScopedLeaves;
const findScopedMeetings = (employeeIds, fromDate, toDate) => dbConnection_1.Meeting.findAll({
    where: {
        userId: { [sequelize_1.Op.in]: employeeIds },
        scheduledTime: { [sequelize_1.Op.between]: [fromDate, toDate] },
    },
    order: [["userId", "ASC"], ["scheduledTime", "ASC"]],
});
exports.findScopedMeetings = findScopedMeetings;
const findScopedTasks = (employeeIds, fromDate, toDate) => dbConnection_1.Task.findAll({
    where: {
        [sequelize_1.Op.or]: [
            { assignedTo: { [sequelize_1.Op.in]: employeeIds } },
            { assignedBy: { [sequelize_1.Op.in]: employeeIds } },
        ],
        createdAt: { [sequelize_1.Op.between]: [fromDate, toDate] },
    },
    order: [["assignedTo", "ASC"], ["createdAt", "ASC"]],
});
exports.findScopedTasks = findScopedTasks;
// Expense.date is a free-text string field (no fixed format enforced at
// creation) — filtered by parsed date in the service layer instead of a SQL
// range, same "date || createdAt" fallback the ExpenseManagement.jsx UI
// already relies on.
const findScopedExpenses = (employeeIds) => dbConnection_1.Expense.findAll({
    where: { userId: { [sequelize_1.Op.in]: employeeIds } },
    order: [["userId", "ASC"], ["id", "ASC"]],
});
exports.findScopedExpenses = findScopedExpenses;
// Quotations/Invoices: company-wide by default; restricted to `employeeIds`
// (the creating userId) only for a manager's own-team scoping — see
// reports.service.ts. Read-only, attributes-limited — never touches the
// frozen quotation/invoice controllers or the `invoice`/`quotation` JSON
// payload column itself.
const findScopedQuotations = (companyId, employeeIds, fromDate, toDate) => dbConnection_1.Quotations.findAll({
    where: Object.assign(Object.assign({ companyId }, (employeeIds ? { userId: { [sequelize_1.Op.in]: employeeIds } } : {})), { createdAt: { [sequelize_1.Op.between]: [fromDate, toDate] } }),
    attributes: ["id", "userId", "status", "quotationNumber", "referenceNumber", "customerName", "isConsumed", "createdAt"],
    order: [["createdAt", "DESC"]],
});
exports.findScopedQuotations = findScopedQuotations;
const findScopedInvoices = (companyId, employeeIds, fromDate, toDate) => dbConnection_1.Invoices.findAll({
    where: Object.assign(Object.assign({ companyId }, (employeeIds ? { userId: { [sequelize_1.Op.in]: employeeIds } } : {})), { createdAt: { [sequelize_1.Op.between]: [fromDate, toDate] } }),
    attributes: ["id", "userId", "status", "invoiceNumber", "customerName", "quotationNumber", "invoiceDate", "createdAt"],
    order: [["createdAt", "DESC"]],
});
exports.findScopedInvoices = findScopedInvoices;
