import { Op } from "sequelize";
import { User, Branch, Shift, UserBranch } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getCompanyScopedChildUserIds } from "../shared/userHierarchy";

// ============================================================
// Bulk allocation of branches and shifts, role-aware.
//
// Who may allocate to whom mirrors the hierarchy already enforced for
// permission assignment (ASSIGNABLE_ROLES in app/controller/permission.ts) —
// kept identical on purpose so there is one consistent answer across the
// app to "may this caller act on that user":
//
//   user (tenant) -> admin, manager
//   admin         -> manager, sale_person
//   manager       -> sale_person
//   super_admin   -> everyone
//
// On top of the role check, every target must also be inside the caller's
// OWN company-scoped team, and every branch/shift referenced must belong to
// the caller's currently-active company — so a multi-company admin/manager
// can never reach across into another company's staff or config.
// ============================================================

const ASSIGNABLE_TARGET_ROLES: Record<string, string[]> = {
  super_admin: ["user", "admin", "manager", "sale_person"],
  user: ["admin", "manager"],
  admin: ["manager", "sale_person"],
  manager: ["sale_person"],
};

// Roles allowed to hold more than one branch. A sale_person works out of a
// single branch (and User.branchId, the primary-branch column the rest of
// the app reads, can only hold one anyway).
const MULTI_BRANCH_ROLES = ["admin", "manager", "user", "super_admin"];

const parseIdList = (value: any, label: string): number[] => {
  const raw = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  if (raw.length === 0) throw new ServiceError(`${label} is required (non-empty array)`);

  const ids = raw.map((v) => Number(v));
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new ServiceError(`${label} must contain only positive integers`);
  }
  return Array.from(new Set(ids));
};

// Shared gate for both APIs: resolves the caller's team once, then verifies
// every requested target is (a) a role this caller may allocate to and
// (b) actually inside that team. Returns the loaded User rows.
const loadAssignableTargets = async (
  loggedInId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  userIds: number[]
) => {
  const allowedRoles = ASSIGNABLE_TARGET_ROLES[String(callerRole)] || [];
  if (allowedRoles.length === 0) {
    throw new ServiceError("Your role is not allowed to allocate branches or shifts", 403);
  }

  const targets: any[] = await (User as any).findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ["id", "firstName", "lastName", "role", "branchId", "shiftId"],
  });

  const foundIds = targets.map((t) => Number(t.id));
  const missing = userIds.filter((id) => !foundIds.includes(id));
  if (missing.length > 0) {
    throw new ServiceError(`User(s) not found: ${missing.join(", ")}`);
  }

  const roleViolations = targets.filter((t) => !allowedRoles.includes(String(t.role)));
  if (roleViolations.length > 0) {
    const detail = roleViolations.map((t) => `#${t.id} (${t.role})`).join(", ");
    throw new ServiceError(
      `As ${callerRole} you can only allocate to: ${allowedRoles.join(", ")}. Not allowed: ${detail}`,
      403
    );
  }

  // super_admin sits above the tenant tree and has no team of its own to
  // scope against; every other caller may only touch their own descendants
  // within the company they're currently acting in.
  if (callerRole !== "super_admin") {
    const teamIds = await getCompanyScopedChildUserIds(loggedInId, callerCompanyId);
    const outsiders = userIds.filter((id) => id !== loggedInId && !teamIds.includes(id));
    if (outsiders.length > 0) {
      throw new ServiceError(
        `These users are not in your team (or belong to another company): ${outsiders.join(", ")}`,
        403
      );
    }
  }

  return targets;
};

// Every branch/shift referenced must belong to the caller's active company.
const assertRefsInCallerCompany = async (
  model: any,
  ids: number[],
  callerCompanyId: number | null,
  label: string
) => {
  const rows: any[] = await model.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "companyId"],
  });

  const found = rows.map((r) => Number(r.id));
  const missing = ids.filter((id) => !found.includes(id));
  if (missing.length > 0) throw new ServiceError(`${label} not found: ${missing.join(", ")}`);

  if (callerCompanyId) {
    const foreign = rows.filter((r) => r.companyId != null && Number(r.companyId) !== callerCompanyId);
    if (foreign.length > 0) {
      throw new ServiceError(
        `${label} belonging to another company: ${foreign.map((r) => r.id).join(", ")}`,
        403
      );
    }
  }
  return rows;
};

