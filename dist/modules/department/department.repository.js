"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findDepartments = exports.findDepartmentById = exports.createDepartment = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const createDepartment = (row) => dbConnection_1.Department.create(row);
exports.createDepartment = createDepartment;
// Plain lookup by id — access is checked separately in the service layer
// via hasCompanyAccess (see assertDepartmentAccess), the same
// company-scoped check listDepartments already uses. The old
// findDepartmentOwnedBy(id, userId) filtered `WHERE id = ? AND userId = ?`
// directly in SQL — but Department.userId is only ever stamped with the
// tenant "user" who originally created the row (never admin/managerId), so
// any admin/manager updating or fetching-by-id a department they didn't
// personally create got "Department not found" even though it's their own
// company's department and shows up fine in their department list.
const findDepartmentById = (id) => dbConnection_1.Department.findByPk(id);
exports.findDepartmentById = findDepartmentById;
const findDepartments = (params) => {
    // FIX: Department rows are only ever stamped with the tenant "user"'s id
    // at creation — admin/managerId are never populated — so scoping by
    // userId alone matched nothing for an admin/manager viewing their own
    // company's departments, while a "user" who owns multiple companies
    // matched every department across all of them. When companyId is given,
    // the caller's access to it has already been verified by the service
    // layer (see shared/companyAccess.ts) — scope by companyId alone. Fall
    // back to the legacy userId-only check only when no companyId is supplied.
    const where = params.companyId ? { companyId: params.companyId } : { userId: params.userId };
    if (params.search) {
        where[sequelize_1.Op.or] = [
            { deptName: { [sequelize_1.Op.like]: `%${params.search}%` } },
            { deptCode: { [sequelize_1.Op.like]: `%${params.search}%` } },
        ];
    }
    if (params.branchId)
        where.branchId = params.branchId;
    return dbConnection_1.Department.findAndCountAll({
        attributes: ["id", "deptName", "deptCode", "deptHead", "branchId", "shiftId", "maxHeadcount", "companyId", "createdAt"],
        where,
        limit: params.limit,
        offset: params.offset,
        order: [["createdAt", "DESC"]],
    });
};
exports.findDepartments = findDepartments;
