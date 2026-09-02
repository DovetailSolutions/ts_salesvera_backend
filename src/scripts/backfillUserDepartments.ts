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

import dotenv from "dotenv";
dotenv.config();

import { sequelize, User, Company, CompanyAdmin, CompanyManager, Branch, Department } from "../config/dbConnection";
import { Op } from "sequelize";

async function resolveCompanyId(user: any, companyByAdminId: Map<number, number>, companyByUserId: Map<number, number>, companyAdminLinks: Map<number, number>, companyManagerLinks: Map<number, number>, branchToCompany: Map<number, number>): Promise<number | null> {
  if (companyByAdminId.has(user.id)) return companyByAdminId.get(user.id)!;
  if (companyAdminLinks.has(user.id)) return companyAdminLinks.get(user.id)!;
  if (companyManagerLinks.has(user.id)) return companyManagerLinks.get(user.id)!;
  if (user.branchId && branchToCompany.has(user.branchId)) return branchToCompany.get(user.branchId)!;
  if (companyByUserId.has(user.id)) return companyByUserId.get(user.id)!;
  return null;
}

async function backfill() {
  const dryRun = process.argv.includes("--dry-run");

  await sequelize.authenticate();
  console.log(`Connected to database.${dryRun ? " (DRY RUN — no writes will be made)" : ""}\n`);

  const usersWithoutDept = (await User.findAll({
    where: { departmentId: null },
    attributes: ["id", "email", "role", "branchId"],
  })) as any[];

  if (usersWithoutDept.length === 0) {
    console.log("✅ Every user already has a department assigned. Nothing to do.");
    await sequelize.close();
    return;
  }

  console.log(`Found ${usersWithoutDept.length} user(s) without a department.\n`);

  // ── Preload lookup tables once, instead of querying per user ──
  const [companies, companyAdmins, companyManagers, branches, departments] = await Promise.all([
    Company.findAll({ attributes: ["id", "adminId", "userId"] }) as unknown as any[],
    CompanyAdmin.findAll({ attributes: ["companyId", "adminId"] }) as unknown as any[],
    CompanyManager.findAll({ attributes: ["companyId", "managerId"] }) as unknown as any[],
    Branch.findAll({ attributes: ["id", "companyId"] }) as unknown as any[],
    Department.findAll({ attributes: ["id", "companyId"], order: [["id", "ASC"]] }) as unknown as any[],
  ]);

  const companyByAdminId = new Map<number, number>();
  const companyByUserId = new Map<number, number>();
  companies.forEach((c: any) => {
    if (c.adminId) companyByAdminId.set(Number(c.adminId), Number(c.id));
    if (c.userId) companyByUserId.set(Number(c.userId), Number(c.id));
  });

  const companyAdminLinks = new Map<number, number>();
  companyAdmins.forEach((a: any) => companyAdminLinks.set(Number(a.adminId), Number(a.companyId)));

  const companyManagerLinks = new Map<number, number>();
  companyManagers.forEach((m: any) => companyManagerLinks.set(Number(m.managerId), Number(m.companyId)));

  const branchToCompany = new Map<number, number>();
  branches.forEach((b: any) => branchToCompany.set(Number(b.id), Number(b.companyId)));

  // First-registered department per company (lowest id).
  const firstDeptByCompany = new Map<number, number>();
  departments.forEach((d: any) => {
    if (!d.companyId) return;
    const key = Number(d.companyId);
    if (!firstDeptByCompany.has(key)) firstDeptByCompany.set(key, Number(d.id));
  });

  let updated = 0;
  const noCompany: any[] = [];
  const noDepartment: any[] = [];

  for (const user of usersWithoutDept) {
    const companyId = await resolveCompanyId(user, companyByAdminId, companyByUserId, companyAdminLinks, companyManagerLinks, branchToCompany);

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
      await User.update({ departmentId }, { where: { id: user.id } });
    }
    console.log(`   ${dryRun ? "[dry-run] would set" : "set"} user id=${user.id} email=${user.email} -> departmentId=${departmentId} (companyId=${companyId})`);
    updated++;
  }

  console.log(`\n✅ ${dryRun ? "Would assign" : "Assigned"} a department to ${updated} user(s).\n`);

  if (noCompany.length > 0) {
    console.warn(`⚠️  ${noCompany.length} user(s) could not be linked to any company (left untouched):`);
    noCompany.forEach((u: any) => console.warn(`   id=${u.id} role=${u.role} email=${u.email}`));
    console.warn("");
  }

  if (noDepartment.length > 0) {
    console.warn(`⚠️  ${noDepartment.length} user(s) belong to a company with no department yet (left untouched):`);
    noDepartment.forEach((u: any) => console.warn(`   id=${u.id} role=${u.role} email=${u.email} companyId=${u.companyId}`));
    console.warn("");
  }

  await sequelize.close();
  console.log("Backfill complete.");
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
