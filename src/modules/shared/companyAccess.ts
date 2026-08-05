import { Op } from "sequelize";
import { Company, CompanyManager, CompanyAdmin, Branch, Shift, User } from "../../config/dbConnection";

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
// Anyone who should have a branch/shift but wasn't given one explicitly is
// defaulted to the company's HEAD BRANCH and its MORNING SHIFT.
//
// Neither is a stored flag, so both are resolved by intent with a
// deterministic fallback:
//
//  - Head branch: a branch whose name/code says so ("Head Office", "HQ",
//    "Main", "Corporate"); otherwise the company's first-registered branch,
//    which in practice IS the head office — it's the one created during
//    company registration, before any satellite branches exist.
//
//  - Morning shift: a shift named "morning"; otherwise the earliest-starting
//    non-night shift (a night shift is never a sensible default, and it's
//    explicitly flagged on the model); otherwise the first-registered shift.
//    NOTE: ordering by id alone was wrong here — a company whose first
//    registered shift happens to be an evening one (real case in this data:
//    "Evening Updated" 14:00 registered before an 08:00 shift) had every new
//    employee silently defaulted onto the evening shift, which then drives
//    their late-mark and shift-window attendance gating.
const HEAD_BRANCH_PATTERN = /(head\s*office|head\s*branch|\bhq\b|\bh\.o\.?\b|\bmain\b|\bcorporate\b)/i;
const MORNING_SHIFT_PATTERN = /\bmorning\b/i;

export async function resolveDefaultBranchAndShift(
  companyId: number | null
): Promise<{ branchId: number | null; shiftId: number | null }> {
  if (!companyId) return { branchId: null, shiftId: null };

  const [branches, shifts]: [any[], any[]] = await Promise.all([
    (Branch as any).findAll({
      where: { companyId },
      order: [["id", "ASC"]],
      attributes: ["id", "branchName", "branchCode"],
    }),
    (Shift as any).findAll({
      where: { companyId },
      order: [["id", "ASC"]],
      attributes: ["id", "shiftName", "startTime", "nightShift"],
    }),
  ]);

  const headBranch =
    branches.find(
      (b: any) => HEAD_BRANCH_PATTERN.test(String(b.branchName ?? "")) || HEAD_BRANCH_PATTERN.test(String(b.branchCode ?? ""))
    ) ?? branches[0];

  const namedMorning = shifts.find((s: any) => MORNING_SHIFT_PATTERN.test(String(s.shiftName ?? "")));
  const earliestDayShift = shifts
    .filter((s: any) => !s.nightShift)
    // startTime is a TIME column ("HH:mm:ss"), so lexical order is also
    // chronological order — no Date construction (and no timezone risk).
    .sort((a: any, b: any) => String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")))[0];
  const morningShift = namedMorning ?? earliestDayShift ?? shifts[0];

  return {
    branchId: headBranch ? headBranch.id : null,
    shiftId: morningShift ? morningShift.id : null,
  };
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
export async function resolveCompanyEmployeeIds(
  companyId: number
): Promise<{ adminIds: number[]; managerIds: number[]; salePersonIds: number[]; allIds: number[] }> {
  const [company, additionalAdmins, managerLinks, branches]: [any, any[], any[], any[]] = await Promise.all([
    (Company as any).findOne({ where: { id: companyId }, attributes: ["adminId"] }),
    (CompanyAdmin as any).findAll({ where: { companyId }, attributes: ["adminId"] }),
    (CompanyManager as any).findAll({ where: { companyId }, attributes: ["managerId"] }),
    (Branch as any).findAll({ where: { companyId }, attributes: ["id"] }),
  ]);

  const adminIds: number[] = Array.from(
    new Set<number>([
      ...(company?.adminId ? [Number(company.adminId)] : []),
      ...additionalAdmins.map((a: any) => Number(a.adminId)),
    ])
  );
  const managerIds: number[] = Array.from(new Set<number>(managerLinks.map((m: any) => Number(m.managerId))));

  const branchIds: number[] = branches.map((b: any) => b.id);
  const salePersons: any[] = branchIds.length
    ? await (User as any).findAll({
        where: { role: "sale_person", branchId: { [Op.in]: branchIds } },
        attributes: ["id"],
      })
    : [];
  const salePersonIds: number[] = salePersons.map((u: any) => Number(u.id));

  return {
    adminIds,
    managerIds,
    salePersonIds,
    allIds: [...adminIds, ...managerIds, ...salePersonIds],
  };
}
