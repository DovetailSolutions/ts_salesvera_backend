import { Op } from "sequelize";
import { Branch, Company, CompanyAdmin, User } from "../../config/dbConnection";
import { resolveDefaultBranchAndShift } from "./companyAccess";

// ============================================================
// Branch visibility when a company is connected to Tally.
//
//   Connected to Tally  → employees and managers see ONLY the company's main
//                         branch (profile branch list and the mobile
//                         /api/getbranch lists), whatever the per-user
//                         "Branch List" toggle says.
//   Not connected       → unchanged: the admin's per-user toggle
//                         (users.canViewAllBranches) decides, as before.
//
// "Connected" = the company's primary admin, an additional admin
// (CompanyAdmin) or its owner has a Tally company GUID saved
// (users.tallyGuid — set when Tally is connected, tally:connect).
// "Main branch" = the same head branch new users default to
// (resolveDefaultBranchAndShift: a branch named head/main/HO, else the first
// one registered). The toggle values themselves are never changed, so the
// admin's choices apply again if Tally is disconnected.
// ============================================================

export interface TallyBranchLock {
  companyId: number;
  tallyConnected: boolean;
  mainBranch: { id: number; branchName: string | null; branchCode: string | null } | null;
}

export const getTallyBranchLock = async (companyId: number | null | undefined): Promise<TallyBranchLock | null> => {
  if (!companyId) return null;
  const company: any = await Company.findByPk(Number(companyId), { attributes: ["id", "adminId", "userId"] });
  if (!company) return null;

  const links: any[] = await (CompanyAdmin as any).findAll({ where: { companyId: Number(companyId) }, attributes: ["adminId"] });
  const ownerIds = [company.adminId, company.userId, ...links.map((l: any) => l.adminId)]
    .filter((id: any) => id != null)
    .map(Number);

  const connectedCount = ownerIds.length
    ? await User.count({
        where: { id: { [Op.in]: ownerIds }, tallyGuid: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] } } as any,
      })
    : 0;

  let mainBranch: TallyBranchLock["mainBranch"] = null;
  if (connectedCount > 0) {
    const { branchId } = await resolveDefaultBranchAndShift(Number(companyId));
    if (branchId) {
      const b: any = await Branch.findByPk(branchId, { attributes: ["id", "branchName", "branchCode"] });
      if (b) mainBranch = { id: Number(b.id), branchName: b.branchName ?? null, branchCode: b.branchCode ?? null };
    }
  }

  return { companyId: Number(companyId), tallyConnected: connectedCount > 0, mainBranch };
};

/** Roles whose branch lists the Tally rule restricts (admins/owners manage branches and see all). */
export const TALLY_LOCKED_ROLES = ["employee", "manager"];
