"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllocations = exports.bulkAssignDepartment = exports.bulkAssignShift = exports.bulkAssignBranches = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const serviceError_1 = require("../shared/serviceError");
const userHierarchy_1 = require("../shared/userHierarchy");
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
const ASSIGNABLE_TARGET_ROLES = {
    super_admin: ["user", "admin", "manager", "sale_person"],
    user: ["admin", "manager"],
    admin: ["manager", "sale_person"],
    manager: ["sale_person"],
};
// Roles allowed to hold more than one branch. A sale_person works out of a
// single branch (and User.branchId, the primary-branch column the rest of
// the app reads, can only hold one anyway).
const MULTI_BRANCH_ROLES = ["admin", "manager", "user", "super_admin"];
const parseIdList = (value, label) => {
    const raw = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
    if (raw.length === 0)
        throw new serviceError_1.ServiceError(`${label} is required (non-empty array)`);
    const ids = raw.map((v) => Number(v));
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
        throw new serviceError_1.ServiceError(`${label} must contain only positive integers`);
    }
    return Array.from(new Set(ids));
};
// Shared gate for both APIs: resolves the caller's team once, then verifies
// every requested target is (a) a role this caller may allocate to and
// (b) actually inside that team. Returns the loaded User rows.
const loadAssignableTargets = (loggedInId, callerRole, callerCompanyId, userIds) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedRoles = ASSIGNABLE_TARGET_ROLES[String(callerRole)] || [];
    if (allowedRoles.length === 0) {
        throw new serviceError_1.ServiceError("Your role is not allowed to allocate branches or shifts", 403);
    }
    const targets = yield dbConnection_1.User.findAll({
        where: { id: { [sequelize_1.Op.in]: userIds } },
        attributes: ["id", "firstName", "lastName", "role", "branchId", "shiftId", "departmentId"],
    });
    const foundIds = targets.map((t) => Number(t.id));
    const missing = userIds.filter((id) => !foundIds.includes(id));
    if (missing.length > 0) {
        throw new serviceError_1.ServiceError(`User(s) not found: ${missing.join(", ")}`);
    }
    const roleViolations = targets.filter((t) => !allowedRoles.includes(String(t.role)));
    if (roleViolations.length > 0) {
        const detail = roleViolations.map((t) => `#${t.id} (${t.role})`).join(", ");
        throw new serviceError_1.ServiceError(`As ${callerRole} you can only allocate to: ${allowedRoles.join(", ")}. Not allowed: ${detail}`, 403);
    }
    // super_admin sits above the tenant tree and has no team of its own to
    // scope against; every other caller may only touch their own descendants
    // within the company they're currently acting in.
    if (callerRole !== "super_admin") {
        const teamIds = yield (0, userHierarchy_1.getCompanyScopedChildUserIds)(loggedInId, callerCompanyId);
        const outsiders = userIds.filter((id) => id !== loggedInId && !teamIds.includes(id));
        if (outsiders.length > 0) {
            throw new serviceError_1.ServiceError(`These users are not in your team (or belong to another company): ${outsiders.join(", ")}`, 403);
        }
    }
    return targets;
});
// Every branch/shift referenced must belong to the caller's active company.
const assertRefsInCallerCompany = (model, ids, callerCompanyId, label) => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield model.findAll({
        where: { id: { [sequelize_1.Op.in]: ids } },
        attributes: ["id", "companyId"],
    });
    const found = rows.map((r) => Number(r.id));
    const missing = ids.filter((id) => !found.includes(id));
    if (missing.length > 0)
        throw new serviceError_1.ServiceError(`${label} not found: ${missing.join(", ")}`);
    if (callerCompanyId) {
        const foreign = rows.filter((r) => r.companyId != null && Number(r.companyId) !== callerCompanyId);
        if (foreign.length > 0) {
            throw new serviceError_1.ServiceError(`${label} belonging to another company: ${foreign.map((r) => r.id).join(", ")}`, 403);
        }
    }
    return rows;
});
// ── API 1: bulk allocate branches ───────────────────────────────────────
// mode "replace" (default) sets exactly the given branches; "add" appends
// to whatever the user already has.
const bulkAssignBranches = (loggedInId, callerRole, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const userIds = parseIdList(body === null || body === void 0 ? void 0 : body.userIds, "userIds");
    const branchIds = parseIdList(body === null || body === void 0 ? void 0 : body.branchIds, "branchIds");
    const mode = String((body === null || body === void 0 ? void 0 : body.mode) || "replace").toLowerCase();
    if (!["replace", "add"].includes(mode)) {
        throw new serviceError_1.ServiceError('mode must be either "replace" or "add"');
    }
    const targets = yield loadAssignableTargets(loggedInId, callerRole, callerCompanyId, userIds);
    yield assertRefsInCallerCompany(dbConnection_1.Branch, branchIds, callerCompanyId, "Branch(es)");
    // A sale_person can only ever hold one branch.
    if (branchIds.length > 1) {
        const singleBranchOnly = targets.filter((t) => !MULTI_BRANCH_ROLES.includes(String(t.role)));
        if (singleBranchOnly.length > 0) {
            const detail = singleBranchOnly.map((t) => `#${t.id} (${t.role})`).join(", ");
            throw new serviceError_1.ServiceError(`Only ${MULTI_BRANCH_ROLES.join("/")} can hold multiple branches. Single-branch user(s): ${detail}`);
        }
    }
    const results = [];
    for (const target of targets) {
        const userId = Number(target.id);
        const isSingleBranch = !MULTI_BRANCH_ROLES.includes(String(target.role));
        // The length check above only inspects the REQUEST. On its own that
        // still let mode:"add" hand a sale_person a second branch one call at a
        // time (each call passing a single id). The constraint has to hold on
        // the RESULTING state, so a single-branch role always replaces — they
        // end up holding exactly the one branch requested, never accumulating.
        if (isSingleBranch || mode === "replace") {
            yield dbConnection_1.UserBranch.destroy({ where: { userId, branchId: { [sequelize_1.Op.notIn]: branchIds } } });
        }
        for (const branchId of branchIds) {
            yield dbConnection_1.UserBranch.findOrCreate({ where: { userId, branchId }, defaults: { userId, branchId } });
        }
        const finalRows = yield dbConnection_1.UserBranch.findAll({
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
            : (_a = finalBranchIds[0]) !== null && _a !== void 0 ? _a : null;
        if (Number(target.branchId) !== primary) {
            yield dbConnection_1.User.update({ branchId: primary }, { where: { id: userId } });
        }
        results.push({
            userId,
            name: `${(_b = target.firstName) !== null && _b !== void 0 ? _b : ""} ${(_c = target.lastName) !== null && _c !== void 0 ? _c : ""}`.trim(),
            role: target.role,
            branchIds: finalBranchIds,
            primaryBranchId: primary,
        });
    }
    return { mode, updated: results.length, users: results };
});
exports.bulkAssignBranches = bulkAssignBranches;
// ── API 2: bulk allocate shift ──────────────────────────────────────────
// Exactly one shift per person, so this takes a single shiftId.
const bulkAssignShift = (loggedInId, callerRole, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const userIds = parseIdList(body === null || body === void 0 ? void 0 : body.userIds, "userIds");
    const rawShiftId = body === null || body === void 0 ? void 0 : body.shiftId;
    if (Array.isArray(rawShiftId)) {
        throw new serviceError_1.ServiceError("Only one shift can be allocated per person — shiftId must be a single value");
    }
    const shiftId = Number(rawShiftId);
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
        throw new serviceError_1.ServiceError("A valid shiftId is required");
    }
    const targets = yield loadAssignableTargets(loggedInId, callerRole, callerCompanyId, userIds);
    yield assertRefsInCallerCompany(dbConnection_1.Shift, [shiftId], callerCompanyId, "Shift");
    yield dbConnection_1.User.update({ shiftId }, { where: { id: { [sequelize_1.Op.in]: userIds } } });
    return {
        shiftId,
        updated: targets.length,
        users: targets.map((t) => {
            var _a, _b, _c;
            return ({
                userId: Number(t.id),
                name: `${(_a = t.firstName) !== null && _a !== void 0 ? _a : ""} ${(_b = t.lastName) !== null && _b !== void 0 ? _b : ""}`.trim(),
                role: t.role,
                previousShiftId: (_c = t.shiftId) !== null && _c !== void 0 ? _c : null,
                shiftId,
            });
        }),
    };
});
exports.bulkAssignShift = bulkAssignShift;
// ── API 3: bulk allocate department ─────────────────────────────────────
// Exactly one department per person (User.departmentId), same shape as
// bulkAssignShift — a single departmentId, not an array.
const bulkAssignDepartment = (loggedInId, callerRole, callerCompanyId, body) => __awaiter(void 0, void 0, void 0, function* () {
    const userIds = parseIdList(body === null || body === void 0 ? void 0 : body.userIds, "userIds");
    const rawDepartmentId = body === null || body === void 0 ? void 0 : body.departmentId;
    if (Array.isArray(rawDepartmentId)) {
        throw new serviceError_1.ServiceError("Only one department can be allocated per person — departmentId must be a single value");
    }
    const departmentId = Number(rawDepartmentId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
        throw new serviceError_1.ServiceError("A valid departmentId is required");
    }
    const targets = yield loadAssignableTargets(loggedInId, callerRole, callerCompanyId, userIds);
    yield assertRefsInCallerCompany(dbConnection_1.Department, [departmentId], callerCompanyId, "Department");
    yield dbConnection_1.User.update({ departmentId }, { where: { id: { [sequelize_1.Op.in]: userIds } } });
    return {
        departmentId,
        updated: targets.length,
        users: targets.map((t) => {
            var _a, _b, _c;
            return ({
                userId: Number(t.id),
                name: `${(_a = t.firstName) !== null && _a !== void 0 ? _a : ""} ${(_b = t.lastName) !== null && _b !== void 0 ? _b : ""}`.trim(),
                role: t.role,
                previousDepartmentId: (_c = t.departmentId) !== null && _c !== void 0 ? _c : null,
                departmentId,
            });
        }),
    };
});
exports.bulkAssignDepartment = bulkAssignDepartment;
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
const getAllocations = (loggedInId, callerRole, callerCompanyId, userIdsParam) => __awaiter(void 0, void 0, void 0, function* () {
    const userIds = parseIdList(userIdsParam, "userIds");
    if (callerRole !== "super_admin") {
        const teamIds = yield (0, userHierarchy_1.getCompanyScopedChildUserIds)(loggedInId, callerCompanyId);
        const outsiders = userIds.filter((id) => id !== loggedInId && !teamIds.includes(id));
        if (outsiders.length > 0) {
            throw new serviceError_1.ServiceError(`These users are not in your team (or belong to another company): ${outsiders.join(", ")}`, 403);
        }
    }
    const [users, allocations] = yield Promise.all([
        dbConnection_1.User.findAll({
            where: { id: { [sequelize_1.Op.in]: userIds } },
            attributes: ["id", "branchId", "shiftId", "departmentId"],
            include: [
                { model: dbConnection_1.Branch, as: "branch", attributes: ["id", "branchName", "branchCode"] },
                { model: dbConnection_1.Shift, as: "shift", attributes: ["id", "shiftName", "startTime", "endTime"] },
                { model: dbConnection_1.Department, as: "department", attributes: ["id", "deptName", "deptCode"] },
            ],
        }),
        dbConnection_1.UserBranch.findAll({
            where: { userId: { [sequelize_1.Op.in]: userIds } },
            include: [{ model: dbConnection_1.Branch, as: "branch", attributes: ["id", "branchName", "branchCode"] }],
            order: [["branchId", "ASC"]],
        }),
    ]);
    const branchesByUser = new Map();
    allocations.forEach((r) => {
        const uid = Number(r.userId);
        if (!branchesByUser.has(uid))
            branchesByUser.set(uid, []);
        if (r.branch)
            branchesByUser.get(uid).push({ id: r.branch.id, branchName: r.branch.branchName, branchCode: r.branch.branchCode });
    });
    const found = new Set(users.map((u) => Number(u.id)));
    const missing = userIds.filter((id) => !found.has(id));
    if (missing.length > 0)
        throw new serviceError_1.ServiceError(`User(s) not found: ${missing.join(", ")}`);
    return users.map((u) => {
        var _a;
        return ({
            userId: Number(u.id),
            primaryBranch: u.branch ? { id: u.branch.id, branchName: u.branch.branchName, branchCode: u.branch.branchCode } : null,
            // Every branch this user is allocated to (the multi-branch junction) —
            // for a sale_person this is always exactly [primaryBranch] or empty,
            // since they can only ever hold one.
            branches: (_a = branchesByUser.get(Number(u.id))) !== null && _a !== void 0 ? _a : (u.branch ? [{ id: u.branch.id, branchName: u.branch.branchName, branchCode: u.branch.branchCode }] : []),
            shift: u.shift
                ? { id: u.shift.id, shiftName: u.shift.shiftName, startTime: u.shift.startTime, endTime: u.shift.endTime }
                : null,
            department: u.department
                ? { id: u.department.id, deptName: u.department.deptName, deptCode: u.department.deptCode }
                : null,
        });
    });
});
exports.getAllocations = getAllocations;
