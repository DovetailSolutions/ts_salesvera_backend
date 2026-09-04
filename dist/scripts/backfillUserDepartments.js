"use strict";
/**
 * One-time backfill: assign an existing department to every user who
 * doesn't have one yet (users.departmentId IS NULL).
 *
 * Run once with:
 *   npx ts-node src/scripts/backfillUserDepartments.ts
 *
 * Preview first (no writes) with:
 *   npx ts-node src/scripts/backfillUserDepartments.ts --dry-run
 *
 * Safe to re-run — only touches users whose departmentId is still NULL;
 * anyone who already has a department (added themselves, via the app) is
 * left untouched.
 *
 * A user isn't stamped with companyId directly, so it's resolved the same
 * way hasCompanyAccess() does it (src/modules/shared/companyAccess.ts),
 * checked in this priority order:
 *   1. Company.adminId === user.id       (primary admin/owner of a company)
 *   2. CompanyAdmin.adminId === user.id  (additional admin)
 *   3. CompanyManager.managerId === user.id (manager)
 *   4. Branch(user.branchId).companyId   (employee assigned to a branch)
 *   5. Company.userId === user.id        (legacy tenant-owner field)
 *
 * Once a companyId is resolved, the user is assigned that company's
 * first-registered department (lowest id). Users whose companyId can't be
 * resolved, or whose company has no department yet, are left alone and
 * reported at the end — nothing is fabricated for them.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbConnection_1 = require("../config/dbConnection");
function resolveCompanyId(user, companyByAdminId, companyByUserId, companyAdminLinks, companyManagerLinks, branchToCompany) {
    return __awaiter(this, void 0, void 0, function* () {
        if (companyByAdminId.has(user.id))
            return companyByAdminId.get(user.id);
        if (companyAdminLinks.has(user.id))
            return companyAdminLinks.get(user.id);
        if (companyManagerLinks.has(user.id))
            return companyManagerLinks.get(user.id);
        if (user.branchId && branchToCompany.has(user.branchId))
            return branchToCompany.get(user.branchId);
        if (companyByUserId.has(user.id))
            return companyByUserId.get(user.id);
        return null;
    });
}
function backfill() {
    return __awaiter(this, void 0, void 0, function* () {
        const dryRun = process.argv.includes("--dry-run");
        yield dbConnection_1.sequelize.authenticate();
        console.log(`Connected to database.${dryRun ? " (DRY RUN — no writes will be made)" : ""}\n`);
        const usersWithoutDept = (yield dbConnection_1.User.findAll({
            where: { departmentId: null },
            attributes: ["id", "email", "role", "branchId"],
        }));
        if (usersWithoutDept.length === 0) {
            console.log("✅ Every user already has a department assigned. Nothing to do.");
            yield dbConnection_1.sequelize.close();
            return;
        }
        console.log(`Found ${usersWithoutDept.length} user(s) without a department.\n`);
        // ── Preload lookup tables once, instead of querying per user ──
        const [companies, companyAdmins, companyManagers, branches, departments] = yield Promise.all([
            dbConnection_1.Company.findAll({ attributes: ["id", "adminId", "userId"] }),
            dbConnection_1.CompanyAdmin.findAll({ attributes: ["companyId", "adminId"] }),
            dbConnection_1.CompanyManager.findAll({ attributes: ["companyId", "managerId"] }),
            dbConnection_1.Branch.findAll({ attributes: ["id", "companyId"] }),
            dbConnection_1.Department.findAll({ attributes: ["id", "companyId"], order: [["id", "ASC"]] }),
        ]);
        const companyByAdminId = new Map();
        const companyByUserId = new Map();
        companies.forEach((c) => {
            if (c.adminId)
                companyByAdminId.set(Number(c.adminId), Number(c.id));
            if (c.userId)
                companyByUserId.set(Number(c.userId), Number(c.id));
        });
        const companyAdminLinks = new Map();
        companyAdmins.forEach((a) => companyAdminLinks.set(Number(a.adminId), Number(a.companyId)));
        const companyManagerLinks = new Map();
        companyManagers.forEach((m) => companyManagerLinks.set(Number(m.managerId), Number(m.companyId)));
        const branchToCompany = new Map();
        branches.forEach((b) => branchToCompany.set(Number(b.id), Number(b.companyId)));
        // First-registered department per company (lowest id).
        const firstDeptByCompany = new Map();
        departments.forEach((d) => {
            if (!d.companyId)
                return;
            const key = Number(d.companyId);
            if (!firstDeptByCompany.has(key))
                firstDeptByCompany.set(key, Number(d.id));
        });
        let updated = 0;
        const noCompany = [];
        const noDepartment = [];
        for (const user of usersWithoutDept) {
            const companyId = yield resolveCompanyId(user, companyByAdminId, companyByUserId, companyAdminLinks, companyManagerLinks, branchToCompany);
            if (!companyId) {
                noCompany.push(user);
                continue;
            }
            const departmentId = firstDeptByCompany.get(companyId);
            if (!departmentId) {
                noDepartment.push({ id: user.id, role: user.role, email: user.email, companyId });
                continue;
            }
            if (!dryRun) {
                yield dbConnection_1.User.update({ departmentId }, { where: { id: user.id } });
            }
            console.log(`   ${dryRun ? "[dry-run] would set" : "set"} user id=${user.id} email=${user.email} -> departmentId=${departmentId} (companyId=${companyId})`);
            updated++;
        }
        console.log(`\n✅ ${dryRun ? "Would assign" : "Assigned"} a department to ${updated} user(s).\n`);
        if (noCompany.length > 0) {
            console.warn(`⚠️  ${noCompany.length} user(s) could not be linked to any company (left untouched):`);
            noCompany.forEach((u) => console.warn(`   id=${u.id} role=${u.role} email=${u.email}`));
            console.warn("");
        }
        if (noDepartment.length > 0) {
            console.warn(`⚠️  ${noDepartment.length} user(s) belong to a company with no department yet (left untouched):`);
            noDepartment.forEach((u) => console.warn(`   id=${u.id} role=${u.role} email=${u.email} companyId=${u.companyId}`));
            console.warn("");
        }
        yield dbConnection_1.sequelize.close();
        console.log("Backfill complete.");
    });
}
backfill().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
