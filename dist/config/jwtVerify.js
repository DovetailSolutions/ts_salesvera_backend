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
                errorMessage: "Please provide bearer token",
            });
        }
        const token = req.headers.authorization.split(" ")[1];
        console.log(">>>>>>>>>>>>>>>>>token", token);
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({
                code: "401",
                success: false,
                message: "Unauthorized",
            });
        }
        req.userData = decoded;
        console.log(">>>>>>>>>>>>>>>>>>>>>", req.userData);
        // support both possible token fields
        const rawId = (_a = decoded.userId) !== null && _a !== void 0 ? _a : decoded.userId;
        const id = Number(rawId);
        // Fetch both tables in parallel (you asked to include Users table)
        const [item] = yield Promise.all([
            dbConnection_1.User.findOne({
                where: {
                    id,
                    [sequelize_1.Op.or]: [{ role: "admin" }, { role: "super_admin" }, { role: "manager" }],
                },
            }),
        ]);
        if ((item && (item === null || item === void 0 ? void 0 : item.role) === "admin") || (item === null || item === void 0 ? void 0 : item.role) === "super_admin" || (item === null || item === void 0 ? void 0 : item.role) === "manager") {
            return next();
        }
        return res.status(403).json({
            code: "403",
            success: false,
            message: "Unauthorized",
        });
    }
    catch (error) {
        console.error(error);
    }
});
exports.tokenCheck = tokenCheck;
