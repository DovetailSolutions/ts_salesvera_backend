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
exports.checkPermission = void 0;
const userPermission_1 = require("../app/model/userPermission");
const permission_1 = require("../app/model/permission");
const permissionCache_1 = require("./permissionCache");
/**
 * Loads a user's permissions from the database.
 * Returns an array of "module:action" strings.
 * Eager-loads Permission model to avoid N+1.
 */
const loadUserPermissionsFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userPerms = yield userPermission_1.UserPermission.findAll({
        where: { userId },
        include: [
            {
                model: permission_1.Permission,
                as: "permission",
                attributes: ["module", "action"],
            },
        ],
        attributes: [],
    });
    return userPerms.map((up) => `${up.permission.module}:${up.permission.action}`);
});
/**
 * Middleware factory — call with module and action to protect a route.
 */
const checkPermission = (module, action) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const userData = req.userData;
            if (!userData || !userData.userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized — no user data in token",
                });
            }
            console.log("checkPermission: userData from token:", userData);
            const { role, userId } = userData;
            const companyId = (_e = (_c = (_a = userData.companyId) !== null && _a !== void 0 ? _a : (_b = req.body) === null || _b === void 0 ? void 0 : _b.companyId) !== null && _c !== void 0 ? _c : (_d = req.params) === null || _d === void 0 ? void 0 : _d.companyId) !== null && _e !== void 0 ? _e : (_f = req.query) === null || _f === void 0 ? void 0 : _f.companyId;
            console.log(`checkPermission: userId=${userId}, role=${role}, companyId=${companyId}, required=${module}:${action}`);
            // ── Super Admin: bypass all permission checks ──────────────────
            if (role === "super_admin") {
                return next();
            }
            // ── Admin / Manager / Sale Person / User: check permissions table via cache ────
            if (!companyId) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden — no company context in token",
                });
            }
            const permissionSet = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
            const required = `${module}:${action}`;
            console.log(`User permissions: ${Array.from(permissionSet).join(", ")}`);
            console.log(`Required permission: ${required}`);
            if (!permissionSet.has(required)) {
                return res.status(403).json({
                    success: false,
                    message: `You don’t have  '${module}" "${action}'permission`,
                });
            }
            return next();
        }
        catch (error) {
            console.error("checkPermission error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error during permission check",
            });
        }
    });
};
exports.checkPermission = checkPermission;
