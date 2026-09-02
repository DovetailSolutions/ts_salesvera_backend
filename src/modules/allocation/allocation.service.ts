import { Op } from "sequelize";
import { User, Branch, Shift, Department, UserBranch } from "../../config/dbConnection";
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
    attributes: ["id", "firstName", "lastName", "role", "branchId", "shiftId", "departmentId"],
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
    const isSingleBranch = !MULTI_BRANCH_ROLES.includes(String(target.role));

    // The length check above only inspects the REQUEST. On its own that
    // still let mode:"add" hand a sale_person a second branch one call at a
    // time (each call passing a single id). The constraint has to hold on
    // the RESULTING state, so a single-branch role always replaces — they
    // end up holding exactly the one branch requested, never accumulating.
    if (isSingleBranch || mode === "replace") {
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

// ── API 3: bulk allocate department ─────────────────────────────────────
// Exactly one department per person (User.departmentId), same shape as
// bulkAssignShift — a single departmentId, not an array.
export const bulkAssignDepartment = async (
  loggedInId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  body: any
) => {
  const userIds = parseIdList(body?.userIds, "userIds");

  const rawDepartmentId = body?.departmentId;
  if (Array.isArray(rawDepartmentId)) {
    throw new ServiceError("Only one department can be allocated per person — departmentId must be a single value");
  }
  const departmentId = Number(rawDepartmentId);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    throw new ServiceError("A valid departmentId is required");
  }

  const targets = await loadAssignableTargets(loggedInId, callerRole, callerCompanyId, userIds);
  await assertRefsInCallerCompany(Department, [departmentId], callerCompanyId, "Department");

  await (User as any).update({ departmentId }, { where: { id: { [Op.in]: userIds } } });

  return {
    departmentId,
    updated: targets.length,
    users: targets.map((t) => ({
      userId: Number(t.id),
      name: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
      role: t.role,
      previousDepartmentId: t.departmentId ?? null,
      departmentId,
    })),
  };
};

// ── API 4: read current allocation(s) ────────────────────────────────────
// Powers both the "who's assigned where" table column (bulk, one round
// trip for the whole page) and the per-person detail popup (single id) —
// same shape either way, since the popup is just this same data.
//
// Viewing is a lighter bar than allocating: any caller may see their OWN
// allocation, and otherwise the target need only be in the caller's
// company-scoped team — no ASSIGNABLE_TARGET_ROLES check, since e.g. an
// admin's team already legitimately spans both managers and sale_persons
// and there's nothing sensitive about seeing where a team member is
// currently posted (only about REASSIGNING them, which bulkAssignBranches/
// Shift above still gate separately).
export const getAllocations = async (
  loggedInId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  userIdsParam: any
) => {
  const userIds = parseIdList(userIdsParam, "userIds");

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

  const [users, allocations] = await Promise.all([
    (User as any).findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "branchId", "shiftId", "departmentId"],
      include: [
        { model: Branch, as: "branch", attributes: ["id", "branchName", "branchCode"] },
        { model: Shift, as: "shift", attributes: ["id", "shiftName", "startTime", "endTime"] },
        { model: Department, as: "department", attributes: ["id", "deptName", "deptCode"] },
      ],
    }),
    (UserBranch as any).findAll({
      where: { userId: { [Op.in]: userIds } },
      include: [{ model: Branch, as: "branch", attributes: ["id", "branchName", "branchCode"] }],
      order: [["branchId", "ASC"]],
    }),
  ]);

  const branchesByUser = new Map<number, any[]>();
  allocations.forEach((r: any) => {
    const uid = Number(r.userId);
    if (!branchesByUser.has(uid)) branchesByUser.set(uid, []);
    if (r.branch) branchesByUser.get(uid)!.push({ id: r.branch.id, branchName: r.branch.branchName, branchCode: r.branch.branchCode });
  });

  const found = new Set(users.map((u: any) => Number(u.id)));
  const missing = userIds.filter((id) => !found.has(id));
  if (missing.length > 0) throw new ServiceError(`User(s) not found: ${missing.join(", ")}`);

  return users.map((u: any) => ({
    userId: Number(u.id),
    primaryBranch: u.branch ? { id: u.branch.id, branchName: u.branch.branchName, branchCode: u.branch.branchCode } : null,
    // Every branch this user is allocated to (the multi-branch junction) —
    // for a sale_person this is always exactly [primaryBranch] or empty,
    // since they can only ever hold one.
    branches: branchesByUser.get(Number(u.id)) ?? (u.branch ? [{ id: u.branch.id, branchName: u.branch.branchName, branchCode: u.branch.branchCode }] : []),
    shift: u.shift
      ? { id: u.shift.id, shiftName: u.shift.shiftName, startTime: u.shift.startTime, endTime: u.shift.endTime }
      : null,
    department: u.department
      ? { id: u.department.id, deptName: u.department.deptName, deptCode: u.department.deptCode }
      : null,
  }));
};
