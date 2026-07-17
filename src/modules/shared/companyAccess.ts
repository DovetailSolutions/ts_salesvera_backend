import { Op } from "sequelize";
import { Company, CompanyManager, CompanyAdmin } from "../../config/dbConnection";

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