// ── API 1: bulk allocate branches ───────────────────────────────────────
// mode "replace" (default) sets exactly the given branches; "add" appends
// to whatever the user already has.
export const bulkAssignBranches = async (
  loggedInId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  body: any
) => {
  const userIds = parseIdList(body?.userIds, "userIds");
  const branchIds = parseIdList(body?.branchIds, "branchIds");
  const mode = String(body?.mode || "replace").toLowerCase();
  if (!["replace", "add"].includes(mode)) {
    throw new ServiceError('mode must be either "replace" or "add"');
  }

  const targets = await loadAssignableTargets(loggedInId, callerRole, callerCompanyId, userIds);
  await assertRefsInCallerCompany(Branch, branchIds, callerCompanyId, "Branch(es)");

  // A sale_person can only ever hold one branch.
  if (branchIds.length > 1) {
    const singleBranchOnly = targets.filter((t) => !MULTI_BRANCH_ROLES.includes(String(t.role)));
    if (singleBranchOnly.length > 0) {
      const detail = singleBranchOnly.map((t) => `#${t.id} (${t.role})`).join(", ");
      throw new ServiceError(
        `Only ${MULTI_BRANCH_ROLES.join("/")} can hold multiple branches. Single-branch user(s): ${detail}`
      );
    }
  }

  const results: any[] = [];
  for (const target of targets) {
    const userId = Number(target.id);

    if (mode === "replace") {
      await (UserBranch as any).destroy({ where: { userId, branchId: { [Op.notIn]: branchIds } } });
    }

    for (const branchId of branchIds) {
      await (UserBranch as any).findOrCreate({ where: { userId, branchId }, defaults: { userId, branchId } });
    }

    const finalRows: any[] = await (UserBranch as any).findAll({
      where: { userId },
      attributes: ["branchId"],
      order: [["branchId", "ASC"]],
    });
    const finalBranchIds = finalRows.map((r) => Number(r.branchId));

    // Keep User.branchId (the PRIMARY branch the rest of the app reads for
    // company resolution, geofencing and attendance defaults) pointing at a
    // branch the user actually still holds.
    const primary = finalBranchIds.includes(Number(target.branchId))
      ? Number(target.branchId)
      : finalBranchIds[0] ?? null;
    if (Number(target.branchId) !== primary) {
      await (User as any).update({ branchId: primary }, { where: { id: userId } });
    }

    results.push({
      userId,
      name: `${target.firstName ?? ""} ${target.lastName ?? ""}`.trim(),
      role: target.role,
      branchIds: finalBranchIds,
      primaryBranchId: primary,
    });
  }

  return { mode, updated: results.length, users: results };
};

// ── API 2: bulk allocate shift ──────────────────────────────────────────
// Exactly one shift per person, so this takes a single shiftId.
export const bulkAssignShift = async (
  loggedInId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  body: any
) => {
  const userIds = parseIdList(body?.userIds, "userIds");

  const rawShiftId = body?.shiftId;
  if (Array.isArray(rawShiftId)) {
    throw new ServiceError("Only one shift can be allocated per person — shiftId must be a single value");
  }
  const shiftId = Number(rawShiftId);
  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    throw new ServiceError("A valid shiftId is required");
  }

  const targets = await loadAssignableTargets(loggedInId, callerRole, callerCompanyId, userIds);
  await assertRefsInCallerCompany(Shift, [shiftId], callerCompanyId, "Shift");

  await (User as any).update({ shiftId }, { where: { id: { [Op.in]: userIds } } });

  return {
    shiftId,
    updated: targets.length,
    users: targets.map((t) => ({
      userId: Number(t.id),
      name: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
      role: t.role,
      previousShiftId: t.shiftId ?? null,
      shiftId,
    })),
  };
};
