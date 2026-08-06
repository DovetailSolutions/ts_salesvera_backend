import { Op } from "sequelize";
import { User, Company, CompanyManager, CompanyAdmin, Branch, UserBranch } from "../../config/dbConnection";

type UserWithChildren = any & {
  createdUsers?: UserWithChildren[];
};

// Walks the createdBy/createdUsers self-referential chain to collect every
// user (at any depth) that the given userId created, directly or through an
// intermediate manager. Used throughout admin/leave/attendance/expense
// endpoints to scope "my team" queries — extracted verbatim from admin.ts.
export async function getAllChildUserIds(userId: number): Promise<number[]> {
  const result = new Set<number>();

  async function fetchLevel(id: number) {
    const user = (await User.findByPk(id, {
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    })) as UserWithChildren;

    if (!user?.createdUsers) return;

    for (const child of user.createdUsers) {
      if (!result.has(child.id)) {
        result.add(child.id);
        await fetchLevel(child.id);
      }
    }
  }

  await fetchLevel(userId);

  return Array.from(result);
}

// ── Company-scoped team resolution ──────────────────────────────────────
//
// getAllChildUserIds above answers "who did this user create, recursively"
// — a pure who-created-whom hierarchy with NO notion of which company any
// of those people belong to. That's the right answer for a single-company
// tenant, but it silently leaks across companies the moment an admin or
// manager is assigned to more than one (a supported, real scenario via the
// CompanyAdmin/CompanyManager junctions + switch-company): the caller keeps
// seeing every person they ever created, including employees of a company
// they aren't currently acting in.
//
// resolveCompanyEmployeeIds (companyAccess.ts) answers the complementary
// question — "who belongs to THIS company" — but can't be used on its own
// for team scoping either: it resolves sale_persons purely via
// User.branchId, and branchId is not reliably populated on older accounts
// (verified: a large share of existing users have branchId = null). Hard-
// intersecting with it would silently HIDE those legitimate team members.
//
// So this helper deliberately fails OPEN, not closed: it removes only the
// users it can POSITIVELY prove belong to a different company, and keeps
// anyone whose company membership is indeterminate. That fixes the real
// leak (people demonstrably in another company) without breaking access to
// anyone whose data is merely incomplete.
//
// A user's company membership is collected from every available signal —
// their branch's companyId, the CompanyManager/CompanyAdmin junctions, and
// Company.adminId/Company.userId ownership. A user legitimately linked to
// several companies (e.g. a manager assigned to two) stays visible in each
// of them.
const collectUserCompanyIds = async (
  userIds: number[],
  // Cycle/runaway guard for the creator-chain fallback below. A malformed
  // creator loop in the data (A created B, B created A) would otherwise
  // recurse forever; `visited` makes each account resolvable at most once
  // per top-level call, and the depth cap bounds a pathologically deep tree.
  visited: Set<number> = new Set<number>(),
  depth = 0
): Promise<Map<number, Set<number>>> => {
  const map = new Map<number, Set<number>>();
  if (userIds.length === 0 || depth > 10) return map;
  userIds.forEach((id) => visited.add(Number(id)));

  const add = (userId: number, companyId: number | null | undefined) => {
    if (companyId == null) return;
    if (!map.has(userId)) map.set(userId, new Set<number>());
    map.get(userId)!.add(Number(companyId));
  };

  const [users, managerLinks, adminLinks, ownedOrAdminedCompanies] = await Promise.all([
    (User as any).findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "branchId"] }),
    (CompanyManager as any).findAll({ where: { managerId: { [Op.in]: userIds } }, attributes: ["managerId", "companyId"] }),
    (CompanyAdmin as any).findAll({ where: { adminId: { [Op.in]: userIds } }, attributes: ["adminId", "companyId"] }),
    (Company as any).findAll({
      where: { [Op.or]: [{ adminId: { [Op.in]: userIds } }, { userId: { [Op.in]: userIds } }] },
      attributes: ["id", "adminId", "userId"],
    }),
  ]);

  // Branch membership (the primary signal for sale_persons).
  const branchIds = Array.from(
    new Set(users.map((u: any) => u.branchId).filter((b: any) => b != null).map((b: any) => Number(b)))
  );
  const branches: any[] = branchIds.length
    ? await (Branch as any).findAll({ where: { id: { [Op.in]: branchIds } }, attributes: ["id", "companyId"] })
    : [];
  const companyIdByBranch = new Map<number, number | null>(
    branches.map((b: any) => [Number(b.id), b.companyId == null ? null : Number(b.companyId)])
  );
  users.forEach((u: any) => {
    if (u.branchId == null) return;
    add(Number(u.id), companyIdByBranch.get(Number(u.branchId)) ?? null);
  });

  // Additional branches from the multi-branch allocation junction — an
  // admin/manager may hold several branches (User.branchId only records
  // their primary one), and each of those branches implies membership of
  // its company. Without this, allocating a second branch would leave the
  // user unable to see that branch's company data.
  const allocated: any[] = await (UserBranch as any).findAll({
    where: { userId: { [Op.in]: userIds } },
    attributes: ["userId", "branchId"],
  });
  if (allocated.length > 0) {
    const extraBranchIds = Array.from(
      new Set(allocated.map((r: any) => Number(r.branchId)).filter((b) => !companyIdByBranch.has(b)))
    );
    if (extraBranchIds.length > 0) {
      const extraBranches: any[] = await (Branch as any).findAll({
        where: { id: { [Op.in]: extraBranchIds } },
        attributes: ["id", "companyId"],
      });
      extraBranches.forEach((b: any) =>
        companyIdByBranch.set(Number(b.id), b.companyId == null ? null : Number(b.companyId))
      );
    }
    allocated.forEach((r: any) => add(Number(r.userId), companyIdByBranch.get(Number(r.branchId)) ?? null));
  }

  managerLinks.forEach((r: any) => add(Number(r.managerId), r.companyId));
  adminLinks.forEach((r: any) => add(Number(r.adminId), r.companyId));
  ownedOrAdminedCompanies.forEach((c: any) => {
    if (c.adminId != null) add(Number(c.adminId), c.id);
    if (c.userId != null) add(Number(c.userId), c.id);
  });

  // ── Fallback: inherit the company from whoever created them ──────────
  // branchId is the primary company signal for a sale_person, but it is
  // only reliably populated on accounts created after it started being
  // defaulted at registration — a large share of existing accounts still
  // have branchId = null and no junction row of their own, leaving their
  // company genuinely indeterminate above. Since every account is created
  // BY somebody who does have a resolvable company, walking one step up
  // the creator chain recovers it: an employee belongs to whatever company
  // their creator belongs to.
  //
  // Only applied when the creator resolves to EXACTLY ONE company. If the
  // creator is themselves multi-company (e.g. a manager assigned to two),
  // the employee's company is genuinely ambiguous from the data alone, so
  // we leave them indeterminate and keep failing open rather than guessing
  // and hiding a legitimate team member.
  const stillUnresolved = userIds.filter((id) => !map.has(id) || map.get(id)!.size === 0);
  if (stillUnresolved.length > 0) {
    const creatorRows: any[] = await (User as any).findAll({
      where: { id: { [Op.in]: stillUnresolved } },
      attributes: ["id"],
      include: [{ model: User, as: "creators", attributes: ["id"], through: { attributes: [] } }],
    });

    const creatorIdByUser = new Map<number, number>();
    creatorRows.forEach((row: any) => {
      const plain = row.get ? row.get({ plain: true }) : row;
      const creatorId = plain?.creators?.[0]?.id;
      if (creatorId != null) creatorIdByUser.set(Number(plain.id), Number(creatorId));
    });

    const creatorIds = Array.from(new Set(creatorIdByUser.values())).filter((id) => !visited.has(id));
    if (creatorIds.length > 0) {
      // Recurse so a chain of unresolved accounts (sale_person -> manager
      // -> admin) still terminates at the first ancestor that resolves.
      const creatorCompanies = await collectUserCompanyIds(creatorIds, visited, depth + 1);
      creatorIdByUser.forEach((creatorId, userId) => {
        const companies = creatorCompanies.get(creatorId);
        if (companies && companies.size === 1) {
          add(userId, Array.from(companies)[0]);
        }
      });
    }
  }

  return map;
};

