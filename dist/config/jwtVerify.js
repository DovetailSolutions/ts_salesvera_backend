"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.tokenCheck = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("../config/dbConnection");
dotenv_1.default.config();
const tokenCheck = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "dovetailPharma");
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
        // Fetch user from DB — must be active and a valid role
        // sale_person is intentionally excluded — admin routes are off-limits to them
        const item = yield dbConnection_1.User.findOne({
            where: {
                id,
                status: "active",
                [sequelize_1.Op.or]: [
                    { role: "user" },
                    { role: "admin" },
                    { role: "super_admin" },
                    { role: "manager" },
                ],
            },
        });
        if (!item) {
            return res.status(403).json({
                code: "403",
                success: false,
                message: "Forbidden — user not found, inactive, or insufficient role",
            });
        }
        // ── Resolve companyId ──────────────────────────────────────────────
        // Priority: JWT payload → Company table lookup (admin) → null (super_admin)
        let companyId = decoded.companyId
            ? Number(decoded.companyId)
            : null;
        if (!companyId && item.role !== "super_admin") {
            if (item.role === "admin") {
                const company = yield dbConnection_1.Company.findOne({
                    where: { adminId: id },
                    attributes: ["id"],
                });
                companyId = company ? company.id : null;
            }
            else {
                // For manager/sale_person: walk up the creator chain to find the root admin,
                // then resolve their company (mirrors the login companyId resolution)
                const { User: UserModel } = yield Promise.resolve().then(() => __importStar(require("./dbConnection")));
                let currentId = id;
                let rootAdminId = null;
                while (true) {
                    const currentUser = yield UserModel.findByPk(currentId, {
                        include: [{ model: UserModel, as: "creators", attributes: ["id", "role"], through: { attributes: [] } }],
                    });
                    const plain = currentUser === null || currentUser === void 0 ? void 0 : currentUser.get({ plain: true });
                    const creator = ((_b = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _b === void 0 ? void 0 : _b[0]) || null;
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
                if (rootAdminId) {
                    const company = yield dbConnection_1.Company.findOne({
                        where: { adminId: rootAdminId },
                        attributes: ["id"],
                    });
                    companyId = company ? company.id : null;
                }
            }
        }
        // Attach enriched userData to request (available in all controllers & middleware)
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
exports.tokenCheck = tokenCheck;
