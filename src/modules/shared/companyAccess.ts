import { Op } from "sequelize";
import { Company, CompanyManager, CompanyAdmin, Branch, Shift } from "../../config/dbConnection";

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
export async function hasCompanyAccess(companyId: number, callerId: number, callerRole?: string): Promise<boolean> {
  // super_admin sits above the whole tenant tree (this is what
  // CompanyManagement.jsx relies on — a super_admin editing any company in
  // the system, not just ones they personally own/administer/manage).
  if (callerRole === "super_admin") return true;

  const company = await (Company as any).findOne({
    where: { id: companyId, [Op.or]: [{ userId: callerId }, { adminId: callerId }] },
    attributes: ["id"],
  });
  if (company) return true;

  const adminLink = await (CompanyAdmin as any).findOne({
    where: { companyId, adminId: callerId },
    attributes: ["id"],
  });
  if (adminLink) return true;

  const managerLink = await (CompanyManager as any).findOne({
    where: { companyId, managerId: callerId },
    attributes: ["id"],
  });
  if (managerLink) return true;

  return false;
}

// An employee created with no explicit branch/shift falls back to the
// company's "main" branch (its first-ever registered branch, by id — there's
// no separate isMain/isHeadOffice flag on Branch) and its first-ever
// registered shift, instead of staying unassigned. Returns nulls (not an
// error) when the company has no branches/shifts yet — e.g. the very first
// user created during company registration, before Step 1/3 have run.
export async function resolveDefaultBranchAndShift(
  companyId: number | null
): Promise<{ branchId: number | null; shiftId: number | null }> {
  if (!companyId) return { branchId: null, shiftId: null };

  const [mainBranch, firstShift] = await Promise.all([
    (Branch as any).findOne({ where: { companyId }, order: [["id", "ASC"]], attributes: ["id"] }),
    (Shift as any).findOne({ where: { companyId }, order: [["id", "ASC"]], attributes: ["id"] }),
  ]);

  return {
    branchId: mainBranch ? mainBranch.id : null,
    shiftId: firstShift ? firstShift.id : null,
  };
}