// The company-scoped counterpart to getAllChildUserIds: the caller's
// recursive team, minus anyone positively belonging to a different company.
// Passing a null/undefined companyId (no company context resolvable —
// e.g. super_admin) returns the unfiltered hierarchy, preserving the
// previous behavior exactly.
export async function getCompanyScopedChildUserIds(
  userId: number,
  companyId: number | null | undefined
): Promise<number[]> {
  const childIds = await getAllChildUserIds(userId);
  if (companyId == null || childIds.length === 0) return childIds;

  const target = Number(companyId);
  const companyIdsByUser = await collectUserCompanyIds(childIds);

  return childIds.filter((id) => {
    const companies = companyIdsByUser.get(id);
    // Indeterminate membership (no branch, no junction row, owns nothing) —
    // keep, rather than silently hiding a legitimate team member.
    if (!companies || companies.size === 0) return true;
    return companies.has(target);
  });
}

// PERF fast-path used ONLY by admin.ts's getDashboardSummary/buildDashboardSummary.
// Deliberately a separate function rather than a change to
// getAllChildUserIds/getCompanyScopedChildUserIds above — those are called
// from ~14 other endpoints and are left untouched to avoid any risk of
// regressing them. This does the exact same job (recursive team walk,
// company-scoped) but fetches each hierarchy LEVEL in one batched query
// instead of the original's one-DB-round-trip-per-user recursion, which is
// what made getDashboardSummary take 4-5s for teams of any real size.
export async function getCompanyScopedChildUserIdsFast(
  userId: number,
  companyId: number | null | undefined
): Promise<number[]> {
  const result = new Set<number>();
  let currentLevelIds: number[] = [userId];

  while (currentLevelIds.length > 0) {
    const users = (await User.findAll({
      where: { id: { [Op.in]: currentLevelIds } },
      attributes: ["id"],
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    })) as UserWithChildren[];

    const nextLevelIds: number[] = [];
    for (const user of users) {
      for (const child of user.createdUsers ?? []) {
        if (!result.has(child.id)) {
          result.add(child.id);
          nextLevelIds.push(child.id);
        }
      }
    }

    currentLevelIds = nextLevelIds;
  }

  const childIds = Array.from(result);
  if (companyId == null || childIds.length === 0) return childIds;

  const target = Number(companyId);
  const companyIdsByUser = await collectUserCompanyIds(childIds);

  return childIds.filter((id) => {
    const companies = companyIdsByUser.get(id);
    if (!companies || companies.size === 0) return true;
    return companies.has(target);
  });
}

// Returns the given user's immediate creator (one level up the createdBy
// chain) — e.g. a sale_person's direct manager, or a manager's direct
// admin. Used to route "task completed" / other escalation notifications
// to the right person without walking the whole chain. Returns null if the
// user has no creator (e.g. a tenant-root "user" or super_admin).
export async function getDirectCreator(userId: number): Promise<{ id: number; role: string } | null> {
  const user = (await User.findByPk(userId, {
    include: [
      {
        model: User,
        as: "creators",
        attributes: ["id", "role"],
        through: { attributes: [] },
      },
    ],
  })) as any;

  const plain = user?.get ? user.get({ plain: true }) : user;
  const creator = plain?.creators?.[0];
  return creator ? { id: creator.id, role: creator.role } : null;
}
