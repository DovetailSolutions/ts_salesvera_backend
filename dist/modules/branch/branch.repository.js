"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBranches = exports.findBranchOwnedBy = exports.createBranch = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const createBranch = (row) => dbConnection_1.Branch.create(row);
exports.createBranch = createBranch;
const findBranchOwnedBy = (id, userId) => dbConnection_1.Branch.findOne({ where: { id, userId } });
exports.findBranchOwnedBy = findBranchOwnedBy;
const findBranches = (params) => {
    // FIX: previously scoped ownership only (userId/adminId/managerId), never
    // companyId — so a tenant owner with more than one company saw every
    // company's branches mixed together in one list. Also, adminId/managerId
    // are never actually populated on a Branch row at creation time (only
    // userId, always the tenant owner) — so this same ownership check
    // silently matched *nothing* for an admin/manager looking at their own
    // company's branches. When companyId is given, the caller's access to it
    // has already been verified by the service layer (see
    // shared/companyAccess.ts) — scope by companyId alone, which is always
    // reliably set, instead of the unreliable per-row ownership stamps.
    // Fall back to the legacy ownership-only check only when no companyId is
    // supplied at all.
    let where;
    if (params.companyId) {
        where = { companyId: params.companyId };
    }
    else {
        where = { [sequelize_1.Op.or]: [{ userId: params.userId }, { adminId: params.userId }, { managerId: params.userId }] };
    }
    if (params.search) {
        const searchClause = {
            [sequelize_1.Op.or]: [
                { branchName: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { branchCode: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { branchCity: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { branchState: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { branchCountry: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { postalCode: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { addressLine1: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { addressLine2: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { branchEmail: { [sequelize_1.Op.like]: `%${params.search}%` } },
                { branchPhone: { [sequelize_1.Op.like]: `%${params.search}%` } },
            ],
        };
        where = { [sequelize_1.Op.and]: [where, searchClause] };
    }
    return dbConnection_1.Branch.findAndCountAll({
        attributes: ["id", "branchName", "branchCode", "branchCity", "branchState", "branchCountry", "postalCode", "addressLine1", "branchEmail", "branchPhone", "latitude", "longitude", "geoRadius", "companyId", "createdAt"],
        where,
        limit: params.limit,
        offset: params.offset,
        order: [["createdAt", "DESC"]],
    });
};
exports.findBranches = findBranches;
