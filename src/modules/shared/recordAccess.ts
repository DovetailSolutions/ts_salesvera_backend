import { JwtPayload } from "jsonwebtoken";
import { getCompanyScopedChildUserIdsFast } from "./userHierarchy";

// ============================================================
// Ownership check for single-record endpoints that load a row by id
// (quotations, record sales, ...). A caller may act on a record owned by
// themselves or by anyone in their company-scoped team below them — the
// same rule the corresponding LIST endpoints already use (e.g. the
// quotation list walks caller + recursive team), so a record reachable by
// id is exactly a record the caller could already see in its list.
// super_admin is unrestricted, as everywhere else.
//
// Callers should answer a failed check exactly like "not found", so ids
// can't be probed for existence across teams/companies.
// ============================================================
export async function canAccessOwnedRecord(
  userData: JwtPayload | undefined,
  ownerId: number | string | null | undefined
): Promise<boolean> {
  if (!userData?.userId) return false;
  if (userData.role === "super_admin") return true;
  if (ownerId === null || ownerId === undefined) return false;

  const callerId = Number(userData.userId);
  const owner = Number(ownerId);
  if (owner === callerId) return true;

  const companyId = userData.companyId != null ? Number(userData.companyId) : null;
  const teamIds = await getCompanyScopedChildUserIdsFast(callerId, companyId);
  return teamIds.includes(owner);
}
