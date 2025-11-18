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
exports.BulkUploads = exports.getMeeting = exports.DeleteCategory = exports.UpdateCategory = exports.categoryDetails = exports.getcategory = exports.AddCategory = exports.GetAllUser = exports.assignSalesman = exports.MySalePerson = exports.UpdatePassword = exports.GetProfile = exports.Login = exports.Register = void 0;
const sequelize_1 = require("sequelize");
const client_s3_1 = require("@aws-sdk/client-s3");
const csv_parser_1 = __importDefault(require("csv-parser"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// import csv from "csv-parser";
// import fs from "fs";
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_1 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const UNIQUE_ROLES = ["admin", "super_admin"];
const Register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, firstName, lastName, phone, dob, role, createdBy, } = req.body;
        /** ✅ Required field validation */
        const requiredFields = {
            email,
            password,
            firstName,
            lastName,
            phone,
            dob,
            role,
        };
        for (const key in requiredFields) {
            if (!requiredFields[key]) {
                (0, errorMessage_1.badRequest)(res, `${key} is required`);
                return;
            }
        }
        /** ✅ Check if user with same email exists */
        const isExist = yield Middleware.FindByEmail(dbConnection_1.User, email);
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, "Email already exists");
            return;
        }
        /** ✅ Check role — admin/super_admin only once in DB */
        if (UNIQUE_ROLES.includes(role)) {
            const existing = yield Middleware.findByRole(dbConnection_1.User, role);
            if (existing) {
                (0, errorMessage_1.badRequest)(res, `${role} already exists. Only one ${role} can be created.`);
                return;
            }
        }
        const obj = {
            email,
            password,
            firstName,
            lastName,
            phone,
            dob,
            role,
        };
        const item = yield dbConnection_1.User.create(obj);
        if (role === "sale_person") {
            const ids = Array.isArray(createdBy)
                ? createdBy.map(Number)
                : [Number(createdBy)];
            // ✅ Connect relations
            yield item.setCreators(ids);
        }
        /** ✅ JWT Tokens */
        const { accessToken, refreshToken } = Middleware.CreateToken(String(item.getDataValue("id")), String(item.getDataValue("role")));
        yield item.update({ refreshToken });
        (0, errorMessage_1.createSuccess)(res, `${role} registered successfully`, {
            item,
            accessToken,
            // refreshToken,
        });
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong", error);
        return;
    }
});
exports.Register = Register;
const Login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body || {};
        // ✅ Validate input
        if (!email || !password) {
            (0, errorMessage_1.badRequest)(res, "Email and password are required");
            return;
        }
        // ✅ Check if user exists
        const user = yield Middleware.FindByEmail(dbConnection_1.User, email);
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
        }
        // ✅ Validate password
        const hashedPassword = user.getDataValue("password");
        const isPasswordValid = yield bcrypt_1.default.compare(password, hashedPassword);
        if (!isPasswordValid) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
        }
        // ✅ Create tokens
        const { accessToken, refreshToken } = Middleware.CreateToken(String(user.getDataValue("id")), String(user.getDataValue("role")));
        // ✅ Update refresh token in DB
        yield user.update({ refreshToken, user });
        // ✅ Respond
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            accessToken,
            refreshToken,
            user,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
        return;
    }
});
exports.Login = Login;
const GetProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const user = yield Middleware.getById(dbConnection_1.User, Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "User profile fetched successfully", user);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
        return;
    }
});
exports.GetProfile = GetProfile;
const UpdatePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { oldPassword, newPassword } = req.body || {};
        if (!oldPassword || !newPassword) {
            (0, errorMessage_1.badRequest)(res, "Please provide old password and new password");
            return;
        }
        if (oldPassword === newPassword) {
            (0, errorMessage_1.badRequest)(res, "New password must be different from the old password");
            return;
        }
        // ✅ Fetch user
        const user = yield Middleware.getById(dbConnection_1.User, Number(userData.userId));
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "User not found");
            return;
        }
        // ✅ Now TypeScript knows `user` is not null
        const isPasswordValid = yield bcrypt_1.default.compare(oldPassword, user.get("password"));
        if (!isPasswordValid) {
            (0, errorMessage_1.badRequest)(res, "Old password is incorrect");
            return;
        }
        const salt = yield bcrypt_1.default.genSalt(10);
        const newHashedPassword = yield bcrypt_1.default.hash(newPassword, salt);
        yield Middleware.Update(dbConnection_1.User, Number(userData.userId), {
            password: newHashedPassword,
        });
        (0, errorMessage_1.createSuccess)(res, "Password updated successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
        return;
    }
});
exports.UpdatePassword = UpdatePassword;
const MySalePerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, search = "", managerId } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const userData = req.userData;
        const managerID = managerId ? Number(managerId) : userData.userId;
        /** ✅ Search condition */
        const where = {};
        if (search) {
            where[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        /** ✅ Fetch created users */
        const result = yield dbConnection_1.User.findByPk(managerID, {
            include: [
                {
                    model: dbConnection_1.User,
                    as: "createdUsers",
                    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
                    through: { attributes: [] },
                    where, // ✅ apply search
                    required: false, // ✅ so user must exist even if none found
                },
            ],
        });
        if (!result) {
            (0, errorMessage_1.badRequest)(res, "User not found");
        }
        /** ✅ Extract created users */
        // let createdUsers = result?.createdUsers || [];
        let createdUsers = (result === null || result === void 0 ? void 0 : result.createdUsers) || [];
        /** ✅ Pagination manually */
        const total = createdUsers.length;
        createdUsers = createdUsers.slice(offset, offset + limitNum);
        (0, errorMessage_1.createSuccess)(res, "My sale persons", {
            page: pageNum,
            limit: limitNum,
            total,
            rows: createdUsers,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.MySalePerson = MySalePerson;
const assignSalesman = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { managerId, saleId } = req.body || {};
        if (!managerId || !saleId) {
            (0, errorMessage_1.badRequest)(res, "managerId & saleId are required");
            return;
        }
        const manager = yield dbConnection_1.User.findOne({ where: { id: managerId } });
        if (!manager) {
            (0, errorMessage_1.badRequest)(res, "Manager not found");
            return;
        }
        if (manager.role !== "manager") {
            (0, errorMessage_1.badRequest)(res, "User is not a manager");
            return;
        }
        const ids = Array.isArray(saleId) ? saleId.map(Number) : [Number(saleId)];
        yield manager.setCreatedUsers(ids);
        (0, errorMessage_1.createSuccess)(res, "Salesman assigned");
        return;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.assignSalesman = assignSalesman;
const GetAllUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { page = 1, limit = 10, search = "", role } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId; // 👈 Logged-in user ID
        const where = {
            id: { [sequelize_1.Op.ne]: loggedInId }, // ✅ Exclude logged-in user
        };
        if (role)
            where.role = role;
        // Search filter
        if (search) {
            where[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        /** ✅ Fetch Users */
        const { rows, count } = yield dbConnection_1.User.findAndCountAll({
            attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
            where,
            offset,
            limit: limitNum,
            order: [["createdAt", "DESC"]],
        });
        (0, errorMessage_1.createSuccess)(res, "Users fetched successfully", {
            page: pageNum,
            limit: limitNum,
            total: count,
            rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.GetAllUser = GetAllUser;
const AddCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category_name } = req.body || {};
        if (!category_name) {
            (0, errorMessage_1.badRequest)(res, "category name is missing");
            return;
        }
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Category, "category_name", category_name);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Category already exists");
            return;
        }
        const item = yield dbConnection_1.Category.create({ category_name });
        (0, errorMessage_1.createSuccess)(res, "category create successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
        return;
    }
});
exports.AddCategory = AddCategory;
const getcategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.query;
        const item = yield Middleware.getCategory(dbConnection_1.Category, data);
        (0, errorMessage_1.createSuccess)(res, "category list", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getcategory = getcategory;
const categoryDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category ID is missing");
            return;
        }
        const category = yield Middleware.getById(dbConnection_1.Category, Number(id));
        if (!category) {
            (0, errorMessage_1.badRequest)(res, "Category not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Category details fetched successfully", category);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.categoryDetails = categoryDetails;
const UpdateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { category_name } = req.body || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category ID is missing");
            return;
        }
        if (!category_name) {
            (0, errorMessage_1.badRequest)(res, "Category name is missing");
            return;
        }
        // ✅ Check if category with same name already exists
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Category, "category_name", category_name);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Category already exists");
            return;
        }
        const updatedCategory = yield Middleware.UpdateData(dbConnection_1.Category, id, { category_name } // Pass as object
        );
        if (!updatedCategory) {
            (0, errorMessage_1.badRequest)(res, "Category not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Category updated successfully", updatedCategory);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.UpdateCategory = UpdateCategory;
const DeleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category ID is missing");
            return;
        }
        const item = yield Middleware.DeleteItembyId(dbConnection_1.Category, Number(id));
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Category not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "category delete successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.DeleteCategory = DeleteCategory;
const getMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { page = 1, limit = 10, search = "", userId, date } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const where = {};
        if (userId)
            where.userId = userId;
        if (search) {
            where[sequelize_1.Op.or] = [
                { companyName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { personName: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        /** ✅ Filter by Date (UTC) */
        if (date) {
            const inputDate = new Date(String(date));
            const start = new Date(inputDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(inputDate);
            end.setUTCHours(23, 59, 59, 999);
            where.meetingTimeIn = {
                [sequelize_1.Op.between]: [start, end],
            };
        }
        const { rows, count } = yield dbConnection_1.Meeting.findAndCountAll({
            attributes: [
                "id",
                "companyName",
                "personName",
                "mobileNumber",
                "meetingTimeIn",
                "meetingTimeOut",
                "meetingPurpose",
            ],
            where,
            offset,
            limit: limitNum,
            order: [["createdAt", "DESC"]],
        });
        if (rows.length == 0) {
            (0, errorMessage_1.badRequest)(res, "Not meeting found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "User Meeting fetched successfully", {
            page: pageNum,
            limit: limitNum,
            total: count,
            rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.getMeeting = getMeeting;
const BulkUploads = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Correct check for multer.array()
        if (!req.files || req.files.length === 0) {
            (0, errorMessage_1.badRequest)(res, "CSV file is required");
            return;
        }
        // Multer.array("csv") → req.files is an array
        // const csvFile = (req.files as Express.Multer.File[])[0];
        // const csvFile = (req.files as { csv: MulterS3File[] }).csv[0];
        const csvFile = req.files[0];
        const s3 = new client_s3_1.S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        const params = {
            Bucket: csvFile.bucket,
            Key: csvFile.key,
        };
        const data = yield s3.send(new client_s3_1.GetObjectCommand(params));
        if (!data.Body) {
            (0, errorMessage_1.badRequest)(res, "Unable to read CSV from S3");
            return;
        }
        const stream = data.Body;
        const results = [];
        stream
            .pipe((0, csv_parser_1.default)({
            mapHeaders: ({ header }) => header.trim(),
        }))
            .on("data", (row) => {
            var _a, _b, _c, _d;
            results.push({
                companyName: ((_a = row.companyName) === null || _a === void 0 ? void 0 : _a.trim()) || "",
                personName: ((_b = row.personName) === null || _b === void 0 ? void 0 : _b.trim()) || "",
                mobileNumber: ((_c = row.mobileNumber) === null || _c === void 0 ? void 0 : _c.trim()) || "",
                companyEmail: ((_d = row.companyEmail) === null || _d === void 0 ? void 0 : _d.trim()) || "",
            });
        })
            .on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const uniqueRows = [];
                for (const r of results) {
                    const exists = yield dbConnection_1.Meeting.findOne({
                        where: {
                            companyName: r.companyName,
                            personName: r.personName,
                            mobileNumber: r.mobileNumber,
                            companyEmail: r.companyEmail,
                        },
                    });
                    // If NOT found → add to insert list
                    if (!exists) {
                        uniqueRows.push(r);
                    }
                }
                // Insert ONLY new rows
                if (uniqueRows.length > 0) {
                    yield dbConnection_1.Meeting.bulkCreate(uniqueRows);
                }
                return (0, errorMessage_1.createSuccess)(res, "Bulk upload successful", {
                    totalCSV: results.length,
                    inserted: uniqueRows.length,
                    duplicatesSkipped: results.length - uniqueRows.length,
                });
            }
            catch (err) {
                (0, errorMessage_1.badRequest)(res, "DB error: " + err);
                return;
            }
        }));
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.BulkUploads = BulkUploads;
