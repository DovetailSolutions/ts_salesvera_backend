import { Company, CompanyAdmin } from "../../config/dbConnection";

// ============================================================
// Company of a team's root — the user at the top of an employee/manager's
// "created by" chain. Used wherever an employee's company is worked out by
// walking up that chain (tokenCheck, login, profile).
//
// FIX: those walks used to look ONLY at Company.adminId (the company's
// primary admin). An admin linked to the company through the CompanyAdmin
// junction (POST /admin/assign-company-admin) — or a company whose adminId
// was never set (Register Company leaves it null) — resolved to no company,
// so every employee under that admin got "No active company is associated
// with your account" / "No company context". A chain that ends at the
// tenant owner (role "user", e.g. an employee the owner created directly)
// also resolved to nothing, because the walk only stopped at admins.
//
// Resolution order (first match wins, lowest company id for determinism):
//   1. primary admin   → Company.adminId
//   2. assigned admin  → CompanyAdmin junction
//   3. tenant owner    → Company.userId
// ============================================================

/** Roles at which a "created by" walk stops: the root of a company team. */
export const isTeamRootRole = (role: string | null | undefined) =>
  role === "admin" || role === "user" || role === "super_admin";

export const findRootCompanyId = async (rootUserId: number | null | undefined): Promise<number | null> => {
  if (!rootUserId) return null;
  const id = Number(rootUserId);

  const primary: any = await (Company as any).findOne({
    where: { adminId: id },
    attributes: ["id"],
    order: [["id", "ASC"]],
  });
  if (primary) return Number(primary.id);

  const assignment: any = await (CompanyAdmin as any).findOne({
    where: { adminId: id },
    attributes: ["companyId"],
    order: [["companyId", "ASC"]],
  });
  if (assignment) return Number(assignment.companyId);

  const owned: any = await (Company as any).findOne({
    where: { userId: id },
    attributes: ["id"],
    order: [["id", "ASC"]],
  });
  return owned ? Number(owned.id) : null;
};
