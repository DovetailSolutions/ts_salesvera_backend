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
exports.tokenCheck = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("../config/dbConnection");
dotenv_1.default.config();
const tokenCheck = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!req.headers.authorization ||
            !req.headers.authorization.startsWith("Bearer") ||
            !req.headers.authorization.split(" ")[1]) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: "Unauthorized — please provide a Bearer token",
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
        // Verify user is active and has a valid non-admin role
        const item = yield dbConnection_1.User.findOne({
            where: {
                id,
                status: "active",
                [sequelize_1.Op.or]: [
                    { role: "user" },
                    { role: "manager" },
                    { role: "sale_person" },
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
        // Enrich userData: spread decoded JWT (which includes companyId if present),
        // then override userId and role with the DB-verified values
        req.userData = Object.assign(Object.assign({}, decoded), { userId: id, role: item.role });
        return next();
    }
    catch (error) {
        console.error("tokenCheck (user) error:", error);
        return res.status(500).json({
            code: "500",
            success: false,
            message: "Internal server error",
        });
    }
});
exports.tokenCheck = tokenCheck;
