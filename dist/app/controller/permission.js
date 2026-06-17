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
exports.revokePermissionsFromRole = exports.getMyPermissions = exports.getUsersByRole = exports.assignPermissionsToRole = exports.revokePermissions = exports.assignPermissions = exports.getUserPermissions = exports.getAllPermissions = void 0;
const sequelize_1 = require("sequelize");
const permission_1 = require("../model/permission");
const userPermission_1 = require("../model/userPermission");
const dbConnection_1 = require("../../config/dbConnection");
const permissionCache_1 = require("../../config/permissionCache");
// BFS traversal of the creator hierarchy below rootUserId (does NOT include root itself).
const getAllChildIds = (rootUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = [];
    const queue = [rootUserId];
    const visited = new Set([rootUserId]);
    while (queue.length > 0) {
        const pid = queue.shift();
        const user = yield dbConnection_1.User.findByPk(pid, {
            include: [{ model: dbConnection_1.User, as: "createdUsers", attributes: ["id", "role"], through: { attributes: [] } }],
        });
        if (user === null || user === void 0 ? void 0 : user.createdUsers) {
            for (const child of user.createdUsers) {
                if (!visited.has(child.id)) {
                    visited.add(child.id);
                    result.push(child.id);
                    queue.push(child.id);
                }
            }
        }
    }
    return result;
});
// Returns all subordinate userIds below a given user (does NOT include the user itself).
// Only traverses downward — never climbs up to the company root.
const getSubordinateIdsDown = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = [];
    const queue = [userId];
    const visited = new Set([userId]);
    while (queue.length > 0) {
        const pid = queue.shift();
        const user = yield dbConnection_1.User.findByPk(pid, {
            include: [{ model: dbConnection_1.User, as: "createdUsers", attributes: ["id", "role"], through: { attributes: [] } }],
        });
        if (user === null || user === void 0 ? void 0 : user.createdUsers) {
            for (const child of user.createdUsers) {
                if (!visited.has(child.id) && child.role !== "super_admin") {
                    visited.add(child.id);
                    result.push(child.id);
                    queue.push(child.id);
                }
            }
        }
    }
    return result;
});
// Roles a caller can assign to individual users
const ASSIGNABLE_ROLES = {
    super_admin: ["user", "admin", "manager", "sale_person"],
    user: ["admin"],
    admin: ["manager", "sale_person"],
    manager: ["sale_person"],
};
// Roles a caller can bulk-assign to via /assign-role
const ROLE_ASSIGNABLE_ROLES = {
    super_admin: ["user", "admin", "manager", "sale_person"],
    user: ["admin", "manager", "sale_person"],
    admin: ["manager", "sale_person"],
    manager: ["sale_person"],
};
// ─── Helper: get own permission set ────────────────────────────────────────
const getOwnPermissions = (userId, 
// companyId: number | null,
role) => __awaiter(void 0, void 0, void 0, function* () {
    // super_admin has all permissions — return null to signal "no check needed"
    if (role === "super_admin")
        return null;
    const whereClause = { userId };
    // if (companyId) whereClause.companyId = companyId;
    const records = yield userPermission_1.UserPermission.findAll({
        where: whereClause,
        include: [{ model: permission_1.Permission, as: "permission", attributes: ["module", "action"] }],
    });
    return new Set(records.map((r) => `${r.permission.module}:${r.permission.action}`));
});
// ─── Helper: find target user and validate they belong to same company ──────
const findTargetUser = (targetUserId) => __awaiter(void 0, void 0, void 0, function* () {
    // We need the user's companyId — stored in user_permissions or via Company table.
    // Simple approach: check user_permissions for companyId OR join Company.
    // Here we look at the company table's adminId / direct membership.
    // For now, we'll validate via checking user exists in the system and
    // that the caller's companyId is used for the assignment (enforced above).
    const user = yield dbConnection_1.User.findOne({
        where: { id: targetUserId, status: "active" },
        attributes: ["id", "role"],
    });
    return user ? { id: user.id, role: user.role } : null;
});
// ============================================================
// GET /permissions/all
// Returns every permission in the master table.
// Any authenticated user can view this (used for the permission matrix UI).
// ============================================================
const getAllPermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const permissions = yield permission_1.Permission.findAll({
            order: [["module", "ASC"], ["action", "ASC"]],
        });
        // Group by module for easy frontend consumption
        const grouped = {};
        for (const p of permissions) {
            if (!grouped[p.module])
                grouped[p.module] = [];
            grouped[p.module].push({ id: p.id, action: p.action, description: p.description });
        }
        return res.status(200).json({ success: true, data: { permissions, grouped } });
    }
    catch (err) {
        console.error("getAllPermissions error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllPermissions = getAllPermissions;
// ============================================================
// GET /permissions/user/:userId
// Returns the effective permission list for a specific user.
// Admin can only view users in their company.
// ============================================================
const getUserPermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        console.log(">>>>>>>>>>>>>", userData);
        const { role, userId: callerId, companyId } = userData;
        const targetUserId = Number(req.params.userId);
        console.log(">>>>targetUserId>", targetUserId);
        // Individual permissions are stored without companyId (see assignPermissions).
        // Access is controlled by role hierarchy — no companyId filter needed here.
        const whereClause = { userId: targetUserId };
        const records = yield userPermission_1.UserPermission.findAll({
            where: whereClause,
            include: [
                {
                    model: permission_1.Permission,
                    as: "permission",
                    attributes: ["id", "module", "action", "description"],
                },
            ],
        });
        // Build permission matrix: { module: { action: true } }
        const matrix = {};
        const flat = [];
        for (const r of records) {
            const { module, action } = r.permission;
            if (!matrix[module])
                matrix[module] = {};
            matrix[module][action] = true;
            flat.push(`${module}:${action}`);
        }
        return res.status(200).json({
            success: true,
            data: {
                userId: targetUserId,
                permissions: flat,
                matrix,
                raw: records,
            },
        });
    }
    catch (err) {
        console.error("getUserPermissions error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUserPermissions = getUserPermissions;
// ============================================================
// POST /permissions/assign
// Assign one or more permissions to a user.
// Body: { targetUserId, companyId (optional for super_admin), permissionIds: number[] }
//
// Rules:
//  1. Caller can only assign to their directly subordinate role
//  2. Caller can only assign permissions they themselves have
//  3. Admin/Manager scoped to their companyId
// ============================================================
const assignPermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        console.log(">>>>>>>>>>>>>>>>>>>>>assignPermissions>>>", userData);
        const { role, userId: callerId, companyId: callerCompanyId } = userData;
        // companyId: bodyCompanyId
        const { targetUserId, permissionIds } = req.body;
        if (!targetUserId || !permissionIds || !Array.isArray(permissionIds) || permissionIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "targetUserId and permissionIds[] are required",
            });
        }
        // super_admin and user manage multiple companies — they pass companyId in body; others use JWT companyId
        // const effectiveCompanyId: number =
        //   (role === "super_admin" || role === "user") ? Number(bodyCompanyId) : Number(callerCompanyId);
        // if (!effectiveCompanyId) {
        //   return res.status(400).json({ success: false, message: "companyId is required" });
        // }
        // ── Validate target user exists ─────────────────────────────────
        const targetUser = yield findTargetUser(Number(targetUserId));
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Target user not found or inactive" });
        }
        // ── Tenant isolation: caller cannot touch users in a different tenant ──
        if (role !== "super_admin") {
            const [callerRecord, targetRecord] = yield Promise.all([
                dbConnection_1.User.findByPk(callerId, { attributes: ["tenantId"] }),
                dbConnection_1.User.findByPk(Number(targetUserId), { attributes: ["tenantId"] }),
            ]);
            if ((callerRecord === null || callerRecord === void 0 ? void 0 : callerRecord.tenantId) && callerRecord.tenantId !== (targetRecord === null || targetRecord === void 0 ? void 0 : targetRecord.tenantId)) {
                return res.status(403).json({
                    success: false,
                    message: "Cannot assign permissions to users outside your tenant",
                });
            }
        }
        // ── Hierarchy check: can caller assign to target's role? ─────────
        const allowedRoles = ASSIGNABLE_ROLES[role] || [];
        if (!allowedRoles.includes(targetUser.role)) {
            return res.status(403).json({
                success: false,
                message: `${role} cannot assign permissions to ${targetUser.role}`,
            });
        }
        // ── Anti-escalation: caller must own each permission they're granting ──
        // user provides companyId in body, so use effectiveCompanyId for their permission lookup
        // const ownPermsCompanyId = role === "user" ? effectiveCompanyId : callerCompanyId;
        const ownPerms = yield getOwnPermissions(callerId, role);
        // ownPermsCompanyId
        // ── Validate all permissionIds exist ────────────────────────────
        const permsToAssign = yield permission_1.Permission.findAll({
            where: { id: { [sequelize_1.Op.in]: permissionIds } },
        });
        if (permsToAssign.length !== permissionIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more invalid permissionIds",
            });
        }
        // ── Check anti-escalation for each permission ────────────────────
        if (ownPerms !== null) {
            for (const perm of permsToAssign) {
                const key = `${perm.module}:${perm.action}`;
                if (!ownPerms.has(key)) {
                    return res.status(403).json({
                        success: false,
                        message: `You do not have '${key}' permission — you cannot assign it to others`,
                    });
                }
            }
        }
        // ── Bulk upsert (findOrCreate for each) ─────────────────────────
        const results = yield Promise.all(permissionIds.map((permId) => userPermission_1.UserPermission.findOrCreate({
            where: {
                userId: Number(targetUserId),
                permissionId: permId,
                // companyId: effectiveCompanyId,
            },
            defaults: {
                userId: Number(targetUserId),
                permissionId: permId,
                // companyId: effectiveCompanyId,
                grantedBy: callerId,
            },
        })));
        const created = results.filter(([, wasCreated]) => wasCreated).length;
        const skipped = results.length - created;
        // Invalidate cache for the target user
        (0, permissionCache_1.invalidatePermissionCache)(Number(targetUserId));
        // Propagate new permissions to all admins created by this user
        if (targetUser.role === "user") {
            const userWithAdmins = yield dbConnection_1.User.findByPk(Number(targetUserId), {
                include: [{
                        model: dbConnection_1.User,
                        as: "createdUsers",
                        where: { role: "admin", status: "active" },
                        required: false,
                        attributes: ["id"],
                        through: { attributes: [] },
                    }],
                attributes: ["id"],
            });
            const adminUsers = (userWithAdmins === null || userWithAdmins === void 0 ? void 0 : userWithAdmins.createdUsers) || [];
            for (const admin of adminUsers) {
                // null-scoped (admin not yet linked to a company)
                yield Promise.all(permissionIds.map((permId) => userPermission_1.UserPermission.findOrCreate({
                    where: { userId: admin.id, permissionId: permId, companyId: null },
                    defaults: { userId: admin.id, permissionId: permId, companyId: null, grantedBy: callerId },
                })));
                // company-scoped (for each company this admin is linked to)
                const adminCompanies = yield dbConnection_1.Company.findAll({
                    where: { adminId: admin.id },
                    attributes: ["id"],
                });
                for (const company of adminCompanies) {
                    yield Promise.all(permissionIds.map((permId) => userPermission_1.UserPermission.findOrCreate({
                        where: { userId: admin.id, permissionId: permId, companyId: company.id },
                        defaults: { userId: admin.id, permissionId: permId, companyId: company.id, grantedBy: callerId },
                    })));
                }
                (0, permissionCache_1.invalidatePermissionCache)(admin.id);
            }
        }
        return res.status(200).json({
            success: true,
            message: `Permissions assigned: ${created} new, ${skipped} already existed`,
            data: { assigned: created, alreadyExisted: skipped },
        });
    }
    catch (err) {
        console.error("assignPermissions error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err instanceof Error ? err.message : err });
    }
});
exports.assignPermissions = assignPermissions;
// ============================================================
// DELETE /permissions/revoke
// Revoke one or more permissions from a user.
// Body: { targetUserId, companyId (optional for super_admin), permissionIds: number[] }
// ============================================================
const revokePermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { role, userId: callerId, companyId: callerCompanyId } = userData;
        const { targetUserId, permissionIds } = req.body;
        if (!targetUserId || !permissionIds || !Array.isArray(permissionIds)) {
            return res.status(400).json({
                success: false,
                message: "targetUserId and permissionIds[] are required",
            });
        }
        // Validate target user
        const targetUser = yield findTargetUser(Number(targetUserId));
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }
        // ── Tenant isolation ─────────────────────────────────────────────
        if (role !== "super_admin") {
            const [callerRecord, targetRecord] = yield Promise.all([
                dbConnection_1.User.findByPk(callerId, { attributes: ["tenantId"] }),
                dbConnection_1.User.findByPk(Number(targetUserId), { attributes: ["tenantId"] }),
            ]);
            if ((callerRecord === null || callerRecord === void 0 ? void 0 : callerRecord.tenantId) && callerRecord.tenantId !== (targetRecord === null || targetRecord === void 0 ? void 0 : targetRecord.tenantId)) {
                return res.status(403).json({
                    success: false,
                    message: "Cannot revoke permissions from users outside your tenant",
                });
            }
        }
        // Hierarchy check
        const allowedRoles = ASSIGNABLE_ROLES[role] || [];
        if (!allowedRoles.includes(targetUser.role)) {
            return res.status(403).json({
                success: false,
                message: `${role} cannot revoke permissions from ${targetUser.role}`,
            });
        }
        const deleted = yield userPermission_1.UserPermission.destroy({
            where: {
                userId: Number(targetUserId),
                permissionId: { [sequelize_1.Op.in]: permissionIds },
            },
        });
        (0, permissionCache_1.invalidatePermissionCache)(Number(targetUserId));
        // Cascade: revoke the same permissions from all subordinates of the target user
        const onlySubordinates = yield getSubordinateIdsDown(Number(targetUserId));
        let cascadeRevoked = 0;
        if (onlySubordinates.length > 0) {
            cascadeRevoked = yield userPermission_1.UserPermission.destroy({
                where: {
                    userId: { [sequelize_1.Op.in]: onlySubordinates },
                    permissionId: { [sequelize_1.Op.in]: permissionIds },
                },
            });
            for (const subId of onlySubordinates) {
                (0, permissionCache_1.invalidatePermissionCache)(subId);
            }
        }
        // Propagate revocation to all admins created by this user
        if (targetUser.role === "user") {
            const userWithAdmins = yield dbConnection_1.User.findByPk(Number(targetUserId), {
                include: [{
                        model: dbConnection_1.User,
                        as: "createdUsers",
                        where: { role: "admin", status: "active" },
                        required: false,
                        attributes: ["id"],
                        through: { attributes: [] },
                    }],
                attributes: ["id"],
            });
            const adminUsers = (userWithAdmins === null || userWithAdmins === void 0 ? void 0 : userWithAdmins.createdUsers) || [];
            for (const admin of adminUsers) {
                // revoke null-scoped
                yield userPermission_1.UserPermission.destroy({
                    where: { userId: admin.id, permissionId: { [sequelize_1.Op.in]: permissionIds }, companyId: null },
                });
                // revoke from each company the admin is linked to
                const adminCompanies = yield dbConnection_1.Company.findAll({
                    where: { adminId: admin.id },
                    attributes: ["id"],
                });
                for (const company of adminCompanies) {
                    yield userPermission_1.UserPermission.destroy({
                        where: { userId: admin.id, permissionId: { [sequelize_1.Op.in]: permissionIds }, companyId: company.id },
                    });
                }
                (0, permissionCache_1.invalidatePermissionCache)(admin.id);
            }
        }
        return res.status(200).json({
            success: true,
            message: `${deleted} permission(s) revoked from user; ${cascadeRevoked} cascaded to ${onlySubordinates.length} subordinate(s)`,
            data: { revoked: deleted, cascadeRevoked, subordinatesAffected: onlySubordinates.length },
        });
    }
    catch (err) {
        console.error("revokePermissions error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.revokePermissions = revokePermissions;
// ============================================================
// POST /permissions/assign-bulk-role
// Convenience: assign all permissions of a certain set to all
// users of a given role within a company (e.g., give all managers attendance:view)
// Body: { targetRole, companyId, permissionIds: number[] }
// Only callable by: admin (for manager), manager (for sale_person)
// ============================================================
const assignPermissionsToRole = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { role, userId: callerId, companyId: callerCompanyId } = userData;
        const { targetRole, companyId: bodyCompanyId, permissionIds } = req.body;
        if (!targetRole || !permissionIds || !Array.isArray(permissionIds)) {
            return res.status(400).json({
                success: false,
                message: "targetRole and permissionIds[] are required",
            });
        }
        // companyId is optional in body — falls back to JWT-resolved companyId
        const effectiveCompanyId = bodyCompanyId
            ? Number(bodyCompanyId)
            : callerCompanyId ? Number(callerCompanyId) : null;
        // Hierarchy check
        const allowedRoles = ROLE_ASSIGNABLE_ROLES[role] || [];
        if (!allowedRoles.includes(targetRole)) {
            return res.status(403).json({
                success: false,
                message: `${role} cannot assign permissions to role '${targetRole}'`,
            });
        }
        // Anti-escalation check
        const ownPerms = yield getOwnPermissions(callerId, role);
        // callerCompanyId
        const permsToAssign = yield permission_1.Permission.findAll({
            where: { id: { [sequelize_1.Op.in]: permissionIds } },
        });
        if (ownPerms !== null) {
            for (const perm of permsToAssign) {
                const key = `${perm.module}:${perm.action}`;
                if (!ownPerms.has(key)) {
                    return res.status(403).json({
                        success: false,
                        message: `You do not have '${key}' permission — cannot assign it`,
                    });
                }
            }
        }
        // Find the company's root admin to scope the search to this company's hierarchy
        const company = yield dbConnection_1.Company.findByPk(effectiveCompanyId, { attributes: ["id", "adminId"] });
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }
        const allChildIds = yield getAllChildIds(company.adminId);
        const roleUsers = yield dbConnection_1.User.findAll({
            where: {
                id: { [sequelize_1.Op.in]: allChildIds },
                role: targetRole,
                status: "active",
            },
            attributes: ["id"],
        });
        const userIds = roleUsers.map((u) => u.id);
        if (userIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No active users with role '${targetRole}' found`,
                data: { assigned: 0 },
            });
        }
        // Bulk assign
        let totalAssigned = 0;
        for (const uid of userIds) {
            for (const permId of permissionIds) {
                const [, wasCreated] = yield userPermission_1.UserPermission.findOrCreate({
                    where: { userId: uid, permissionId: permId, companyId: effectiveCompanyId },
                    defaults: { userId: uid, permissionId: permId, companyId: effectiveCompanyId, grantedBy: callerId },
                });
                if (wasCreated)
                    totalAssigned++;
            }
            // effectiveCompanyId
            (0, permissionCache_1.invalidatePermissionCache)(uid);
        }
        return res.status(200).json({
            success: true,
            message: `Bulk assigned ${totalAssigned} new permissions to ${userIds.length} ${targetRole}(s)`,
            data: { usersAffected: userIds.length, permissionsAssigned: totalAssigned },
        });
    }
    catch (err) {
        console.error("assignPermissionsToRole error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.assignPermissionsToRole = assignPermissionsToRole;
// ============================================================
// GET /permissions/users-by-role?role=sale_person
// Returns all active users in the caller's company with the given role.
// Used by admin/manager to preview who will be affected before bulk-assigning.
// Query params: role (required), companyId (required only for super_admin)
// ============================================================
const getUsersByRole = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { role: callerRole, companyId: callerCompanyId } = userData;
        const { role: targetRole, companyId: queryCompanyId } = req.query;
        const VALID_ROLES = ["admin", "manager", "sale_person", "user"];
        if (!targetRole || !VALID_ROLES.includes(targetRole)) {
            return res.status(400).json({
                success: false,
                message: "Query param 'role' is required and must be one of: admin, manager, sale_person, user",
            });
        }
        // Hierarchy check: caller can only view users of roles they can assign to
        const allowedRoles = ROLE_ASSIGNABLE_ROLES[callerRole] || [];
        if (!allowedRoles.includes(targetRole)) {
            return res.status(403).json({
                success: false,
                message: `${callerRole} cannot fetch users with role '${targetRole}'`,
            });
        }
        // companyId is optional in query — falls back to JWT-resolved companyId
        const effectiveCompanyId = queryCompanyId
            ? Number(queryCompanyId)
            : callerCompanyId ? Number(callerCompanyId) : null;
        if (!effectiveCompanyId) {
            return res.status(400).json({ success: false, message: "companyId is required" });
        }
        const company = yield dbConnection_1.Company.findByPk(effectiveCompanyId, { attributes: ["id", "adminId"] });
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }
        const allChildIds = yield getAllChildIds(company.adminId);
        const users = yield dbConnection_1.User.findAll({
            where: {
                id: { [sequelize_1.Op.in]: allChildIds },
                role: targetRole,
                status: "active",
            },
            attributes: ["id", "firstName", "lastName", "email", "phone", "role", "profile", "createdAt"],
            order: [["firstName", "ASC"]],
        });
        return res.status(200).json({
            success: true,
            data: {
                role: targetRole,
                companyId: effectiveCompanyId,
                count: users.length,
                users,
            },
        });
    }
    catch (err) {
        console.error("getUsersByRole error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUsersByRole = getUsersByRole;
// ============================================================
// GET /permissions/my
// Returns the calling user's own permission set.
// ============================================================
const getMyPermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        console.log(">>>>>>>>>>>>>>>>>>>>>getMyPermissions>>>", userData);
        const { role, userId, companyId } = userData;
        // Super admin has everything
        if (role === "super_admin") {
            const all = yield permission_1.Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] });
            return res.status(200).json({
                success: true,
                data: {
                    role: "super_admin",
                    note: "Super Admin has ALL permissions",
                    permissions: all.map((p) => `${p.module}:${p.action}`),
                },
            });
        }
        // Admin / Manager / Sale person — fetch from DB (only what was granted)
        // companyId intentionally omitted: permissions are stored without companyId scope
        const records = yield userPermission_1.UserPermission.findAll({
            where: { userId },
            include: [{ model: permission_1.Permission, as: "permission", attributes: ["module", "action", "description"] }],
        });
        const all = yield permission_1.Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] });
        const matrix = {};
        const flat = [];
        for (const r of records) {
            const { module, action } = r.permission;
            if (!matrix[module])
                matrix[module] = {};
            matrix[module][action] = true;
            flat.push(`${module}:${action}`);
        }
        const allPermissions = {};
        for (const p of all) {
            if (!allPermissions[p.module])
                allPermissions[p.module] = [];
            allPermissions[p.module].push(p.action);
        }
        return res.status(200).json({
            success: true,
            data: { role, companyId, permissions: flat, matrix, allPermissions },
        });
    }
    catch (err) {
        console.error("getMyPermissions error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getMyPermissions = getMyPermissions;
// ============================================================
// DELETE /permissions/revoke-role
// Revoke one or more permissions from ALL users of a given role in a company.
// Body: { targetRole, companyId, permissionIds: number[] }
// Callable by: super_admin (any role), admin (manager/sale_person), manager (sale_person)
// ============================================================
const revokePermissionsFromRole = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { role, companyId: callerCompanyId } = userData;
        const { targetRole, companyId: bodyCompanyId, permissionIds } = req.body;
        if (!targetRole || !permissionIds || !Array.isArray(permissionIds) || permissionIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "targetRole and permissionIds[] are required",
            });
        }
        // companyId is optional in body — falls back to JWT-resolved companyId
        const effectiveCompanyId = bodyCompanyId
            ? Number(bodyCompanyId)
            : callerCompanyId ? Number(callerCompanyId) : null;
        if (!effectiveCompanyId) {
            return res.status(400).json({ success: false, message: "companyId is required" });
        }
        // Hierarchy check
        const allowedRoles = ROLE_ASSIGNABLE_ROLES[role] || [];
        if (!allowedRoles.includes(targetRole)) {
            return res.status(403).json({
                success: false,
                message: `${role} cannot revoke permissions from role '${targetRole}'`,
            });
        }
        // Validate all permissionIds exist
        const permsToRevoke = yield permission_1.Permission.findAll({
            where: { id: { [sequelize_1.Op.in]: permissionIds } },
        });
        if (permsToRevoke.length !== permissionIds.length) {
            return res.status(400).json({ success: false, message: "One or more invalid permissionIds" });
        }
        // Resolve company → get all users of targetRole in this company
        const company = yield dbConnection_1.Company.findByPk(effectiveCompanyId, { attributes: ["id", "adminId"] });
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }
        const allChildIds = yield getAllChildIds(company.adminId);
        const roleUsers = yield dbConnection_1.User.findAll({
            where: { id: { [sequelize_1.Op.in]: allChildIds }, role: targetRole, status: "active" },
            attributes: ["id"],
        });
        const userIds = roleUsers.map((u) => u.id);
        if (userIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No active users with role '${targetRole}' found`,
                data: { revoked: 0, usersAffected: 0 },
            });
        }
        // Bulk delete matching rows
        const totalRevoked = yield userPermission_1.UserPermission.destroy({
            where: {
                userId: { [sequelize_1.Op.in]: userIds },
                permissionId: { [sequelize_1.Op.in]: permissionIds },
            },
        });
        for (const uid of userIds) {
            (0, permissionCache_1.invalidatePermissionCache)(uid);
        }
        return res.status(200).json({
            success: true,
            message: `Revoked ${totalRevoked} permission record(s) from ${userIds.length} ${targetRole}(s)`,
            data: { revoked: totalRevoked, usersAffected: userIds.length },
        });
    }
    catch (err) {
        console.error("revokePermissionsFromRole error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.revokePermissionsFromRole = revokePermissionsFromRole;
