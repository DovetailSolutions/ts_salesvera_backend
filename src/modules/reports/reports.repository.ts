import { Op } from "sequelize";
import { User, Attendance, Leave, Meeting, CompanyLeave } from "../../config/dbConnection";

// ============================================================
// Reports repository — raw record fetches for the Download Reports
// (Insights) module. All three domains are scoped by the same
// pre-resolved `employeeIds` list (see reports.service.ts) so a manager's
// report and an admin's/owner's report use identical query shapes, just
// over a different-sized employee set.
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
