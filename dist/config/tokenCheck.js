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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalTokenCheck = exports.createTokenCheck = exports.resolveCompanyId = void 0;
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("./dbConnection");
const env_1 = require("./env");
// ── Resolve companyId ──────────────────────────────────────────────────
// Priority: JWT payload → Company table lookup (admin/user) → CompanyManager
// junction (manager) → creator-chain walk to root admin (sale_person) →
// null (super_admin, or no company found).
const resolveCompanyId = (id, role, decodedCompanyId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (decodedCompanyId)
        return decodedCompanyId;
    if (role === "super_admin")
        return null;
    if (role === "admin") {
        const company = yield dbConnection_1.Company.findOne({
            where: { adminId: id },
            attributes: ["id"],
        });
        if (company)
            return company.id;
        // Fall back to the multi-company junction table (assign-company-admin)
        // for admins who administer a company without being its primary owner.
        const assignment = yield dbConnection_1.CompanyAdmin.findOne({
            where: { adminId: id },
            attributes: ["companyId"],
        });
        return assignment ? assignment.companyId : null;
    }
    if (role === "manager") {
        const assignment = yield dbConnection_1.CompanyManager.findOne({
            where: { managerId: id },
            attributes: ["companyId"],
        });
        return assignment ? assignment.companyId : null;
    }
    if (role === "user") {
        // "user" is a tenant root — resolves by ownership (Company.userId), not
        // by climbing to a creator (a tenant root's creator is super_admin,
        // which has no matching Company row and would always resolve to null).
        const company = yield dbConnection_1.Company.findOne({
            where: { userId: id },
            attributes: ["id"],
        });
        return company ? company.id : null;
    }
    // sale_person: walk up the creator chain to find the root admin, then
    // resolve their company.
    let currentId = id;
    let rootAdminId = null;
    while (true) {
        const currentUser = yield dbConnection_1.User.findByPk(currentId, {
            include: [{ model: dbConnection_1.User, as: "creators", attributes: ["id", "role"], through: { attributes: [] } }],
        });
        const plain = currentUser === null || currentUser === void 0 ? void 0 : currentUser.get({ plain: true });
        const creator = ((_a = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _a === void 0 ? void 0 : _a[0]) || null;
        if (!creator) {
            if ((plain === null || plain === void 0 ? void 0 : plain.role) === "admin" || (plain === null || plain === void 0 ? void 0 : plain.role) === "super_admin")
                rootAdminId = currentId;
            break;
        }
        if (creator.role === "admin" || creator.role === "super_admin") {
            rootAdminId = creator.id;
            break;
        }
        currentId = creator.id;
    }
    if (!rootAdminId)
        return null;
    const company = yield dbConnection_1.Company.findOne({
        where: { adminId: rootAdminId },
        attributes: ["id"],
    });
    return company ? company.id : null;
});
exports.resolveCompanyId = resolveCompanyId;
/**
 * Shared JWT auth middleware factory. Verifies the bearer token, loads the
 * user (must be active and have one of `allowedRoles`), and attaches an
 * enriched, server-resolved `req.userData` (never trusting anything the
 * client sends beyond the signed token itself).
 */
const createTokenCheck = (allowedRoles) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            if (!req.headers.authorization ||
                !req.headers.authorization.startsWith("Bearer") ||
                !req.headers.authorization.split(" ")[1]) {
                return res.status(401).json({
                    code: 401,
                    success: false,
                    errorMessage: "Please provide bearer token",
                });
            }
            const token = req.headers.authorization.split(" ")[1];
            let decoded;
            try {
                decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
            }
            catch (err) {
                return res.status(401).json({
                    code: "401",
                    success: false,
                    message: "Unauthorized — invalid or expired token",
                });
            }
            const rawId = (_a = decoded.userId) !== null && _a !== void 0 ? _a : decoded.id;
            const id = Number(rawId);
            const item = (yield dbConnection_1.User.findOne({
                where: {
                    id,
                    status: "active",
                    [sequelize_1.Op.or]: allowedRoles.map((role) => ({ role })),
                },
            }));
            if (!item) {
                return res.status(403).json({
                    code: "403",
                    success: false,
                    message: "Forbidden — user not found, inactive, or insufficient role",
                });
            }
            const decodedCompanyId = decoded.companyId ? Number(decoded.companyId) : null;
            const companyId = yield (0, exports.resolveCompanyId)(id, item.role, decodedCompanyId);
            req.userData = Object.assign(Object.assign({}, decoded), { userId: id, role: item.role, companyId });
            return next();
        }
        catch (error) {
            console.error("tokenCheck error:", error);
            return res.status(500).json({
                code: "500",
                success: false,
                message: "Internal server error",
            });
        }
    });
};
exports.createTokenCheck = createTokenCheck;
/**
 * Like createTokenCheck, but never rejects the request for a missing/invalid
 * token — it just leaves req.userData unset and calls next(). Exists solely
 * for /admin/register: role "super_admin" must remain callable with no
 * token at all (there's no seed script — the very first super_admin has
 * always been created through this exact endpoint, before any JWT can
 * exist), while every other role requires a real, hierarchy-checked caller.
 * That role-dependent branching happens in auth.service.ts's register(),
 * using req.userData when present — this middleware only ever *populates*
 * it opportunistically, it never enforces anything itself.
 */
const optionalTokenCheck = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer") || !authHeader.split(" ")[1]) {
            return next();
        }
        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
        }
        catch (_b) {
            return next();
        }
        const rawId = (_a = decoded.userId) !== null && _a !== void 0 ? _a : decoded.id;
        const id = Number(rawId);
        const item = (yield dbConnection_1.User.findOne({ where: { id, status: "active" } }));
        if (!item)
            return next();
        const decodedCompanyId = decoded.companyId ? Number(decoded.companyId) : null;
        const companyId = yield (0, exports.resolveCompanyId)(id, item.role, decodedCompanyId);
        req.userData = Object.assign(Object.assign({}, decoded), { userId: id, role: item.role, companyId });
        return next();
    }
    catch (error) {
        console.error("optionalTokenCheck error:", error);
        return next();
    }
});
exports.optionalTokenCheck = optionalTokenCheck;
