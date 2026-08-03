"use strict";
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
exports.hasCompanyAccess = hasCompanyAccess;
exports.resolveDefaultBranchAndShift = resolveDefaultBranchAndShift;
exports.resolveCompanyEmployeeIds = resolveCompanyEmployeeIds;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
// Verifies the caller actually has a legitimate relationship to this
// company — tenant owner, primary admin (Company.adminId), an additional
// admin via the CompanyAdmin junction, or an assigned manager via the
// CompanyManager junction.
//
// Exists because Branch/Shift/Department/Holiday rows are only ever
// stamped with the tenant "user"'s id at creation (userId: <tenant owner>)
// — admin/managerId are never populated — so the old per-row ownership
// check (`where: { userId: callerId }`) silently matched nothing for an
// admin or manager viewing their own company's data, while a "user" who
// owns multiple companies matched every row across all of them (the
// reported cross-company leakage). Company access should be verified once
// here, then the resource list queried by companyId alone — companyId is
// always reliably set, unlike the per-row ownership stamps.
function hasCompanyAccess(companyId, callerId, callerRole) {
    return __awaiter(this, void 0, void 0, function* () {
        // super_admin sits above the whole tenant tree (this is what
        // CompanyManagement.jsx relies on — a super_admin editing any company in
        // the system, not just ones they personally own/administer/manage).
        if (callerRole === "super_admin")
            return true;
        const company = yield dbConnection_1.Company.findOne({
            where: { id: companyId, [sequelize_1.Op.or]: [{ userId: callerId }, { adminId: callerId }] },
            attributes: ["id"],
        });
        if (company)
            return true;
        const adminLink = yield dbConnection_1.CompanyAdmin.findOne({
            where: { companyId, adminId: callerId },
            attributes: ["id"],
        });
        if (adminLink)
            return true;
        const managerLink = yield dbConnection_1.CompanyManager.findOne({
            where: { companyId, managerId: callerId },
            attributes: ["id"],
        });
        if (managerLink)
            return true;
        return false;
    });
}
// An employee created with no explicit branch/shift falls back to the
// company's "main" branch (its first-ever registered branch, by id — there's
// no separate isMain/isHeadOffice flag on Branch) and its first-ever
// registered shift, instead of staying unassigned. Returns nulls (not an
// error) when the company has no branches/shifts yet — e.g. the very first
// user created during company registration, before Step 1/3 have run.
function resolveDefaultBranchAndShift(companyId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!companyId)
            return { branchId: null, shiftId: null };
        const [mainBranch, firstShift] = yield Promise.all([
            dbConnection_1.Branch.findOne({ where: { companyId }, order: [["id", "ASC"]], attributes: ["id"] }),
            dbConnection_1.Shift.findOne({ where: { companyId }, order: [["id", "ASC"]], attributes: ["id"] }),
        ]);
        return {
            branchId: mainBranch ? mainBranch.id : null,
            shiftId: firstShift ? firstShift.id : null,
        };
    });
}
// All employees that actually belong to a company — by direct company
// association, not by who-created-whom (getAllChildUserIds walks the
// creator chain, which mixes employees from every company a "user"
// tenant-owner happens to own into one list). Used for company-wide
// reporting (Settings' Company Policy tab audience, the reports/insights
// module) where "this company's team" needs to mean exactly that.
//
// - Admins: the company's primary owner (Company.adminId) + any additional
//   admins via the CompanyAdmin junction.
// - Managers: via the CompanyManager junction.
// - Sale persons: via User.branchId — every branch is stamped with its own
//   companyId, and branchId is now reliably populated (explicit at
//   registration, or defaulted to the company's main branch — see
//   resolveDefaultBranchAndShift above) — a more direct signal of company
//   membership than walking the creator hierarchy.
function resolveCompanyEmployeeIds(companyId) {
    return __awaiter(this, void 0, void 0, function* () {
        const [company, additionalAdmins, managerLinks, branches] = yield Promise.all([
            dbConnection_1.Company.findOne({ where: { id: companyId }, attributes: ["adminId"] }),
            dbConnection_1.CompanyAdmin.findAll({ where: { companyId }, attributes: ["adminId"] }),
            dbConnection_1.CompanyManager.findAll({ where: { companyId }, attributes: ["managerId"] }),
            dbConnection_1.Branch.findAll({ where: { companyId }, attributes: ["id"] }),
        ]);
        const adminIds = Array.from(new Set([
            ...((company === null || company === void 0 ? void 0 : company.adminId) ? [Number(company.adminId)] : []),
            ...additionalAdmins.map((a) => Number(a.adminId)),
        ]));
        const managerIds = Array.from(new Set(managerLinks.map((m) => Number(m.managerId))));
        const branchIds = branches.map((b) => b.id);
        const salePersons = branchIds.length
            ? yield dbConnection_1.User.findAll({
                where: { role: "sale_person", branchId: { [sequelize_1.Op.in]: branchIds } },
                attributes: ["id"],
            })
            : [];
        const salePersonIds = salePersons.map((u) => Number(u.id));
        return {
            adminIds,
            managerIds,
            salePersonIds,
            allIds: [...adminIds, ...managerIds, ...salePersonIds],
        };
    });
}
