"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCompanyById = exports.findShifts = exports.findShiftOwnedBy = exports.createShift = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const createShift = (row) => dbConnection_1.Shift.create(row);
exports.createShift = createShift;
const findShiftOwnedBy = (id, userId) => dbConnection_1.Shift.findOne({ where: { id, userId } });
exports.findShiftOwnedBy = findShiftOwnedBy;
const findShifts = (params) => {
    // FIX: Shift rows are only ever stamped with the tenant "user"'s id at
    // creation — admin/managerId are never populated — so scoping by userId
    // alone matched nothing for an admin/manager viewing their own company's
    // shifts, while a "user" who owns multiple companies matched every shift
    // across all of them. When companyId is given, the caller's access to it
    // has already been verified by the service layer (see
    // shared/companyAccess.ts) — scope by companyId alone. Fall back to the
    // legacy userId-only check only when no companyId is supplied.
    const where = params.companyId ? { companyId: params.companyId } : { userId: params.userId };
    if (params.search) {
        where[sequelize_1.Op.or] = [
            { shiftName: { [sequelize_1.Op.like]: `%${params.search}%` } },
            { shiftCode: { [sequelize_1.Op.like]: `%${params.search}%` } },
        ];
    }
    if (params.branchId)
        where.branchId = params.branchId;
    return dbConnection_1.Shift.findAndCountAll({
        attributes: ["id", "shiftName", "shiftCode", "startTime", "endTime", "fullDayHours", "nightShift", "breakMinutes", "workingHours", "lateMarkAfter", "halfDayAfter", "branchId", "companyId", "createdAt"],
        where,
        limit: params.limit,
        offset: params.offset,
        order: [["createdAt", "DESC"]],
    });
};
exports.findShifts = findShifts;
const findCompanyById = (id) => dbConnection_1.Company.findByPk(id);
exports.findCompanyById = findCompanyById;
