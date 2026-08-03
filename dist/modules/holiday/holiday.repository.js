"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findHolidays = exports.findHolidayOwnedBy = exports.bulkCreateHolidays = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const bulkCreateHolidays = (rows) => dbConnection_1.Holiday.bulkCreate(rows);
exports.bulkCreateHolidays = bulkCreateHolidays;
const findHolidayOwnedBy = (id, userId) => dbConnection_1.Holiday.findOne({ where: { id, userId } });
exports.findHolidayOwnedBy = findHolidayOwnedBy;
const findHolidays = (params) => {
    // FIX: Holiday rows are only ever stamped with the tenant "user"'s id at
    // creation — admin/managerId are never populated — so scoping by userId
    // alone matched nothing for an admin/manager viewing their own company's
    // holidays (this is why the holiday calendar appeared completely broken
    // for admin/manager accounts), while a "user" who owns multiple companies
    // matched every holiday across all of them. When companyId is given, the
    // caller's access to it has already been verified by the service layer
    // (see shared/companyAccess.ts) — scope by companyId alone. Fall back to
    // the legacy userId-only check only when no companyId is supplied.
    const where = params.companyId ? { companyId: params.companyId } : { userId: params.userId };
    if (params.search) {
        where[sequelize_1.Op.or] = [
            { holidayName: { [sequelize_1.Op.like]: `%${params.search}%` } },
            { holidayType: { [sequelize_1.Op.like]: `%${params.search}%` } },
        ];
    }
    if (params.branchId)
        where.branchId = params.branchId;
    return dbConnection_1.Holiday.findAndCountAll({
        where,
        limit: params.limit,
        offset: params.offset,
        order: [["createdAt", "DESC"]],
    });
};
exports.findHolidays = findHolidays;
