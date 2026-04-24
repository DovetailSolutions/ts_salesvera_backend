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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentById = exports.getDepartment = exports.addDepartment = exports.getShiftById = exports.getShift = exports.addShift = exports.getBranchById = exports.getBranch = exports.addBranch = exports.deleteCompany = exports.updateCompany = exports.getCompanyById = exports.getCompany = exports.addCompany = exports.getFuelExpense = exports.getMeetingDistance = exports.addQuotationPdf = exports.downloadQuotationPdf = exports.getQuotationPdfList = exports.getSubCategory = exports.updateSubCategory = exports.addSubCategory = exports.addQuotation = exports.ownLeave = exports.assignMeeting = exports.AttendanceBook = exports.createClient = exports.userLeave = exports.userExpense = exports.userAttendance = exports.getAttendance = exports.GetExpense = exports.leaveList = exports.UpdateExpense = exports.test = exports.approveLeave = exports.BulkUploads = exports.getMeeting = exports.DeleteCategory = exports.UpdateCategory = exports.categoryDetails = exports.getcategory = exports.AddCategory = exports.GetAllUser = exports.assignSalesman = exports.MySalePerson = exports.UpdatePassword = exports.GetProfile = exports.Login = exports.Register = void 0;
exports.updateReport = exports.getReportDetails = exports.getReport = exports.addReport = exports.getRecordSale = exports.updateInvoice = exports.getInvoice = exports.addInvoice = exports.SubCategoryStatus = exports.CategoryStatus = exports.updateClient = exports.getClient = exports.addCompanyBank = exports.getLeaveById = exports.getLeave = exports.addLeave = exports.updateQuotation = exports.getQuotationPdfList2 = exports.addQuotation2 = exports.getHolidayById = exports.getHoliday = exports.addHoliday = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const client_s3_1 = require("@aws-sdk/client-s3");
const csv_parser_1 = __importDefault(require("csv-parser"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const ejs_1 = __importDefault(require("ejs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_2 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const UNIQUE_ROLES = ["super_admin"];
const getPagination = (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
const findUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return dbConnection_2.User.findOne({
        where: { id: userId },
        attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
    });
});
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
        const isExist = yield Middleware.FindByEmail(dbConnection_2.User, email);
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, "Email already exists");
            return;
        }
        /** ✅ Check role — admin/super_admin only once in DB */
        if (UNIQUE_ROLES.includes(role)) {
            const existing = yield Middleware.findByRole(dbConnection_2.User, role);
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
        const item = yield dbConnection_2.User.create(obj);
        if ((role === "sale_person" || role === "manager" || role === "admin") && createdBy) {
            const ids = Array.isArray(createdBy)
                ? createdBy.map((id) => Number(id)).filter((id) => !isNaN(id))
                : [Number(createdBy)].filter((id) => !isNaN(id));
            if (ids.length > 0) {
                // ✅ Connect relations
                yield item.setCreators(ids);
            }
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
        // Validate input
        if (!email || !password) {
            (0, errorMessage_1.badRequest)(res, "Email and password are required");
            return;
        }
        // Find user
        const user = yield Middleware.FindByEmail(dbConnection_2.User, email);
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
            return;
        }
        // Allowed roles
        const allowedRoles = ["admin", "manager", "super_admin"];
        if (!allowedRoles.includes(user.get("role"))) {
            (0, errorMessage_1.badRequest)(res, "Access restricted. Only admin & manager can login.");
            return;
        }
        // Validate password
        const hashedPassword = user.get("password");
        const isPasswordValid = yield bcrypt_1.default.compare(password, hashedPassword);
        if (!isPasswordValid) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
            return;
        }
        // Create tokens
        const { accessToken, refreshToken } = Middleware.CreateToken(String(user.get("id")), String(user.get("role")));
        // Save refresh token
        yield user.update({ refreshToken });
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            accessToken,
            refreshToken,
            user,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.Login = Login;
const GetProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const user = yield dbConnection_2.User.findByPk(Number(userData.userId), {
            include: [
                {
                    model: dbConnection_2.Company,
                    as: "company",
                    include: [
                        {
                            model: dbConnection_2.Branch,
                            as: "branches"
                        },
                        {
                            model: dbConnection_2.Shift,
                            as: "shifts"
                        },
                        {
                            model: dbConnection_2.Department,
                            as: "departments"
                        },
                        // {
                        //   model:Holiday,
                        //   as:"holidays"
                        // },
                        {
                            model: dbConnection_2.CompanyLeave,
                            as: "companyLeaves"
                        },
                        {
                            model: dbConnection_2.CompanyBank,
                            as: "companyBanks"
                        }
                    ]
                },
            ],
        });
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
        const user = yield Middleware.getById(dbConnection_2.User, Number(userData.userId));
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
        yield Middleware.Update(dbConnection_2.User, Number(userData.userId), {
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
        const result = yield dbConnection_2.User.findByPk(managerID, {
            include: [
                {
                    model: dbConnection_2.User,
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
        const manager = yield dbConnection_2.User.findOne({ where: { id: managerId } });
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
        const { rows, count } = yield dbConnection_2.User.findAndCountAll({
            attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "createdAt",
            ],
            where,
            offset,
            limit: limitNum,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: dbConnection_2.User,
                    as: "creators",
                    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
                    through: { attributes: [] },
                    required: false,
                },
            ],
        });
        const finalRows = rows.map((user) => {
            var _a;
            const u = user.get({ plain: true });
            u.creator = ((_a = u.creators) === null || _a === void 0 ? void 0 : _a[0]) || null;
            delete u.creators;
            return u;
        });
        (0, errorMessage_1.createSuccess)(res, "Users fetched successfully", {
            page: pageNum,
            limit: limitNum,
            total: count,
            finalRows,
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
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { category_name, status } = req.body || {};
        if (!category_name) {
            (0, errorMessage_1.badRequest)(res, "category name is missing");
            return;
        }
        const isCategoryExist = yield Middleware.FindByField(dbConnection_2.Category, "category_name", category_name, loggedInId);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Category already exists");
            return;
        }
        const item = yield dbConnection_2.Category.create({
            category_name,
            adminId: loggedInId,
            managerId: loggedInId,
            status: status || "draft",
        });
        (0, errorMessage_1.createSuccess)(res, "category create successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
        return;
    }
});
exports.AddCategory = AddCategory;
const getcategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
        let ll = loggedInId; // default (admin or fallback)
        let manager = null;
        // 🔹 If logged-in user is MANAGER → fetch admin (creator)
        if (role === "manager") {
            manager = yield dbConnection_2.User.findByPk(loggedInId, {
                attributes: ["id", "role"],
                include: [
                    {
                        model: dbConnection_2.User,
                        as: "creators",
                        attributes: ["id", "role"],
                        through: { attributes: [] },
                    },
                ],
            });
            const plain = manager === null || manager === void 0 ? void 0 : manager.get({ plain: true });
            if (((_a = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                ll = plain.creators[0].id; // parent admin ID
            }
        }
        // 🔹 Continue with your category function
        const data = req.query;
        const item = yield Middleware.getCategory(dbConnection_2.Category, data, "", ll);
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
        const category = yield Middleware.getById(dbConnection_2.Category, Number(id));
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
        const { category_name, status } = req.body || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category ID is missing");
            return;
        }
        if (!category_name) {
            (0, errorMessage_1.badRequest)(res, "Category name is missing");
            return;
        }
        // ✅ Check if category with same name already exists
        const isCategoryExist = yield Middleware.FindByField(dbConnection_2.Category, "category_name", category_name, "");
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Category already exists");
            return;
        }
        const updatedCategory = yield Middleware.UpdateData(dbConnection_2.Category, id, { category_name } // Pass as object
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
        const item = yield Middleware.DeleteItembyId(dbConnection_2.Category, Number(id));
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
    var _a;
    try {
        const { page = 1, limit = 10, search = "", userId, date, empty, } = req.query;
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
        let ll = loggedInId;
        let manager = null;
        if (role === "manager") {
            manager = yield dbConnection_2.User.findByPk(loggedInId, {
                attributes: ["id", "role"],
                include: [
                    {
                        model: dbConnection_2.User,
                        as: "creators",
                        attributes: ["id", "role"],
                        through: { attributes: [] },
                    },
                ],
            });
            const plain = manager === null || manager === void 0 ? void 0 : manager.get({ plain: true });
            if (((_a = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                ll = plain.creators[0].id; // parent admin ID
            }
        }
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        // adminId:ll
        const where = {};
        if (empty === "true") {
            where.userId = null;
            where.userId = ll; // <-- correctly added to where clause
        }
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
        const { rows, count } = yield dbConnection_2.MeetingUser.findAndCountAll({
            // attributes: [
            //   "id",
            //   "companyName",
            //   "personName",
            //   "mobileNumber",
            //   "companyEmail",
            //   "meetingTimeIn",
            //   "meetingTimeOut",
            //   "meetingPurpose",
            //   "userId",
            // ],
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
            totalPages: Math.ceil(count / limitNum),
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
        const userData = req.userData;
        let loginUser = userData === null || userData === void 0 ? void 0 : userData.userId;
        // Correct check for multer.single()
        if (!req.file) {
            (0, errorMessage_1.badRequest)(res, "CSV file is required");
            return;
        }
        const csvFile = req.file;
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
            var _a, _b, _c;
            results.push({
                name: ((_a = row.name) === null || _a === void 0 ? void 0 : _a.trim()) || "",
                email: ((_b = row.email) === null || _b === void 0 ? void 0 : _b.trim()) || "",
                mobile: ((_c = row.mobile) === null || _c === void 0 ? void 0 : _c.trim()) || "",
                customerType: "existing",
                userId: loginUser,
            });
        })
            .on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const uniqueRows = [];
                for (const r of results) {
                    const exists = yield dbConnection_2.MeetingUser.findOne({
                        where: {
                            [sequelize_1.Op.or]: [{ adminId: loginUser }, { managerId: loginUser }],
                            companyName: { [sequelize_1.Op.in]: results.map((r) => r.companyName) },
                            personName: { [sequelize_1.Op.in]: results.map((r) => r.personName) },
                            mobileNumber: { [sequelize_1.Op.in]: results.map((r) => r.mobileNumber) },
                            companyEmail: { [sequelize_1.Op.in]: results.map((r) => r.companyEmail) },
                        },
                    });
                    // If NOT found → add to insert list
                    if (!exists) {
                        uniqueRows.push(r);
                    }
                }
                // Insert ONLY new rows
                if (uniqueRows.length > 0) {
                    yield dbConnection_2.MeetingUser.bulkCreate(uniqueRows);
                }
                return (0, errorMessage_1.createSuccess)(res, "Bulk upload successful", {
                    totalCSV: results.length,
                    inserted: uniqueRows.length,
                    duplicatesSkipped: results.length - uniqueRows.length,
                });
            }
            catch (err) {
                (0, errorMessage_1.badRequest)(res, "file upload error" + err);
                return;
            }
        }));
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.BulkUploads = BulkUploads;
const approveLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { employee_id, leaveID, status } = req.body;
        if (!employee_id)
            (0, errorMessage_1.badRequest)(res, "Employee id is missing");
        if (!leaveID)
            (0, errorMessage_1.badRequest)(res, "leaveID id is missing");
        const obj = {};
        if (status) {
            obj.status = status;
        }
        // Update Status
        yield dbConnection_2.Leave.update(obj, {
            where: { employee_id, id: leaveID },
        });
        if (status === "rejected") {
            yield dbConnection_2.Attendance.update({ status: "leaveReject" }, { where: { employee_id, status: "leave" } });
        }
        if (status === "approved") {
            yield dbConnection_2.Attendance.update({ status: "leaveApproved" }, { where: { employee_id, status: "leave" } });
        }
        // Fetch updated leave after update
        const updatedLeave = yield dbConnection_2.Leave.findOne({
            where: { employee_id, id: leaveID },
            attributes: ["id", "employee_id", "status"], // choose fields you need
        });
        if (!updatedLeave) {
            (0, errorMessage_1.badRequest)(res, "Leave not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Status updated", updatedLeave);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.approveLeave = approveLeave;
const test = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { page = 1, limit = 10, search = "", role } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const mainWhere = { id: loggedInId };
        const createdWhere = {};
        if (search) {
            createdWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        // Get total count
        const totalCount = yield dbConnection_2.User.count({
            where: mainWhere,
        });
        const rows = yield dbConnection_2.User.findByPk(loggedInId, {
            attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "createdAt",
            ],
            include: [
                {
                    model: dbConnection_2.User,
                    as: "createdUsers",
                    attributes: [
                        "id",
                        "firstName",
                        "lastName",
                        "email",
                        "phone",
                        "role",
                        "createdAt",
                    ],
                    through: { attributes: [] },
                    where: createdWhere,
                    required: false,
                    include: [
                        {
                            model: dbConnection_2.User,
                            as: "createdUsers",
                            attributes: [
                                "id",
                                "firstName",
                                "lastName",
                                "email",
                                "phone",
                                "role",
                                "createdAt",
                            ],
                            through: { attributes: [] },
                            where: createdWhere,
                            required: false,
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
        });
        (0, errorMessage_1.createSuccess)(res, "Users fetched successfully", {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            pages: Math.ceil(totalCount / limitNum),
            user: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.test = test;
const UpdateExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { approvedByAdmin, approvedBySuperAdmin, userId, expenseId, role } = req.body || {};
        // Validate userId
        if (!userId) {
            (0, errorMessage_1.badRequest)(res, "userId is missing");
            return;
        }
        if (!expenseId) {
            (0, errorMessage_1.badRequest)(res, "expenseId is missing");
            return;
        }
        // Get expense record
        const item = yield dbConnection_2.Expense.findOne({ where: { userId, id: expenseId } });
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Expense record not found");
            return;
        }
        // ---------- Manager Approval ----------
        if (role === "manager") {
            item.approvedByAdmin = approvedByAdmin;
            yield item.save();
            (0, errorMessage_1.createSuccess)(res, "Manager approval updated", { expense: item });
            return;
        }
        // ---------- Admin Approval ----------
        if (role === "admin") {
            // Check if manager approved first
            if (item.approvedByAdmin !== "accepted") {
                (0, errorMessage_1.badRequest)(res, "Manager must approve first before admin approval.");
                return;
            }
            item.approvedBySuperAdmin = approvedBySuperAdmin;
            yield item.save();
            (0, errorMessage_1.createSuccess)(res, "Admin approval updated", { expense: item });
            return;
        }
        (0, errorMessage_1.badRequest)(res, "Invalid role provided");
        return;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.UpdateExpense = UpdateExpense;
function getAllChildUserIds(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = new Set();
        function fetchLevel(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const user = (yield dbConnection_2.User.findByPk(id, {
                    include: [
                        {
                            model: dbConnection_2.User,
                            as: "createdUsers",
                            attributes: ["id"],
                            through: { attributes: [] },
                        },
                    ],
                }));
                if (!(user === null || user === void 0 ? void 0 : user.createdUsers))
                    return;
                for (const child of user.createdUsers) {
                    if (!result.has(child.id)) {
                        result.add(child.id);
                        yield fetchLevel(child.id); // recursive call
                    }
                }
            });
        }
        yield fetchLevel(userId);
        return Array.from(result);
    });
}
const leaveList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData.userId;
        const { status } = req.query;
        const { page, limit, offset } = getPagination(req);
        // <- status comes from query
        const childIds = yield getAllChildUserIds(loggedInId);
        const allUserIds = [loggedInId, ...childIds];
        const { rows, count } = yield dbConnection_2.User.findAndCountAll({
            where: {
                id: {
                    [sequelize_1.Op.in]: allUserIds, // include all child users
                    [sequelize_1.Op.ne]: loggedInId, // ❌ exclude logged-in user
                },
            },
            attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "createdAt",
            ],
            include: [
                {
                    model: dbConnection_2.Leave,
                    as: "Leaves",
                    required: false,
                    where: status ? { status } : undefined,
                },
            ],
            // attributes: ["id", "fromDate", "toDate", "status", "createdAt"],
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({
            success: true,
            message: "Leaves fetched successfully",
            data: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.leaveList = leaveList;
const GetExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData.userId;
        const search = req.query.search;
        const { page, limit, offset } = getPagination(req);
        const childIds = yield getAllChildUserIds(loggedInId);
        const allUserIds = [loggedInId, ...childIds];
        const { approvedByAdmin, approvedBySuperAdmin } = req.query;
        // 🔥 Build dynamic where condition
        const expenseWhere = {
            userId: { [sequelize_1.Op.in]: allUserIds },
        };
        let userWhere = {};
        if (approvedByAdmin !== undefined) {
            expenseWhere.approvedByAdmin = approvedByAdmin;
        }
        if (approvedBySuperAdmin !== undefined) {
            expenseWhere.approvedBySuperAdmin = approvedBySuperAdmin;
        }
        if (search) {
            userWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const { rows, count } = yield dbConnection_2.Expense.findAndCountAll({
            where: expenseWhere, // 👈 final merged condition
            include: [
                {
                    model: dbConnection_2.User,
                    as: "user",
                    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
                    required: false,
                    where: userWhere,
                },
            ],
            order: [["createdAt", "DESC"]],
        });
        if (rows.length === 0) {
            (0, errorMessage_1.badRequest)(res, "data not found");
        }
        res.status(200).json({
            success: true,
            message: "Expense fetched successfully",
            data: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.GetExpense = GetExpense;
// export const getAttendance = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const loggedInId = userData.userId;
//     const { page, limit, offset } = getPagination(req);
//     const childIds = await getAllChildUserIds(loggedInId);
//     const allUserIds = [loggedInId, ...childIds]; // keep full list
//     const todayStart = new Date();
//     todayStart.setHours(0, 0, 0, 0);
//     const todayEnd = new Date();
//     todayEnd.setHours(23, 59, 59, 999);
//     const leaves = await User.findAll({
//       where: {
//         id: {
//           [Op.in]: allUserIds, // include all child users
//           [Op.ne]: loggedInId, // ❌ exclude logged-in user
//         },
//       },
//       attributes: [
//         "id",
//         "firstName",
//         "lastName",
//         "email",
//         "phone",
//         "role",
//         "createdAt",
//       ],
//       include: [
//         {
//           model: Attendance,
//           as: "Attendances",
//           where: {
//             punch_in: {
//               [Op.between]: [todayStart, todayEnd],
//             },
//           },
//           required: false,
//         },
//       ],
//       order: [["createdAt", "DESC"]],
//     });
//     res.status(200).json({
//       success: true,
//       message: "Attendance fetched successfully",
//       data: leaves,
//       // pagination: {
//       //   totalRecords: count,
//       //   totalPages: Math.ceil(count / limit),
//       //   currentPage: page,
//       //   limit,
//       // },
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const getAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData.userId;
        const { page, limit, offset } = getPagination(req);
        const childIds = yield getAllChildUserIds(loggedInId);
        const allUserIds = [loggedInId, ...childIds];
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const { rows, count } = yield dbConnection_2.User.findAndCountAll({
            where: {
                id: {
                    [sequelize_1.Op.in]: allUserIds,
                    [sequelize_1.Op.ne]: loggedInId, // exclude logged-in user
                },
            },
            attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "createdAt",
            ],
            include: [
                {
                    model: dbConnection_2.Attendance,
                    as: "Attendances",
                    where: {
                        punch_in: {
                            [sequelize_1.Op.between]: [todayStart, todayEnd],
                        },
                    },
                    required: false,
                },
            ],
            offset,
            limit,
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({
            success: true,
            message: "Attendance fetched successfully",
            data: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getAttendance = getAttendance;
const getDateFilter = (query) => {
    const { startDate, endDate, lastDays, today } = query;
    const filter = {};
    //  between
    if (startDate && endDate) {
        filter[sequelize_1.Op.between] = [new Date(startDate), new Date(endDate)];
    }
    // only start date
    if (startDate) {
        filter[sequelize_1.Op.gte] = new Date(startDate);
    }
    if (endDate) {
        filter[sequelize_1.Op.lte] = new Date(endDate);
    }
    if (lastDays) {
        const now = new Date();
        const past = new Date();
        past.setDate(now.getDate() - Number(lastDays));
        filter[sequelize_1.Op.between] = [past, now];
    }
    if (today === "true") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        filter[sequelize_1.Op.between] = [start, end];
    }
    return filter;
};
const fetchData = (model, where, limit, offset, dateFilter) => __awaiter(void 0, void 0, void 0, function* () {
    return yield model.findAndCountAll({
        where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
    });
});
const userAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId)
            return (0, errorMessage_1.badRequest)(res, "UserId is required", 400);
        const { page, limit, offset } = getPagination(req);
        const dateFilter = getDateFilter(req.query);
        // const user = await findUser(Number(userId));
        // if (!user) return badRequest(res, "User not found", 404);
        const { rows, count } = yield fetchData(dbConnection_2.Attendance, { employee_id: Number(userId) }, limit, offset, dateFilter);
        (0, errorMessage_1.createSuccess)(res, "User attendance fetched successfully", {
            // user,
            attendance: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong");
    }
});
exports.userAttendance = userAttendance;
const userExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId)
            return (0, errorMessage_1.badRequest)(res, "UserId is required", 400);
        const { page, limit, offset } = getPagination(req);
        const dateFilter = getDateFilter(req.query);
        // const user = await findUser(Number(userId));
        // if (!user) return badRequest(res, "User not found", 404);
        const { rows, count } = yield fetchData(dbConnection_2.Expense, { userId: Number(userId) }, limit, offset, dateFilter);
        (0, errorMessage_1.createSuccess)(res, "User expense fetched successfully", {
            // user,
            leave: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong");
    }
});
exports.userExpense = userExpense;
const userLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId)
            return (0, errorMessage_1.badRequest)(res, "UserId is required", 400);
        const { page, limit, offset } = getPagination(req);
        // const dateFilter = getDateFilter(req.query);
        // const user = await findUser(Number(userId));
        // if (!user) return badRequest(res, "User not found", 404);
        const { rows, count } = yield fetchData(dbConnection_2.Leave, { employee_id: Number(userId) }, limit, offset
        // dateFilter
        );
        (0, errorMessage_1.createSuccess)(res, "User leave fetched successfully", {
            // user,
            leave: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong");
    }
});
exports.userLeave = userLeave;
const createClient = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.userData;
        const { name, email, mobile, companyName, panNumber, status, state, customerType, city, pincode, country, address, gstNumber } = req.body || {};
        // Only name, state, country, companyName are mandatory
        if (!name || !state || !country || !companyName) {
            (0, errorMessage_1.badRequest)(res, "name, state, country, and companyName are required");
            return;
        }
        // Duplicate check: only if email or mobile is provided
        const duplicateChecks = [];
        if (email)
            duplicateChecks.push({ email });
        if (mobile)
            duplicateChecks.push({ mobile });
        if (duplicateChecks.length > 0) {
            const isExist = yield dbConnection_2.MeetingUser.findOne({
                where: {
                    [sequelize_1.Op.or]: duplicateChecks,
                },
            });
            if (isExist) {
                (0, errorMessage_1.badRequest)(res, "Client already exists with this email or mobile");
                return;
            }
        }
        // Create new client information (MeetingUser)
        yield dbConnection_2.MeetingUser.create({
            name,
            email,
            mobile,
            userId,
            companyName,
            customerType: customerType || "new",
            state,
            city,
            pincode,
            country,
            address,
            gstNumber,
            panNumber,
            status: status || "draft"
        });
        (0, errorMessage_1.createSuccess)(res, "Client created successfully");
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, error instanceof Error ? error.message : "Something went wrong");
    }
});
exports.createClient = createClient;
const generateDayMap = (totalDays) => Object.fromEntries(Array.from({ length: totalDays }, (_, i) => [String(i + 1), "-"]));
// Build search filter
const buildSearchFilter = (search) => search
    ? {
        [sequelize_1.Op.or]: [
            { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
            { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
        ],
    }
    : {};
// =========================== MAIN FUNCTION ===============================
const AttendanceBook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.userData;
        const childIds = yield getAllChildUserIds(userId); // assuming this returns array
        if (!childIds.length)
            (0, errorMessage_1.badRequest)(res, "No child users found");
        // Query Params
        const month = Number(req.query.month) || new Date().getMonth() + 1;
        const year = Number(req.query.year) || new Date().getFullYear();
        const search = String(req.query.search || "");
        const pageNum = Number(req.query.page) || 1;
        const limitNum = Number(req.query.limit) || 10;
        const offset = (pageNum - 1) * limitNum;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const totalDays = endDate.getDate();
        // Fetch users + Attendance together (Optimized Query)
        const { rows: users, count: totalCount } = yield dbConnection_2.User.findAndCountAll({
            where: Object.assign({ id: { [sequelize_1.Op.in]: childIds } }, buildSearchFilter(search)),
            attributes: [
                "id",
                "firstName",
                "lastName",
                "role",
                "email",
                "dob",
                "profile",
            ],
            include: [
                {
                    model: dbConnection_2.Attendance,
                    as: "Attendances",
                    where: { date: { [sequelize_1.Op.between]: [startDate, endDate] } },
                    required: false,
                },
            ],
            offset,
            limit: limitNum,
            order: [["firstName", "ASC"]],
        });
        // Format response
        const formatted = users.map((u) => {
            var _a;
            const days = generateDayMap(totalDays);
            (_a = u.Attendances) === null || _a === void 0 ? void 0 : _a.forEach((a) => {
                var _a;
                const start = new Date(a.date).getDate();
                const end = new Date(a.punch_in).getDate();
                for (let i = start; i <= end; i++)
                    days[String(i)] = (_a = a.status) !== null && _a !== void 0 ? _a : "-";
            });
            return {
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
                email: u.email,
                dob: u.dob,
                profile: u.profile,
                role: u.role,
                days,
            };
        });
        res.status(200).json({
            success: true,
            message: "Attendance loaded",
            data: { page: pageNum, limit: limitNum, totalCount, users: formatted },
        });
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, error.message);
    }
});
exports.AttendanceBook = AttendanceBook;
const assignMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, meetingId, scheduledTime } = req.body || {};
        // Validate required fields
        if (!userId || !meetingId || !scheduledTime) {
            (0, errorMessage_1.badRequest)(res, "userId, meetingId and scheduledTime are required");
            return;
        }
        // Check meeting exists
        const meeting = yield dbConnection_2.Meeting.findOne({ where: { id: meetingId } });
        if (!meeting) {
            (0, errorMessage_1.badRequest)(res, "Meeting not found");
            return;
        }
        // If meeting is already assigned & scheduled time conflicts
        if (meeting.userId) {
            const existingTime = new Date(meeting.scheduledTime);
            const newTime = new Date(scheduledTime);
            if (existingTime.getTime() === newTime.getTime()) {
                (0, errorMessage_1.badRequest)(res, "This meeting is already scheduled at this time");
                return;
            }
        }
        // Create new meeting entry (assign to employee)
        yield dbConnection_2.Meeting.create({
            userId,
            meetingUserId: meeting.meetingUserId,
            companyId: meeting.companyId,
            categoryId: meeting.categoryId,
            meetingPurpose: meeting.meetingPurpose,
            scheduledTime,
            status: "scheduled",
        });
        (0, errorMessage_1.createSuccess)(res, "Meeting scheduled successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.assignMeeting = assignMeeting;
const ownLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { page, limit, offset } = getPagination(req);
        const { rows, count } = yield dbConnection_2.Leave.findAndCountAll({
            where: { employee_id: Number(userData === null || userData === void 0 ? void 0 : userData.userId) },
            limit,
            offset,
            order: [["id", "DESC"]],
        });
        if (rows.length === 0) {
            (0, errorMessage_1.badRequest)(res, "No leaves found");
        }
        (0, errorMessage_1.createSuccess)(res, "Leave fetched successfully", {
            leave: rows,
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.ownLeave = ownLeave;
const addQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { quotationNumber, userId, clientName, clientEmail, clientPhone, totalAmount, validTill, notes } = req.body;
        // 1️⃣ Basic Validation
        if (!userId) {
            (0, errorMessage_1.badRequest)(res, "UserId is required");
        }
        if (!clientName) {
            (0, errorMessage_1.badRequest)(res, "Client name is required");
        }
        if (!totalAmount) {
            (0, errorMessage_1.badRequest)(res, "Total amount is required");
        }
        // 2️⃣ Duplicate quotation check
        // if (quotationNumber) {
        //   const existingQuotation = await Quotation.findOne({
        //     where: { quotationNumber }
        //   });
        //   if (existingQuotation) {
        //     badRequest(res, "Quotation number already exists");
        //   }
        // }
        // // 3️⃣ Auto Generate Quotation Number (if not provided)
        // let finalQuotationNumber = quotationNumber;
        // if (!finalQuotationNumber) {
        //   const count = await Quotation.count();
        //   finalQuotationNumber = `QT-${Date.now()}-${count + 1}`;
        // }
        // 4️⃣ Create quotation
        // const quotation = await Quotation.create({
        //   quotationNumber: finalQuotationNumber,
        //   userId,
        //   clientName,
        //   clientEmail,
        //   clientPhone,
        //   totalAmount,
        //   validTill,
        //   notes
        // });
        // 5️⃣ Success response
        // createSuccess(res, "Quotation created successfully", quotation);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.addQuotation = addQuotation;
const addSubCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!loggedInId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { sub_category_name, amount, tax, status, CategoryId } = req.body;
        if (!(sub_category_name === null || sub_category_name === void 0 ? void 0 : sub_category_name.trim())) {
            (0, errorMessage_1.badRequest)(res, "Sub category name is required");
            return;
        }
        if (!CategoryId) {
            (0, errorMessage_1.badRequest)(res, "CategoryId is required");
            return;
        }
        const cleanName = sub_category_name.trim();
        const existingSubCategory = yield dbConnection_2.SubCategory.findOne({
            where: {
                sub_category_name: cleanName,
                CategoryId: CategoryId,
            },
        });
        if (existingSubCategory) {
            (0, errorMessage_1.badRequest)(res, "Sub category already exists");
            return;
        }
        const subCategory = yield dbConnection_2.SubCategory.create({
            sub_category_name: cleanName,
            CategoryId,
            adminId: loggedInId,
            managerId: loggedInId,
            amount: amount !== null && amount !== void 0 ? amount : null,
            text: tax !== null && tax !== void 0 ? tax : null,
            status: status || "draft",
        });
        (0, errorMessage_1.createSuccess)(res, "Sub category created successfully", subCategory);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.addSubCategory = addSubCategory;
const updateSubCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!loggedInId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "SubCategory id is required");
            return;
        }
        const { sub_category_name, amount, tax, CategoryId } = req.body;
        // Check if subcategory exists
        const existingSubCategory = yield dbConnection_2.SubCategory.findByPk(id);
        if (!existingSubCategory) {
            (0, errorMessage_1.badRequest)(res, "Sub category not found");
            return;
        }
        const object = {};
        if (sub_category_name !== undefined) {
            object.sub_category_name = sub_category_name.trim();
        }
        if (amount !== undefined) {
            object.amount = amount;
        }
        if (tax !== undefined) {
            object.text = tax; // or text (based on your schema)
        }
        if (CategoryId !== undefined) {
            object.CategoryId = CategoryId;
        }
        object.managerId = loggedInId;
        // Duplicate check ONLY if name is being updated
        if (sub_category_name !== undefined) {
            const cleanName = sub_category_name.trim();
            const duplicate = yield dbConnection_2.SubCategory.findOne({
                where: {
                    sub_category_name: cleanName,
                    CategoryId: CategoryId !== null && CategoryId !== void 0 ? CategoryId : existingSubCategory.CategoryId,
                    id: { [sequelize_1.Op.ne]: id },
                },
            });
            if (duplicate) {
                (0, errorMessage_1.badRequest)(res, "Sub category already exists");
                return;
            }
        }
        // Update using instance (better approach)
        yield existingSubCategory.update(object);
        (0, errorMessage_1.createSuccess)(res, "Sub category updated successfully", existingSubCategory);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.updateSubCategory = updateSubCategory;
const getSubCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category id is required");
            return;
        }
        const where = {
            CategoryId: id,
        };
        if (req.query.status) {
            where.status = req.query.status;
        }
        const subCategory = yield dbConnection_2.SubCategory.findAll({
            where,
        });
        // 🔥 Transform "text" → "tax"
        const formattedData = subCategory.map((item) => {
            const obj = item.toJSON();
            return Object.assign(Object.assign({}, obj), { tax: obj.text, text: undefined });
        });
        (0, errorMessage_1.createSuccess)(res, "Sub category list fetched successfully", formattedData);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getSubCategory = getSubCategory;
const getQuotationPdfList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        console.log("userData", userData);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { count, rows } = yield dbConnection_2.Quotations.findAndCountAll({
            where: {
            // userId: userData.userId
            },
            include: [
                {
                    model: dbConnection_2.User,
                    as: "User",
                    attributes: ["id", "firstName"],
                    include: [
                        {
                            model: dbConnection_2.User,
                            as: "creators",
                            attributes: ["id", "firstName"],
                            required: true, // ✅ IMPORTANT (INNER JOIN)
                            where: {
                                id: userData.userId, // ✅ MATCH HERE
                            },
                            through: {
                                attributes: [], // optional (hide pivot)
                            },
                        },
                    ],
                },
            ],
            // include: [
            //   {
            //     model: User,
            //     as: "User",
            //     attributes: ["id", "firstName"],
            //     include: [
            //       {
            //         model: User,
            //         as: "creators",
            //         attributes: ["id", "firstName"],
            //         include:[
            //           {
            //             model: User,
            //             as: "creators",
            //             attributes: ["id", "firstName"],
            //           }
            //         ]
            //       },
            //     ],
            //   },
            // ],
            order: [["createdAt", "DESC"]],
            limit: limit,
            offset: offset
        });
        (0, errorMessage_1.createSuccess)(res, "Quotation list fetched successfully", {
            total: count,
            page: page,
            totalPages: Math.ceil(count / limit),
            data: rows
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getQuotationPdfList = getQuotationPdfList;
const downloadQuotationPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        // ─── Fetch quotation record ────────────────────────────────────────────
        const quotation = yield dbConnection_2.Quotations.findByPk(id);
        if (!quotation) {
            (0, errorMessage_1.badRequest)(res, "Quotation not found");
            return;
        }
        const data = quotation.quotation;
        // ─── Shared calculations ───────────────────────────────────────────────
        const subtotal = ((_a = data.items) !== null && _a !== void 0 ? _a : []).reduce((sum, item) => {
            return sum + Number(item.amount || 0);
        }, 0);
        const discount = Number(data.discount || 0);
        const taxableAmount = subtotal - discount;
        const gstAmount = (taxableAmount * Number(data.gstRate || 0)) / 100;
        const finalAmount = taxableAmount + gstAmount;
        // ─── ?mode=details → return JSON details ──────────────────────────────
        if (req.query.mode === "details") {
            (0, errorMessage_1.createSuccess)(res, "Quotation details fetched successfully", {
                id: quotation.id,
                userId: quotation.userId,
                companyId: quotation.companyId,
                status: quotation.status,
                createdAt: quotation.createdAt,
                updatedAt: quotation.updatedAt,
                quotation: Object.assign(Object.assign({}, data), { subtotal,
                    discount,
                    taxableAmount,
                    gstAmount,
                    finalAmount })
            });
            return;
        }
        // ─── Default → generate & stream PDF ──────────────────────────────────
        const toBase64 = (filePath) => {
            var _a;
            try {
                if (fs_1.default.existsSync(filePath)) {
                    const ext = (_a = filePath.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
                    const buf = fs_1.default.readFileSync(filePath);
                    return `data:${mime};base64,${buf.toString("base64")}`;
                }
            }
            catch (_) { }
            return "";
        };
        const logo = toBase64(path_1.default.join(__dirname, "../../../uploads/images/logo.jpeg"));
        const signature = toBase64(path_1.default.join(__dirname, "../../../uploads/signature.png"));
        const stamp = toBase64(path_1.default.join(__dirname, "../../../uploads/stamp.png"));
        const filePath = path_1.default.join(__dirname, "../../ejs/preview.ejs");
        const html = yield ejs_1.default.renderFile(filePath, Object.assign(Object.assign({}, data), { logo,
            signature,
            stamp,
            subtotal,
            discount,
            taxableAmount,
            gstAmount,
            finalAmount }));
        const browser = yield puppeteer_1.default.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        const page = yield browser.newPage();
        yield page.setContent(html, { waitUntil: "load" });
        const pdfBuffer = yield page.pdf({
            format: "a4",
            printBackground: true,
            margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
        });
        yield browser.close();
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=quotation-${data.quotationNumber || id}.pdf`
        });
        res.send(pdfBuffer);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.downloadQuotationPdf = downloadQuotationPdf;
// export const addQuotationPdf = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     if (!userData || !userData.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const data = req.body;
//     // ✅ Helper: Convert image → base64
//     const toBase64 = (filePath: string): string => {
//       try {
//         if (fs.existsSync(filePath)) {
//           const ext = filePath.split(".").pop()?.toLowerCase();
//           const mime =
//             ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
//           const buf = fs.readFileSync(filePath);
//           return `data:${mime};base64,${buf.toString("base64")}`;
//         }
//       } catch (_) {}
//       return "";
//     };
//     const logo = toBase64(
//       path.join(__dirname, "../../../uploads/images/logo.jpeg")
//     );
//     const signature = toBase64(
//       path.join(__dirname, "../../../uploads/signature.png")
//     );
//     const stamp = toBase64(
//       path.join(__dirname, "../../../uploads/stamp.png")
//     );
//     // ✅ GST State
//     const ownstate = String(data.ownstate || "").toLowerCase();
//     const clientState = String(data.clientState || "").toLowerCase();
//     // ✅ Calculations
//     const subtotal = data.items.reduce((sum: number, item: any) => {
//       return sum + Number(item.amount || 0);
//     }, 0);
//     const discount = Number(data.discount || 0);
//     const taxableAmount = subtotal - discount;
//     const gstRate = Number(data.gstRate || 0);
//     const totalGST = (taxableAmount * gstRate) / 100;
//     let cgst = 0;
//     let sgst = 0;
//     let igst = 0;
//     // ✅ GST Logic (India)
//     if (ownstate && clientState && ownstate === clientState) {
//       cgst = totalGST / 2;
//       sgst = totalGST / 2;
//     } else {
//       igst = totalGST;
//     }
//     const finalAmount = taxableAmount + totalGST;
//     // ✅ Render EJS
//     const filePath = path.join(__dirname, "../../ejs/preview.ejs");
//     const html = await ejs.renderFile(filePath, {
//       ...data,
//       logo,
//       signature,
//       stamp,
//       subtotal,
//       discount,
//       taxableAmount,
//       gstRate,
//       cgst,
//       sgst,
//       igst,
//       totalGST,
//       finalAmount
//     });
//     // ✅ Save to DB
//     await Quotations.create({
//       userId: Number(userData?.userId),
//       companyId: data.companyId || 0,
//       quotation: data,
//       status: "draft"
//     });
//     // ✅ Puppeteer
//     const browser = await puppeteer.launch({
//       args: ["--no-sandbox", "--disable-setuid-sandbox"]
//     });
//     const page = await browser.newPage();
//     await page.setContent(html as string, { waitUntil: "load" });
//     const pdfBuffer = await page.pdf({
//       format: "a4",
//       printBackground: true,
//       margin: {
//         top: "20mm",
//         bottom: "20mm",
//         left: "15mm",
//         right: "15mm"
//       }
//     });
//     await browser.close();
//     res.set({
//       "Content-Type": "application/pdf",
//       "Content-Disposition": `attachment; filename=quotation-${data.quotationNumber}.pdf`
//     });
//     res.send(pdfBuffer);
//   } catch (error) {
//     res.status(400).json({ error: "Something went wrong" });
//   }
// };
const generateQuotationNumber = () => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield dbConnection_2.Quotations.count();
    const serial = count + 1;
    return String(serial).padStart(10, '0');
});
const addQuotationPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const data = req.body;
        // ✅ Auto-generate serial 10-digit quotation number
        const quotationNumber = yield generateQuotationNumber();
        // ✅ Helper: Convert image → base64
        const toBase64 = (filePath) => {
            var _a;
            try {
                if (fs_1.default.existsSync(filePath)) {
                    const ext = (_a = filePath.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
                    const buf = fs_1.default.readFileSync(filePath);
                    return `data:${mime};base64,${buf.toString("base64")}`;
                }
            }
            catch (_) { }
            return "";
        };
        const logo = toBase64(path_1.default.join(__dirname, "../../../uploads/images/logo.jpeg"));
        const signature = toBase64(path_1.default.join(__dirname, "../../../uploads/signature.png"));
        const stamp = toBase64(path_1.default.join(__dirname, "../../../uploads/stamp.png"));
        // ✅ GST State
        const ownstate = String(data.ownstate || "").toLowerCase();
        const clientState = String(data.clientState || "").toLowerCase();
        // ✅ Item-level calculations (India GST compliant)
        const isService = String(data.type || '').toLowerCase() === 'service';
        // Step 1: Compute per-item values
        const itemCalcs = data.items.map((item) => {
            const qty = Number(item.quantity || item.qty || 1);
            const rate = Number(item.rate || 0);
            const discPct = Number(item.discount || item.discountPercent || 0);
            const gstPct = Number(item.gst || item.gstPercent || 0);
            // Services → rate is amount for one unit; Items → qty × rate
            const itemTotal = isService ? rate : qty * rate;
            const discAmt = (itemTotal * discPct) / 100;
            const taxable = itemTotal - discAmt;
            const gstAmt = (taxable * gstPct) / 100;
            return { itemTotal, discAmt, taxable, gstAmt };
        });
        // Step 2: Aggregate summary from item-level values
        const subtotal = itemCalcs.reduce((s, i) => s + i.itemTotal, 0);
        const totalDiscount = itemCalcs.reduce((s, i) => s + i.discAmt, 0);
        const taxableAmount = subtotal - totalDiscount;
        const totalGST = itemCalcs.reduce((s, i) => s + i.gstAmt, 0);
        const finalAmount = taxableAmount + totalGST;
        // Step 3: CGST / SGST / IGST split
        const gstRate = Number(data.gstRate || 0);
        let cgst = 0, sgst = 0, igst = 0;
        if (ownstate && clientState && ownstate === clientState) {
            // Intra-state → split equally
            cgst = totalGST / 2;
            sgst = totalGST / 2;
        }
        else {
            // Inter-state → IGST
            igst = totalGST;
        }
        // Alias for EJS template
        const discount = totalDiscount;
        // ✅ Render EJS
        const filePath = path_1.default.join(__dirname, "../../ejs/preview.ejs");
        const html = yield ejs_1.default.renderFile(filePath, Object.assign(Object.assign({}, data), { quotationNumber,
            logo,
            signature,
            stamp,
            subtotal,
            discount,
            taxableAmount,
            gstRate,
            cgst,
            sgst,
            igst,
            totalGST,
            finalAmount }));
        // ✅ Save to DB
        // await Quotations.create({
        //   userId: Number(userData?.userId),
        //   companyId: data.companyId || 0,
        //   quotation: { ...data, quotationNumber },
        //   status: "draft"
        // });
        // ✅ Puppeteer — generate PDF
        const browser = yield puppeteer_1.default.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        const page = yield browser.newPage();
        yield page.setContent(html, { waitUntil: "load" });
        const pdfBuffer = yield page.pdf({
            format: "a4",
            printBackground: true,
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        });
        yield browser.close();
        // ✅ Save PDF to uploads/pdf/
        const pdfFileName = `quotation-${quotationNumber}.pdf`;
        const pdfDir = path_1.default.join(__dirname, "../../../uploads/pdf");
        const pdfFilePath = path_1.default.join(pdfDir, pdfFileName);
        if (!fs_1.default.existsSync(pdfDir))
            fs_1.default.mkdirSync(pdfDir, { recursive: true });
        fs_1.default.writeFileSync(pdfFilePath, pdfBuffer);
        // ✅ Build public download URL
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const pdfUrl = `/uploads/pdf/${pdfFileName}`;
        // ✅ Return JSON with download link
        res.status(200).json({
            success: true,
            message: "Quotation PDF generated successfully",
            data: {
                quotationNumber,
                pdfUrl,
                summary: {
                    subtotal: +subtotal.toFixed(2),
                    discount: +discount.toFixed(2),
                    taxableAmount: +taxableAmount.toFixed(2),
                    cgst: +cgst.toFixed(2),
                    sgst: +sgst.toFixed(2),
                    igst: +igst.toFixed(2),
                    totalGST: +totalGST.toFixed(2),
                    finalAmount: +finalAmount.toFixed(2)
                }
            }
        });
    }
    catch (error) {
        res.status(400).json({ error: "Something went wrong" });
    }
});
exports.addQuotationPdf = addQuotationPdf;
const getMeetingDistance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        // Pagination params
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const userId = Number(req.query.userId);
        const offset = (page - 1) * limit;
        // Date filters
        const { startDate, endDate } = req.query;
        const whereCondition = {
            userId: userId,
        };
        // Apply date filter if provided
        if (startDate && endDate) {
            whereCondition.createdAt = {
                [sequelize_1.Op.between]: [
                    new Date(startDate),
                    new Date(endDate),
                ],
            };
        }
        const { count, rows } = yield dbConnection_2.Meeting.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        (0, errorMessage_1.createSuccess)(res, "Meeting distances fetched successfully", {
            totalRecords: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            meetings: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getMeetingDistance = getMeetingDistance;
const getFuelExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const userId = Number(req.query.userId);
        const { startDate, endDate } = req.query;
        const whereCondition = {
            userId: userId,
        };
        if (startDate && endDate) {
            whereCondition.createdAt = {
                [sequelize_1.Op.between]: [
                    new Date(startDate),
                    new Date(endDate),
                ],
            };
        }
        const data = yield dbConnection_2.Meeting.findAll({
            where: whereCondition,
            attributes: [
                [(0, sequelize_1.fn)("DATE", (0, sequelize_1.col)("createdAt")), "date"],
                [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("id")), "totalRecords"],
                [
                    (0, sequelize_1.fn)("COALESCE", (0, sequelize_1.fn)("SUM", (0, sequelize_1.cast)((0, sequelize_1.col)("legDistance"), "DOUBLE PRECISION")), 0),
                    "totalDistance",
                ],
            ],
            group: [(0, sequelize_1.fn)("DATE", (0, sequelize_1.col)("createdAt"))],
            order: [[(0, sequelize_1.fn)("DATE", (0, sequelize_1.col)("createdAt")), "DESC"]],
        });
        (0, errorMessage_1.createSuccess)(res, "Grouped fuel expense by date", data);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getFuelExpense = getFuelExpense;
const addCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { companyName, legalName, registrationNo, gst, pan, industry, companySize, website, companyEmail, companyPhone, city, timezone, currency, 
        // Bank
        bankAccountHolder, bankName, bankAccountNumber, bankIfsc, bankBranchName, bankAccountType, bankMicr, upiId, 
        // HR Config
        payrollCycle, lateMarkAfter, autoHalfDayAfter, casualHolidaysTotal, casualHolidaysPerMonth, casualHolidayNotice, compOffMinHours, compOffExpiryDays, casualCarryForwardLimit, casualCarryForwardExpiry, adminId, managerId, } = req.body;
        // ================= VALIDATION =================
        if (!companyName || companyName.trim().length < 2) {
            (0, errorMessage_1.badRequest)(res, "Company name is required (min 2 chars)");
            return;
        }
        if (!legalName) {
            (0, errorMessage_1.badRequest)(res, "Legal name is required");
            return;
        }
        if (!registrationNo) {
            (0, errorMessage_1.badRequest)(res, "Registration number is required");
            return;
        }
        if (!companyEmail || !/^\S+@\S+\.\S+$/.test(companyEmail)) {
            (0, errorMessage_1.badRequest)(res, "Valid company email is required");
            return;
        }
        if (!companyPhone || companyPhone.length < 8) {
            (0, errorMessage_1.badRequest)(res, "Valid company phone is required");
            return;
        }
        if (gst && gst.length !== 15) {
            (0, errorMessage_1.badRequest)(res, "GST must be 15 characters");
            return;
        }
        if (pan && pan.length !== 10) {
            (0, errorMessage_1.badRequest)(res, "PAN must be 10 characters");
            return;
        }
        if (website && !/^https?:\/\/.+/.test(website)) {
            (0, errorMessage_1.badRequest)(res, "Website must be a valid URL");
            return;
        }
        if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
            (0, errorMessage_1.badRequest)(res, "Invalid IFSC code");
            return;
        }
        if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId)) {
            (0, errorMessage_1.badRequest)(res, "Invalid UPI ID");
            return;
        }
        // HR numeric validations
        const numericFields = [
            { field: lateMarkAfter, name: "lateMarkAfter" },
            { field: autoHalfDayAfter, name: "autoHalfDayAfter" },
            { field: casualHolidaysTotal, name: "casualHolidaysTotal" },
            { field: casualHolidaysPerMonth, name: "casualHolidaysPerMonth" },
            { field: casualHolidayNotice, name: "casualHolidayNotice" },
            { field: compOffMinHours, name: "compOffMinHours" },
            { field: compOffExpiryDays, name: "compOffExpiryDays" },
            { field: casualCarryForwardLimit, name: "casualCarryForwardLimit" },
            { field: casualCarryForwardExpiry, name: "casualCarryForwardExpiry" },
        ];
        for (const item of numericFields) {
            if (item.field && isNaN(Number(item.field))) {
                (0, errorMessage_1.badRequest)(res, `${item.name} must be a number`);
                return;
            }
        }
        // ================= CREATE =================
        const company = yield dbConnection_2.Company.create({
            companyName,
            legalName,
            registrationNo,
            gst,
            pan,
            industry,
            companySize,
            website,
            companyEmail,
            companyPhone,
            city,
            timezone,
            currency,
            bankAccountHolder,
            bankName,
            bankAccountNumber,
            bankIfsc,
            bankBranchName,
            bankAccountType,
            bankMicr,
            upiId,
            payrollCycle,
            lateMarkAfter,
            autoHalfDayAfter,
            casualHolidaysTotal,
            casualHolidaysPerMonth,
            casualHolidayNotice,
            compOffMinHours,
            compOffExpiryDays,
            casualCarryForwardLimit,
            casualCarryForwardExpiry,
            userId: userData.userId,
            adminId: adminId || null,
            managerId: managerId || null
        });
        (0, errorMessage_1.createSuccess)(res, "Company added successfully", company);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addCompany = addCompany;
const getCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // ✅ Search
        const search = req.query.search || "";
        let whereCondition = {
            userId: userData.userId,
        };
        if (search) {
            whereCondition = Object.assign(Object.assign({}, whereCondition), { [sequelize_1.Op.or]: [
                    { companyName: { [sequelize_1.Op.like]: `%${search}%` } },
                    { legalName: { [sequelize_1.Op.like]: `%${search}%` } },
                    { companyEmail: { [sequelize_1.Op.like]: `%${search}%` } },
                    { companyPhone: { [sequelize_1.Op.like]: `%${search}%` } },
                ] });
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Company.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ Response
        (0, errorMessage_1.createSuccess)(res, "Company fetched successfully", {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getCompany = getCompany;
const getCompanyById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Company id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Company id must be a number");
        }
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const company = yield dbConnection_2.Company.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!company) {
            return (0, errorMessage_1.badRequest)(res, "Company not found");
        }
        (0, errorMessage_1.createSuccess)(res, "Company fetched successfully", company);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getCompanyById = getCompanyById;
const updateCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Company id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Company id must be a number");
        }
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const company = yield dbConnection_2.Company.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!company) {
            return (0, errorMessage_1.badRequest)(res, "Company not found");
        }
        const updatedCompany = yield company.update(req.body);
        (0, errorMessage_1.createSuccess)(res, "Company updated successfully", updatedCompany);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateCompany = updateCompany;
const deleteCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Company id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Company id must be a number");
        }
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const company = yield dbConnection_2.Company.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!company) {
            return (0, errorMessage_1.badRequest)(res, "Company not found");
        }
        yield company.destroy();
        (0, errorMessage_1.createSuccess)(res, "Company deleted successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.deleteCompany = deleteCompany;
const addBranch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const { branchName, branchCode, branchCity, branchState, branchCountry, postalCode, addressLine1, addressLine2, branchEmail, branchPhone, latitude, longitude, geoRadius, adminId, managerId, companyId, } = req.body;
        // ================= VALIDATIONS =================
        if (!branchName || branchName.trim().length < 2) {
            return (0, errorMessage_1.badRequest)(res, "Branch name is required (min 2 chars)");
        }
        if (!branchCode || branchCode.trim().length < 2) {
            return (0, errorMessage_1.badRequest)(res, "Branch code is required");
        }
        if (!branchCity) {
            return (0, errorMessage_1.badRequest)(res, "Branch city is required");
        }
        if (!branchState) {
            return (0, errorMessage_1.badRequest)(res, "Branch state is required");
        }
        if (!branchCountry) {
            return (0, errorMessage_1.badRequest)(res, "Branch country is required");
        }
        if (!postalCode || postalCode.length < 4) {
            return (0, errorMessage_1.badRequest)(res, "Valid postal code is required");
        }
        if (!addressLine1) {
            return (0, errorMessage_1.badRequest)(res, "Address Line 1 is required");
        }
        if (!branchEmail || !/^\S+@\S+\.\S+$/.test(branchEmail)) {
            return (0, errorMessage_1.badRequest)(res, "Valid branch email is required");
        }
        if (!branchPhone || branchPhone.length < 8) {
            return (0, errorMessage_1.badRequest)(res, "Valid branch phone is required");
        }
        // Latitude: -90 to 90
        if (latitude === undefined ||
            isNaN(Number(latitude)) ||
            Number(latitude) < -90 ||
            Number(latitude) > 90) {
            return (0, errorMessage_1.badRequest)(res, "Latitude must be between -90 and 90");
        }
        // Longitude: -180 to 180
        if (longitude === undefined ||
            isNaN(Number(longitude)) ||
            Number(longitude) < -180 ||
            Number(longitude) > 180) {
            return (0, errorMessage_1.badRequest)(res, "Longitude must be between -180 and 180");
        }
        if (geoRadius === undefined ||
            isNaN(Number(geoRadius)) ||
            Number(geoRadius) <= 0) {
            return (0, errorMessage_1.badRequest)(res, "Geo radius must be a positive number");
        }
        if (adminId && isNaN(Number(adminId))) {
            return (0, errorMessage_1.badRequest)(res, "adminId must be a number");
        }
        if (managerId && isNaN(Number(managerId))) {
            return (0, errorMessage_1.badRequest)(res, "managerId must be a number");
        }
        // ================= DUPLICATE CHECK =================
        // const existingBranch = await Branch.findOne({
        //   where: { branchCode },
        // });
        // if (existingBranch) {
        //   return badRequest(res, "Branch already exists with this code");
        // }
        // ================= CREATE =================
        const branch = yield dbConnection_2.Branch.create({
            branchName,
            branchCode,
            branchCity,
            branchState,
            branchCountry,
            postalCode,
            addressLine1,
            addressLine2: addressLine2 || null,
            branchEmail,
            branchPhone,
            latitude: Number(latitude),
            longitude: Number(longitude),
            geoRadius: Number(geoRadius),
            adminId: adminId || null,
            managerId: managerId || null,
            userId: userData.userId,
            companyId: companyId || null,
        });
        (0, errorMessage_1.createSuccess)(res, "Branch added successfully", branch);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addBranch = addBranch;
const getBranch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // ✅ Search
        const search = req.query.search || "";
        let whereCondition = {
            userId: userData.userId,
        };
        if (search) {
            whereCondition = Object.assign(Object.assign({}, whereCondition), { [sequelize_1.Op.or]: [
                    { branchName: { [sequelize_1.Op.like]: `%${search}%` } },
                    { branchCode: { [sequelize_1.Op.like]: `%${search}%` } },
                    { branchCity: { [sequelize_1.Op.like]: `%${search}%` } },
                    { branchState: { [sequelize_1.Op.like]: `%${search}%` } },
                    { branchCountry: { [sequelize_1.Op.like]: `%${search}%` } },
                    { postalCode: { [sequelize_1.Op.like]: `%${search}%` } },
                    { addressLine1: { [sequelize_1.Op.like]: `%${search}%` } },
                    { addressLine2: { [sequelize_1.Op.like]: `%${search}%` } },
                    { branchEmail: { [sequelize_1.Op.like]: `%${search}%` } },
                    { branchPhone: { [sequelize_1.Op.like]: `%${search}%` } },
                ] });
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Branch.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ Response
        (0, errorMessage_1.createSuccess)(res, "Branch fetched successfully", {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getBranch = getBranch;
const getBranchById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Branch id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Branch id must be a number");
        }
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const branch = yield dbConnection_2.Branch.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!branch) {
            return (0, errorMessage_1.badRequest)(res, "Branch not found");
        }
        (0, errorMessage_1.createSuccess)(res, "Branch fetched successfully", branch);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getBranchById = getBranchById;
const addShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const { shiftName, shiftCode, startTime, endTime, breakMinutes, workingHours, lateMarkAfter, halfDayAfter, branchId, companyId, } = req.body;
        // ================= VALIDATION =================
        // if (!shiftName || shiftName.trim().length < 2) {
        //   return badRequest(res, "Shift name is required");
        // }
        // if (!shiftCode || shiftCode.trim().length < 2) {
        //   return badRequest(res, "Shift code is required");
        // }
        // if (!startTime || !endTime) {
        //   return badRequest(res, "Start time and end time are required");
        // }
        // if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
        //   return badRequest(res, "Time must be in HH:mm format");
        // }
        // if (breakMinutes && isNaN(Number(breakMinutes))) {
        //   return badRequest(res, "Break minutes must be number");
        // }
        // if (workingHours && isNaN(Number(workingHours))) {
        //   return badRequest(res, "Working hours must be number");
        // }
        // if (lateMarkAfter && isNaN(Number(lateMarkAfter))) {
        //   return badRequest(res, "lateMarkAfter must be number");
        // }
        // if (halfDayAfter && isNaN(Number(halfDayAfter))) {
        //   return badRequest(res, "halfDayAfter must be number");
        // }
        // if (!branchId || isNaN(Number(branchId))) {
        //   return badRequest(res, "Valid branchId is required");
        // }
        // if (!companyId || isNaN(Number(companyId))) {
        //   return badRequest(res, "Valid companyId is required");
        // }
        // ================= DUPLICATE =================
        // const existing = await Shift.findOne({
        //   where: { shiftCode },
        // });
        // if (existing) {
        //   return badRequest(res, "Shift already exists with this code");
        // }
        // ================= CREATE =================
        const shift = yield dbConnection_2.Shift.create({
            shiftName,
            shiftCode,
            startTime,
            endTime,
            // breakMinutes: breakMinutes || 0,
            // workingHours: workingHours || 8,
            // lateMarkAfter: lateMarkAfter || 0,
            // halfDayAfter: halfDayAfter || 0,
            branchId,
            companyId,
            userId: userData.userId,
        });
        (0, errorMessage_1.createSuccess)(res, "Shift added successfully", shift);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addShift = addShift;
const getShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        // ✅ Search
        const search = req.query.search || "";
        // ✅ Filters (optional but useful)
        const branchId = req.query.branchId;
        const companyId = req.query.companyId;
        let whereCondition = {
            userId: userData.userId,
        };
        // 🔍 Search condition
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { shiftName: { [sequelize_1.Op.like]: `%${search}%` } },
                { shiftCode: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        // 🎯 Optional filters
        if (branchId) {
            whereCondition.branchId = branchId;
        }
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Shift.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ Response
        (0, errorMessage_1.createSuccess)(res, "Shifts fetched successfully", {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getShift = getShift;
const getShiftById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Shift id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Shift id must be a number");
        }
        const shift = yield dbConnection_2.Shift.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!shift) {
            return (0, errorMessage_1.badRequest)(res, "Shift not found");
        }
        (0, errorMessage_1.createSuccess)(res, "Shift fetched successfully", shift);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getShiftById = getShiftById;
const addDepartment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const { deptName, deptCode, deptHead, branchId, shiftId, maxHeadcount, halfSaturday, adminId, managerId, companyId, } = req.body;
        // ================= VALIDATION =================
        if (!deptName || deptName.trim().length < 2) {
            return (0, errorMessage_1.badRequest)(res, "Department name is required");
        }
        if (!deptCode || deptCode.trim().length < 2) {
            return (0, errorMessage_1.badRequest)(res, "Department code is required");
        }
        if (!deptHead || deptHead.trim().length < 2) {
            return (0, errorMessage_1.badRequest)(res, "Department head is required");
        }
        if (!branchId || isNaN(Number(branchId))) {
            return (0, errorMessage_1.badRequest)(res, "Valid branchId is required");
        }
        if (!shiftId || isNaN(Number(shiftId))) {
            return (0, errorMessage_1.badRequest)(res, "Valid shiftId is required");
        }
        if (!maxHeadcount || isNaN(Number(maxHeadcount))) {
            return (0, errorMessage_1.badRequest)(res, "Valid maxHeadcount is required");
        }
        // if (!adminId || isNaN(Number(adminId))) {
        //   return badRequest(res, "Valid adminId is required");
        // }
        // if (!managerId || isNaN(Number(managerId))) {
        //   return badRequest(res, "Valid managerId is required");
        // }
        // ================= DUPLICATE =================
        // const existing = await Department.findOne({
        //   where: { deptCode },
        // });
        // if (existing) {
        //   return badRequest(res, "Department already exists with this code");
        // }
        // ================= CREATE =================
        const department = yield dbConnection_2.Department.create({
            deptName,
            deptCode,
            deptHead,
            branchId,
            shiftId,
            maxHeadcount,
            halfSaturday,
            adminId,
            managerId,
            userId: userData.userId,
            companyId: companyId || null,
        });
        (0, errorMessage_1.createSuccess)(res, "Department added successfully", department);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addDepartment = addDepartment;
const getDepartment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        // ✅ Search
        const search = req.query.search || "";
        // ✅ Filters (optional but useful)
        const branchId = req.query.branchId;
        const companyId = req.query.companyId;
        let whereCondition = {
            userId: userData.userId,
        };
        // 🔍 Search condition
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { deptName: { [sequelize_1.Op.like]: `%${search}%` } },
                { deptCode: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        // 🎯 Optional filters
        if (branchId) {
            whereCondition.branchId = branchId;
        }
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Department.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ Response
        (0, errorMessage_1.createSuccess)(res, "Departments fetched successfully", {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getDepartment = getDepartment;
const getDepartmentById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Department id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Department id must be a number");
        }
        const department = yield dbConnection_2.Department.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!department) {
            return (0, errorMessage_1.badRequest)(res, "Department not found");
        }
        (0, errorMessage_1.createSuccess)(res, "Department fetched successfully", department);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getDepartmentById = getDepartmentById;
const addHoliday = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const { holidays, companyId } = req.body;
        // ================= VALIDATION =================
        if (!Array.isArray(holidays) || holidays.length === 0) {
            return (0, errorMessage_1.badRequest)(res, "holidays array is required");
        }
        const holidayData = [];
        for (const item of holidays) {
            const { holidayName, holidayDate, holidayType, branchId, description, adminId, managerId, } = item;
            // ---------- FIELD VALIDATION ----------
            if (!holidayName || holidayName.trim().length < 2) {
                return (0, errorMessage_1.badRequest)(res, "Holiday name is required");
            }
            if (!holidayDate || String(holidayDate).trim().length < 2) {
                return (0, errorMessage_1.badRequest)(res, "Holiday date is required");
            }
            if (!holidayType || holidayType.trim().length < 2) {
                return (0, errorMessage_1.badRequest)(res, "Holiday type is required");
            }
            if (!Array.isArray(branchId) || branchId.length === 0) {
                return (0, errorMessage_1.badRequest)(res, "branchId must be a non-empty array");
            }
            // ---------- PREPARE MULTI-BRANCH DATA ----------
            for (const branch of branchId) {
                if (isNaN(Number(branch))) {
                    return (0, errorMessage_1.badRequest)(res, "Invalid branchId value");
                }
                holidayData.push({
                    holidayName: String(holidayName),
                    holidayDate,
                    holidayType: String(holidayType),
                    branchId: Number(branch),
                    description: description || null,
                    // ✅ FIX: Avoid NaN
                    adminId: adminId ? Number(adminId) : null,
                    managerId: managerId ? Number(managerId) : null,
                    userId: Number(userData.userId),
                    companyId: companyId ? Number(companyId) : null,
                });
            }
        }
        // ================= DEBUG (optional) =================
        // console.log(JSON.stringify(holidayData, null, 2));
        // ================= BULK CREATE =================
        const holidaysCreated = yield dbConnection_2.Holiday.bulkCreate(holidayData);
        return (0, errorMessage_1.createSuccess)(res, "Holidays added successfully", holidaysCreated);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addHoliday = addHoliday;
const getHoliday = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        // ✅ Search
        const search = req.query.search || "";
        // ✅ Filters (optional but useful)
        const branchId = req.query.branchId;
        const companyId = req.query.companyId;
        let whereCondition = {
            userId: userData.userId,
        };
        // 🔍 Search condition
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { holidayName: { [sequelize_1.Op.like]: `%${search}%` } },
                { holidayType: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        // 🎯 Optional filters
        if (branchId) {
            whereCondition.branchId = branchId;
        }
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Holiday.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ Response
        (0, errorMessage_1.createSuccess)(res, "Holidays fetched successfully", {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getHoliday = getHoliday;
const getHolidayById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        if (!req.params.id) {
            return (0, errorMessage_1.badRequest)(res, "Holiday id is required");
        }
        if (isNaN(Number(req.params.id))) {
            return (0, errorMessage_1.badRequest)(res, "Holiday id must be a number");
        }
        const holiday = yield dbConnection_2.Holiday.findOne({
            where: { id: req.params.id, userId: userData.userId },
        });
        if (!holiday) {
            return (0, errorMessage_1.badRequest)(res, "Holiday not found");
        }
        (0, errorMessage_1.createSuccess)(res, "Holiday fetched successfully", holiday);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getHolidayById = getHolidayById;
const addQuotation2 = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        // ✅ Auth validation
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const data = req.body;
        // ✅ Required field validation
        if (!data.customerName) {
            (0, errorMessage_1.badRequest)(res, "Customer name is required");
            return;
        }
        // if (!data.referenceNumber) {
        //    badRequest(res, "Reference number is required");
        //    return
        // }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            (0, errorMessage_1.badRequest)(res, "Items are required");
            return;
        }
        // ✅ Validate each item
        for (const item of data.items) {
            if (!item.itemName || !item.quantity || !item.rate) {
                (0, errorMessage_1.badRequest)(res, "Invalid item data");
                return;
            }
        }
        // ✅ Duplicate check (IMPORTANT)
        const existing = yield dbConnection_2.Quotations.findOne({
            where: {
                userId: Number(userData.userId),
                referenceNumber: data.referenceNumber
            }
        });
        if (existing) {
            (0, errorMessage_1.badRequest)(res, "Quotation already exists with this reference number");
            return;
        }
        const quotationNumber = yield generateQuotationNumber();
        // ✅ Create quotation
        const quotation = yield dbConnection_2.Quotations.create({
            userId: Number(userData.userId),
            quotationNumber: quotationNumber,
            companyId: data.companyId || 0,
            customerName: data.customerName,
            referenceNumber: data.referenceNumber,
            quotation: data,
            status: data.status || "draft",
            isConsumed: false,
        });
        res.status(201).json({
            success: true,
            message: "Quotation added successfully",
            data: quotation
        });
    }
    catch (error) {
        console.error("Add Quotation Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});
exports.addQuotation2 = addQuotation2;
const getQuotationPdfList2 = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // ✅ Filters
        const status = String(req.query.status || "").toLowerCase();
        const companyName = String(req.query.companyName || "").toLowerCase();
        // 🟢 HIERARCHY LOGIC 🟢
        // Admin > Manager > Sales Person
        // We fetch all sub-users created by the logged-in user, and their sub-users too.
        // 🟢 DEEP HIERARCHY LOGIC (Recursive Descendants) 🟢
        // Starts with the logged-in user and recursively finds all children, grandchildren, etc.
        // This supports chains like: Admin(1) > Manager(15) > Manager(16) > Sales Person(17)
        let teamUserIds = [userData.userId];
        let currentParentIds = [userData.userId];
        // 🔄 Loop until no more children are found at the next level
        while (currentParentIds.length > 0) {
            // Find all users created by the current batch of parents
            const subUsers = yield dbConnection_2.User.findAll({
                where: { id: { [sequelize_1.Op.in]: currentParentIds } },
                include: [{
                        model: dbConnection_2.User,
                        as: "createdUsers", // 👈 "createdUsers" finds CHILDREN (not creators/parents)
                        attributes: ["id"]
                    }]
            });
            let nextLevelParentIds = [];
            subUsers.forEach((u) => {
                const children = u.createdUsers || [];
                children.forEach((child) => {
                    // If we haven't seen this user yet, add them to the team and search their children next
                    if (!teamUserIds.includes(child.id)) {
                        teamUserIds.push(child.id);
                        nextLevelParentIds.push(child.id);
                    }
                });
            });
            // Move to the next generation
            currentParentIds = nextLevelParentIds;
        }
        console.log("Final Team User IDs (Recursive):", teamUserIds);
        // ✅ Base where condition for Quotations
        // We now filter by all IDs discovered in the hierarchy (Self + all Descendants)
        let whereCondition = {
            userId: { [sequelize_1.Op.in]: teamUserIds },
        };
        // ✅ Status filter
        if (status) {
            whereCondition.status = status;
        }
        // ✅ Company name filter (PostgreSQL JSON)
        if (companyName) {
            whereCondition[sequelize_1.Op.and] = [
                (0, sequelize_1.literal)(`LOWER("quotation"->'quotation'->>'companyName') = '${companyName.toLowerCase().replace(/'/g, "''")}'`),
            ];
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Quotations.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "ASC"]],
            limit,
            offset,
        });
        const updatedRows = rows.map((item, rowIndex) => {
            const data = item.toJSON();
            const { quotation } = data, rest = __rest(data, ["quotation"]);
            const finalQuotation = (quotation === null || quotation === void 0 ? void 0 : quotation.quotation) || quotation;
            // ✅ Add index inside items
            if ((finalQuotation === null || finalQuotation === void 0 ? void 0 : finalQuotation.items) && Array.isArray(finalQuotation.items)) {
                finalQuotation.items = finalQuotation.items.map((itm, itemIndex) => (Object.assign({ index: itemIndex + 1 }, itm)));
            }
            return Object.assign(Object.assign({}, rest), { rowIndex: offset + rowIndex + 1, quotation: finalQuotation });
        });
        return (0, errorMessage_1.createSuccess)(res, "Quotation list fetched successfully", {
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
            data: updatedRows,
        });
    }
    catch (error) {
        console.error("API Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getQuotationPdfList2 = getQuotationPdfList2;
const updateQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        console.log("id", id, "status", status);
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Quotation id is required");
            return;
        }
        const quotationData = yield dbConnection_2.Quotations.findByPk(id);
        if (!quotationData) {
            (0, errorMessage_1.badRequest)(res, "Quotation not found");
            return;
        }
        quotationData.status = status;
        yield quotationData.save();
        (0, errorMessage_1.createSuccess)(res, "Quotation updated successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateQuotation = updateQuotation;
const addLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        console.log("userData", userData);
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { leaveTypes, companyId, branchId } = req.body;
        // 🔍 Validation
        if (!Array.isArray(leaveTypes) || leaveTypes.length === 0) {
            (0, errorMessage_1.badRequest)(res, "leaveTypes array is required");
            return;
        }
        if (!companyId) {
            (0, errorMessage_1.badRequest)(res, "Company ID is required");
            return;
        }
        if (!branchId) {
            (0, errorMessage_1.badRequest)(res, "Branch ID is required");
            return;
        }
        // ✅ Prepare bulk data
        const leaveData = leaveTypes.map((leave) => {
            if (!leave.leaveName || !leave.leaveCode || !leave.leavesPerYear) {
                throw new Error("leaveName, leaveCode, leavesPerYear are required in each item");
            }
            return {
                leaveName: String(leave.leaveName),
                leaveCode: String(leave.leaveCode),
                leavesPerYear: Number(leave.leavesPerYear),
                carryForward: Boolean(leave.carryForward),
                carryForwardLimit: Number(leave.carryForwardLimit || 0),
                managerApproval: Boolean(leave.managerApproval),
                companyId: Number(companyId),
                branchId: Number(branchId),
                userId: Number(userData.userId),
            };
        });
        // ✅ Bulk insert
        const leaves = yield dbConnection_2.CompanyLeave.bulkCreate(leaveData);
        (0, errorMessage_1.createSuccess)(res, "Leaves added successfully", leaves);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addLeave = addLeave;
const getLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        // ✅ Query params
        const { page = "1", limit = "10", search = "", leaveCode, companyId, branchId, managerApproval, } = req.query;
        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;
        // ✅ Base filter
        const whereCondition = {
            userId: Number(userData.userId),
        };
        // ✅ Search (leaveName / leaveCode)
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { leaveName: { [sequelize_1.Op.like]: `%${search}%` } },
                { leaveCode: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        // ✅ Filters
        if (leaveCode) {
            whereCondition.leaveCode = leaveCode;
        }
        if (companyId) {
            whereCondition.companyId = Number(companyId);
        }
        if (branchId) {
            whereCondition.branchId = Number(branchId);
        }
        if (managerApproval !== undefined) {
            whereCondition.managerApproval = managerApproval === "true";
        }
        // ✅ Query with count
        const { rows, count } = yield dbConnection_2.CompanyLeave.findAndCountAll({
            where: whereCondition,
            limit: pageSize,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ Response
        (0, errorMessage_1.createSuccess)(res, "Leaves fetched successfully", {
            total: count,
            currentPage: pageNumber,
            totalPages: Math.ceil(count / pageSize),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getLeave = getLeave;
const getLeaveById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Leave ID is required");
            return;
        }
        const leave = yield dbConnection_2.CompanyLeave.findOne({
            where: {
                id: Number(id),
                userId: Number(userData.userId),
            },
        });
        if (!leave) {
            (0, errorMessage_1.badRequest)(res, "Leave not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Leave fetched successfully", leave);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getLeaveById = getLeaveById;
const addCompanyBank = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const { companyId, banks } = req.body;
        if (!companyId) {
            return (0, errorMessage_1.badRequest)(res, "companyId is required");
        }
        if (!Array.isArray(banks) || banks.length === 0) {
            return (0, errorMessage_1.badRequest)(res, "banks array is required");
        }
        const bankData = banks.map((b) => ({
            companyId: Number(companyId),
            branchId: b.branchId ? Number(b.branchId) : null, // ✅ optional
            userId: Number(userData.userId),
            bankAccountHolder: b.bankAccountHolder,
            bankName: b.bankName,
            bankAccountNumber: b.bankAccountNumber,
            bankIfsc: b.bankIfsc,
            bankBranchName: b.bankBranchName || null,
            bankAccountType: b.bankAccountType || null,
            bankMicr: b.bankMicr || null,
            upiId: b.upiId || null,
        }));
        const result = yield dbConnection_2.CompanyBank.bulkCreate(bankData);
        return (0, errorMessage_1.createSuccess)(res, "Bank details added successfully", result);
    }
    catch (error) {
        return (0, errorMessage_1.badRequest)(res, "Error adding bank details", error);
    }
});
exports.addCompanyBank = addCompanyBank;
const getClient = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        // ✅ Auth validation
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { status, search } = req.query;
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // ✅ Get all team user IDs (BFS traversal)
        let teamUserIds = [];
        let queue = [userData.userId];
        while (queue.length > 0) {
            const users = yield dbConnection_2.User.findAll({
                where: { id: { [sequelize_1.Op.in]: queue } },
                attributes: ["id"],
                include: [
                    {
                        model: dbConnection_2.User,
                        as: "createdUsers",
                        attributes: ["id"],
                    },
                ],
            });
            let nextQueue = [];
            for (const user of users) {
                if (!teamUserIds.includes(user.id)) {
                    teamUserIds.push(user.id);
                }
                const children = user.createdUsers || [];
                for (const child of children) {
                    if (!teamUserIds.includes(child.id)) {
                        nextQueue.push(child.id);
                    }
                }
            }
            queue = nextQueue;
        }
        // ✅ Where condition
        const obj = {
            userId: { [sequelize_1.Op.in]: teamUserIds },
        };
        if (status) {
            obj.status = status;
        }
        if (search) {
            const searchValue = `%${search}%`;
            obj[sequelize_1.Op.or] = [
                { name: { [sequelize_1.Op.like]: searchValue } },
                { email: { [sequelize_1.Op.like]: searchValue } },
                { mobile: { [sequelize_1.Op.like]: searchValue } },
                { companyName: { [sequelize_1.Op.like]: searchValue } },
                { city: { [sequelize_1.Op.like]: searchValue } },
                { state: { [sequelize_1.Op.like]: searchValue } },
            ];
        }
        // ✅ Fetch data
        const { count, rows } = yield dbConnection_2.MeetingUser.findAndCountAll({
            where: obj,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        // ✅ Response (UNCHANGED)
        (0, errorMessage_1.createSuccess)(res, "user list fetched successfully", {
            total: count,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getClient = getClient;
const updateClient = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Client ID is required");
            return;
        }
        const client = yield dbConnection_2.MeetingUser.findOne({
            where: {
                id: Number(id),
                // userId: Number(userData.userId),
            },
        });
        if (!client) {
            (0, errorMessage_1.badRequest)(res, "Client not found");
            return;
        }
        client.status = req.body.status;
        yield client.save();
        if (!client) {
            (0, errorMessage_1.badRequest)(res, "Client not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Client fetched successfully", client);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateClient = updateClient;
const CategoryStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category ID is required");
            return;
        }
        const category = yield dbConnection_2.Category.findOne({
            where: {
                id: Number(id),
            },
        });
        if (!category) {
            (0, errorMessage_1.badRequest)(res, "Category not found");
            return;
        }
        category.status = req.body.status;
        yield category.save();
        (0, errorMessage_1.createSuccess)(res, "Category updated successfully", category);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.CategoryStatus = CategoryStatus;
const SubCategoryStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Sub Category ID is required");
            return;
        }
        const subCategory = yield dbConnection_2.SubCategory.findOne({
            where: {
                id: Number(id),
            },
        });
        if (!subCategory) {
            (0, errorMessage_1.badRequest)(res, "Sub Category not found");
            return;
        }
        subCategory.status = req.body.status;
        yield subCategory.save();
        (0, errorMessage_1.createSuccess)(res, "Sub Category updated successfully", subCategory);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.SubCategoryStatus = SubCategoryStatus;
const addInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const transaction = yield dbConnection_1.sequelize.transaction();
    try {
        const userData = req.userData;
        // 🔒 Auth validation
        if (!(userData === null || userData === void 0 ? void 0 : userData.userId)) {
            yield transaction.rollback();
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        const data = req.body;
        // 🔍 Basic validation
        if (!data.customerName) {
            yield transaction.rollback();
            (0, errorMessage_1.badRequest)(res, "Customer name is required");
        }
        if (!Array.isArray(data.items) || data.items.length === 0) {
            yield transaction.rollback();
            (0, errorMessage_1.badRequest)(res, "Items are required");
        }
        // 🔍 Item validation
        for (const item of data.items) {
            if (!item.itemName || !item.quantity || !item.rate) {
                yield transaction.rollback();
                (0, errorMessage_1.badRequest)(res, "Each item must have itemName, quantity, and rate");
            }
            if (!item.index) {
                yield transaction.rollback();
                (0, errorMessage_1.badRequest)(res, "Item index is required");
            }
            if (Number(item.quantity) <= 0) {
                yield transaction.rollback();
                (0, errorMessage_1.badRequest)(res, "Item quantity must be greater than 0");
            }
        }
        const { tallyInvoiceNumber = "web", customerName, quotationId, status, QuotationNumber, QuotationDate, date } = data, restData = __rest(data, ["tallyInvoiceNumber", "customerName", "quotationId", "status", "QuotationNumber", "QuotationDate", "date"]);
        let quotationRecord = null;
        // =========================================
        // 🔁 QUOTATION HANDLING (FIXED LOGIC)
        // =========================================
        if (quotationId) {
            quotationRecord = yield dbConnection_2.Quotations.findOne({
                where: { id: Number(quotationId) },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            if (!quotationRecord) {
                throw new Error("Quotation not found");
            }
            if (quotationRecord.isConsumed) {
                throw new Error("Quotation already fully consumed");
            }
            const quotationData = quotationRecord.quotation;
            if (!Array.isArray(quotationData === null || quotationData === void 0 ? void 0 : quotationData.items)) {
                throw new Error("Invalid quotation items");
            }
            // 🧠 Filter only valid (remaining) invoice items
            const validInvoiceItems = data.items.filter((invItem) => {
                const qItem = quotationData.items.find((q) => String(q.index) === String(invItem.index));
                if (!qItem)
                    return false;
                const remaining = Number(qItem.quantity) - Number(qItem.consumedQuantity || 0);
                return remaining > 0;
            });
            if (validInvoiceItems.length === 0) {
                throw new Error("All selected items are already fully consumed");
            }
            // 🧠 Update quotation items
            const updatedItems = quotationData.items.map((qItem) => {
                const invItem = validInvoiceItems.find((i) => String(i.index) === String(qItem.index));
                const baseQuantity = Number(qItem.quantity) || 0;
                const alreadyConsumed = Number(qItem.consumedQuantity) || 0;
                // 🟢 Skip fully consumed
                if (alreadyConsumed >= baseQuantity) {
                    return Object.assign(Object.assign({}, qItem), { consumedQuantity: alreadyConsumed, remainingQuantity: 0 });
                }
                // 🟡 No new invoice item → keep same
                if (!invItem) {
                    return Object.assign(Object.assign({}, qItem), { consumedQuantity: alreadyConsumed, remainingQuantity: baseQuantity - alreadyConsumed });
                }
                const newConsume = Number(invItem.quantity) || 0;
                const available = baseQuantity - alreadyConsumed;
                // 🔴 Prevent over-consumption
                // if (newConsume > available) {
                //   throw new Error(
                //     `Only ${available} quantity left for ${qItem.itemName}`
                //   );
                // }
                const totalConsumed = alreadyConsumed + newConsume;
                return Object.assign(Object.assign({}, qItem), { consumedQuantity: totalConsumed, remainingQuantity: baseQuantity - totalConsumed });
            });
            // ✅ Check if fully consumed
            const isQuotationConsumed = updatedItems.length > 0 &&
                updatedItems.every((item) => Number(item.remainingQuantity) === 0);
            // 💾 Save
            quotationRecord.set("quotation", Object.assign(Object.assign({}, quotationData), { items: updatedItems }));
            quotationRecord.set("isConsumed", isQuotationConsumed);
            quotationRecord.changed("quotation", true);
            yield quotationRecord.save({ transaction });
            // 👉 Replace original items with valid ones only
            data.items = validInvoiceItems;
        }
        // =========================================
        // 🧾 CREATE INVOICE
        // =========================================
        const invoicePayload = {
            userId: userData.userId,
            companyId: userData.companyId || 0,
            invoiceNumber: tallyInvoiceNumber,
            customerName,
            quotationId: quotationId || null,
            status: status || "draft",
            quotationNumber: QuotationNumber || null,
            quotationDate: QuotationDate ? new Date(QuotationDate) : null,
            invoiceDate: date ? new Date(date) : null,
            invoice: restData,
            items: data.items,
        };
        const invoiceData = yield dbConnection_2.Invoices.create(invoicePayload, {
            transaction,
        });
        // ✅ Commit
        yield transaction.commit();
        (0, errorMessage_1.createSuccess)(res, "Invoice added successfully", invoiceData);
    }
    catch (error) {
        yield transaction.rollback();
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.addInvoice = addInvoice;
// export const addInvoice = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   const transaction = await sequelize.transaction();
//   try {
//     const userData = req.userData as JwtPayload;
//     // 🔒 Auth validation
//     if (!userData?.userId) {
//       await transaction.rollback();
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const data = req.body;
//     // 🔍 Basic validation
//     if (!data.customerName) {
//       await transaction.rollback();
//       badRequest(res, "Customer name is required");
//       return;
//     }
//     if (!Array.isArray(data.items) || data.items.length === 0) {
//       await transaction.rollback();
//       badRequest(res, "Items are required");
//       return;
//     }
//     // 🔍 Item validation
//     for (const item of data.items) {
//       if (!item.itemName || !item.quantity || !item.rate) {
//         await transaction.rollback();
//         badRequest(
//           res,
//           "Each item must have itemName, quantity, and rate"
//         );
//         return;
//       }
//       if (!item.index) {
//         await transaction.rollback();
//         badRequest(res, "Item index is required for quotation mapping");
//         return;
//       }
//       if (Number(item.quantity) <= 0) {
//         await transaction.rollback();
//         badRequest(res, "Item quantity must be greater than 0");
//         return;
//       }
//     }
//     // 🧩 Extract fields
//     const {
//       tallyInvoiceNumber = "web",
//       customerName,
//       quotationId,
//       status,
//       QuotationNumber,
//       QuotationDate,
//       date,
//       ...restData
//     } = data;
//     let quotationRecord: any = null;
//     // ============================
//     // 🔁 HANDLE QUOTATION UPDATE
//     // ============================
//     if (quotationId) {
//       quotationRecord = await Quotations.findOne({
//         where: { id: Number(quotationId) },
//         transaction,
//         lock: transaction.LOCK.UPDATE, // 🔒 prevent race condition
//       });
//       if (!quotationRecord) {
//         throw new Error("Quotation not found");
//       }
//       // 🚫 Prevent invoicing if already consumed
//       if (quotationRecord.isConsumed) {
//         throw new Error("Quotation already fully consumed");
//       }
//       const quotationData = quotationRecord.quotation;
//       if (!quotationData?.items || !Array.isArray(quotationData.items)) {
//         throw new Error("Invalid quotation items");
//       }
//       // 🧠 Update quantities
//       const updatedItems = quotationData.items.map((qItem: any) => {
//         const invItem = data.items.find(
//           (i: any) => String(i.index) === String(qItem.index)
//         );
//         const baseQuantity = Number(qItem.quantity);
//         const alreadyConsumed = Number(qItem.consumedQuantity || 0);
//         // If no invoice item → just recalc remaining
//         if (!invItem) {
//           const remaining = baseQuantity - alreadyConsumed;
//           return {
//             ...qItem,
//             consumedQuantity: alreadyConsumed,
//             remainingQuantity: remaining,
//           };
//         }
//         const newConsume = Number(invItem.quantity);
//         const totalConsumed = alreadyConsumed + newConsume;
//         if (totalConsumed > baseQuantity) {
//           throw new Error(
//             `Invoice quantity exceeds quotation for item: ${qItem.itemName}`
//           );
//         }
//         const remaining = baseQuantity - totalConsumed;
//         return {
//           ...qItem,
//           consumedQuantity: totalConsumed,
//           remainingQuantity: remaining,
//         };
//       });
//       // ✅ Check if all items fully consumed
//       const isQuotationConsumed =
//         updatedItems.length > 0 &&
//         updatedItems.every(
//           (item: any) => Number(item.remainingQuantity) === 0
//         );
//       // ✅ Save quotation JSON + flag
//       quotationRecord.set("quotation", {
//         ...quotationData,
//         items: updatedItems,
//       });
//       quotationRecord.set("isConsumed", isQuotationConsumed);
//       quotationRecord.changed("quotation", true);
//       await quotationRecord.save({ transaction });
//     }
//     // ============================
//     // 🧾 CREATE INVOICE
//     // ============================
//     const invoicePayload = {
//       userId: userData.userId,
//       companyId: userData.companyId || 0,
//       invoiceNumber: tallyInvoiceNumber,
//       customerName,
//       quotationId: quotationId || null,
//       status: status || "draft",
//       quotationNumber: QuotationNumber || null,
//       quotationDate: QuotationDate ? new Date(QuotationDate) : null,
//       invoiceDate: date ? new Date(date) : null,
//       invoice: restData,
//       items: data.items,
//     };
//     const invoiceData = await Invoices.create(invoicePayload, {
//       transaction,
//     });
//     // ✅ Commit transaction
//     await transaction.commit();
//     createSuccess(res, "Invoice added successfully", invoiceData);
//   } catch (error) {
//     await transaction.rollback();
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const getInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        console.log("userDatagetInvoice", userData);
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { page = "1", limit = "10", search = "", companyName, city, state, status, } = req.query;
        const pageNumber = Number(page);
        const pageSize = Math.min(Number(limit), 50);
        const offset = (pageNumber - 1) * pageSize;
        // ✅ Recursive team users
        let teamUserIds = [userData.userId];
        let currentParentIds = [userData.userId];
        while (currentParentIds.length > 0) {
            const subUsers = yield dbConnection_2.User.findAll({
                where: { id: { [sequelize_1.Op.in]: currentParentIds } },
                include: [
                    {
                        model: dbConnection_2.User,
                        as: "createdUsers",
                        attributes: ["id"],
                    },
                ],
            });
            let nextLevelParentIds = [];
            subUsers.forEach((u) => {
                const children = u.createdUsers || [];
                children.forEach((child) => {
                    if (!teamUserIds.includes(child.id)) {
                        teamUserIds.push(child.id);
                        nextLevelParentIds.push(child.id);
                    }
                });
            });
            currentParentIds = nextLevelParentIds;
        }
        console.log("Final Team User IDs (Recursive):", teamUserIds);
        // ✅ FIX: Use ONLY ONE whereCondition
        let whereCondition = {
            userId: { [sequelize_1.Op.in]: teamUserIds },
        };
        // 🔍 Global search
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { companyName: { [sequelize_1.Op.like]: `%${search}%` } },
                { city: { [sequelize_1.Op.like]: `%${search}%` } },
                { state: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        // 🎯 Filters
        if (companyName) {
            whereCondition.companyName = {
                [sequelize_1.Op.like]: `%${companyName}%`,
            };
        }
        if (city) {
            whereCondition.city = {
                [sequelize_1.Op.like]: `%${city}%`,
            };
        }
        if (state) {
            whereCondition.state = {
                [sequelize_1.Op.like]: `%${state}%`,
            };
        }
        if (status) {
            let statusArray;
            if (Array.isArray(status)) {
                // case: ?status[]=draft&status[]=sent
                statusArray = status.map((s) => String(s));
            }
            else if (typeof status === "string") {
                // case: ?status=draft,sent
                statusArray = status.split(",").map((s) => s.trim());
            }
            else {
                // Handle the case where it might be a ParsedQs object or other type
                statusArray = [String(status)];
            }
            whereCondition.status = {
                [sequelize_1.Op.in]: statusArray,
            };
        }
        // ✅ Query
        const { rows, count } = yield dbConnection_2.Invoices.findAndCountAll({
            where: whereCondition,
            limit: pageSize,
            offset: offset,
            order: [["createdAt", "DESC"]],
        });
        // ✅ DO NOT CHANGE RESPONSE STRUCTURE
        (0, errorMessage_1.createSuccess)(res, "Invoice list fetched successfully", {
            totalItems: count,
            currentPage: pageNumber,
            totalPages: Math.ceil(count / pageSize),
            pageSize,
            data: rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getInvoice = getInvoice;
const updateInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Invoice ID is required");
            return;
        }
        const invoice = yield dbConnection_2.Invoices.findOne({
            where: {
                id: Number(id),
                // userId: Number(userData.userId),
            },
        });
        if (!invoice) {
            (0, errorMessage_1.badRequest)(res, "Invoice not found");
            return;
        }
        invoice.status = req.body.status;
        yield invoice.save();
        (0, errorMessage_1.createSuccess)(res, "Invoice updated successfully", invoice);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.updateInvoice = updateInvoice;
// export const getRecordSale = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const {
//       page = "1",
//       limit = "10",
//       search = "",
//       companyName,
//       city,
//       state,
//       status,
//     } = req.query as any;
//     // ✅ Safe pagination parsing
//     const pageNumber = Math.max(Number(page) || 1, 1);
//     const pageSize = Math.min(Number(limit) || 10, 50);
//     const offset = (pageNumber - 1) * pageSize;
//     /** --------------------------
//      * 🔁 Get Team Users (Recursive)
//      * -------------------------- */
//     let teamUserIds: number[] = [userData.userId];
//     let currentParentIds: number[] = [userData.userId];
//     while (currentParentIds.length > 0) {
//       const subUsers = await User.findAll({
//         where: { id: { [Op.in]: currentParentIds } },
//         include: [
//           {
//             model: User,
//             as: "createdUsers",
//             attributes: ["id"],
//           },
//         ],
//       });
//       let nextLevelParentIds: number[] = [];
//       subUsers.forEach((u: any) => {
//         const children = u.createdUsers || [];
//         children.forEach((child: any) => {
//           if (!teamUserIds.includes(child.id)) {
//             teamUserIds.push(child.id);
//             nextLevelParentIds.push(child.id);
//           }
//         });
//       });
//       currentParentIds = nextLevelParentIds;
//     }
//     /** --------------------------
//      * 🔍 Filters
//      * -------------------------- */
//     const whereCondition: any = {
//       userId: { [Op.in]: teamUserIds },
//     };
//     // Global search
//     if (search) {
//       whereCondition[Op.or] = [
//         { companyName: { [Op.like]: `%${search}%` } },
//         { city: { [Op.like]: `%${search}%` } },
//         { state: { [Op.like]: `%${search}%` } },
//       ];
//     }
//     if (companyName) {
//       whereCondition.companyName = { [Op.like]: `%${companyName}%` };
//     }
//     if (city) {
//       whereCondition.city = { [Op.like]: `%${city}%` };
//     }
//     if (state) {
//       whereCondition.state = { [Op.like]: `%${state}%` };
//     }
//     if (status) {
//       whereCondition.status = status;
//     }
//     /** --------------------------
//      * 📦 Fetch Data
//      * -------------------------- */
//     const { count, rows } = await RecordSales.findAndCountAll({
//       where: whereCondition,
//       order: [["createdAt", "DESC"]], // ✅ latest first
//       limit: pageSize,                // ✅ fixed
//       offset,
//     });
//     /** --------------------------
//      * 🧠 Transform Data
//      * -------------------------- */
//     const updatedRows = rows.map((item: any, rowIndex: number) => {
//       const data = item.toJSON();
//       const { quotation, ...rest } = data;
//       const finalQuotation = quotation?.quotation || quotation;
//       if (finalQuotation?.items && Array.isArray(finalQuotation.items)) {
//         finalQuotation.items = finalQuotation.items.map(
//           (itm: any, itemIndex: number) => ({
//             index: itemIndex + 1,
//             ...itm,
//           })
//         );
//       }
//       return {
//         ...rest,
//         rowIndex: offset + rowIndex + 1,
//         quotation: finalQuotation,
//       };
//     });
//     /** --------------------------
//      * ✅ Response
//      * -------------------------- */
//     createSuccess(res, "Invoice list fetched successfully", {
//       totalItems: count,
//       currentPage: pageNumber,
//       totalPages: Math.ceil(count / pageSize),
//       pageSize,
//       data: updatedRows, // ✅ FIXED (was rows)
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const getRecordSale = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!(userData === null || userData === void 0 ? void 0 : userData.userId)) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { page = "1", limit = "10", search = "", companyName, city, state, status, startDate, // ✅ added
        endDate, // ✅ added
         } = req.query;
        // ✅ Safe pagination parsing
        const pageNumber = Math.max(Number(page) || 1, 1);
        const pageSize = Math.min(Number(limit) || 10, 50);
        const offset = (pageNumber - 1) * pageSize;
        /** --------------------------
         * 🔁 Get Team Users (Recursive)
         * -------------------------- */
        let teamUserIds = [userData.userId];
        let currentParentIds = [userData.userId];
        while (currentParentIds.length > 0) {
            const subUsers = yield dbConnection_2.User.findAll({
                where: { id: { [sequelize_1.Op.in]: currentParentIds } },
                include: [
                    {
                        model: dbConnection_2.User,
                        as: "createdUsers",
                        attributes: ["id"],
                    },
                ],
            });
            let nextLevelParentIds = [];
            subUsers.forEach((u) => {
                const children = u.createdUsers || [];
                children.forEach((child) => {
                    if (!teamUserIds.includes(child.id)) {
                        teamUserIds.push(child.id);
                        nextLevelParentIds.push(child.id);
                    }
                });
            });
            currentParentIds = nextLevelParentIds;
        }
        /** --------------------------
         * 🔍 Filters
         * -------------------------- */
        const whereCondition = {
            userId: { [sequelize_1.Op.in]: teamUserIds },
        };
        // 🔍 Global search
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { companyName: { [sequelize_1.Op.like]: `%${search}%` } },
                { city: { [sequelize_1.Op.like]: `%${search}%` } },
                { state: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        if (companyName) {
            whereCondition.companyName = { [sequelize_1.Op.like]: `%${companyName}%` };
        }
        if (city) {
            whereCondition.city = { [sequelize_1.Op.like]: `%${city}%` };
        }
        if (state) {
            whereCondition.state = { [sequelize_1.Op.like]: `%${state}%` };
        }
        // ✅ Status filter
        if (status) {
            whereCondition.paymentReceived = status;
        }
        // ✅ Date filter (createdAt)
        if (startDate && endDate) {
            whereCondition.createdAt = {
                [sequelize_1.Op.between]: [
                    new Date(startDate + "T00:00:00.000Z"),
                    new Date(endDate + "T23:59:59.999Z"),
                ],
            };
        }
        else if (startDate) {
            whereCondition.createdAt = {
                [sequelize_1.Op.gte]: new Date(startDate + "T00:00:00.000Z"),
            };
        }
        else if (endDate) {
            whereCondition.createdAt = {
                [sequelize_1.Op.lte]: new Date(endDate + "T23:59:59.999Z"),
            };
        }
        /** --------------------------
         * 📦 Fetch Data
         * -------------------------- */
        const { count, rows } = yield dbConnection_2.RecordSales.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit: pageSize,
            offset,
        });
        /** --------------------------
         * 🧠 Transform Data
         * -------------------------- */
        const updatedRows = rows.map((item, rowIndex) => {
            const data = item.toJSON();
            const { quotation } = data, rest = __rest(data, ["quotation"]);
            const finalQuotation = (quotation === null || quotation === void 0 ? void 0 : quotation.quotation) || quotation;
            if ((finalQuotation === null || finalQuotation === void 0 ? void 0 : finalQuotation.items) && Array.isArray(finalQuotation.items)) {
                finalQuotation.items = finalQuotation.items.map((itm, itemIndex) => (Object.assign({ index: itemIndex + 1 }, itm)));
            }
            return Object.assign(Object.assign({}, rest), { rowIndex: offset + rowIndex + 1, quotation: finalQuotation });
        });
        /** --------------------------
         * ✅ Response (UNCHANGED)
         * -------------------------- */
        (0, errorMessage_1.createSuccess)(res, "Invoice list fetched successfully", {
            totalItems: count,
            currentPage: pageNumber,
            totalPages: Math.ceil(count / pageSize),
            pageSize,
            data: updatedRows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getRecordSale = getRecordSale;
const addReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!(userData === null || userData === void 0 ? void 0 : userData.userId)) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const payload = req.body;
        // ✅ FIXED NORMALIZATION
        let reports = [];
        if (Array.isArray(payload)) {
            reports = payload;
        }
        else if (Array.isArray(payload.data)) {
            reports = payload.data;
        }
        else {
            reports = [payload];
        }
        if (!reports.length) {
            (0, errorMessage_1.badRequest)(res, "Payload cannot be empty");
            return;
        }
        // ✅ VALIDATION
        const allowedStatus = [
            "draft",
            "imported",
            "sent",
            "accepted",
            "rejected",
        ];
        const validateReport = (item, index) => {
            if (!item.date)
                throw new Error(`date is required at index ${index}`);
            if (!item.referenceNo)
                throw new Error(`referenceNo is required at index ${index}`);
            if (!item.customerName)
                throw new Error(`customerName is required at index ${index}`);
            if (item.openingAmount == null || isNaN(item.openingAmount)) {
                throw new Error(`openingAmount must be number at index ${index}`);
            }
            if (item.pendingAmount == null || isNaN(item.pendingAmount)) {
                throw new Error(`pendingAmount must be number at index ${index}`);
            }
            if (item.pendingAmount > item.openingAmount) {
                throw new Error(`pendingAmount > openingAmount at index ${index}`);
            }
            if (!item.dueOn || isNaN(new Date(item.dueOn).getTime())) {
                throw new Error(`Invalid dueOn at index ${index}`);
            }
            if (!Number.isInteger(item.overdueDays)) {
                throw new Error(`overdueDays must be integer at index ${index}`);
            }
            if (item.status && !allowedStatus.includes(item.status)) {
                throw new Error(`Invalid status at index ${index}`);
            }
        };
        reports.forEach((item, index) => validateReport(item, index));
        // ✅ PREPARE DATA
        const finalData = reports.map((item) => (Object.assign(Object.assign({}, item), { userId: userData.userId, companyId: userData.companyId || userData.userId })));
        let result;
        if (finalData.length === 1) {
            result = yield dbConnection_2.Report.create(finalData[0]);
        }
        else {
            result = yield dbConnection_2.Report.bulkCreate(finalData, {
                validate: true,
                returning: true,
            });
        }
        (0, errorMessage_1.createSuccess)(res, "Report added successfully", result);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.addReport = addReport;
// export const addReport = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const payload = req.body;
//     // ✅ Normalize to array
//     const reports = Array.isArray(payload) ? payload : [payload];
//     if (!reports.length) {
//       badRequest(res, "Payload cannot be empty");
//       return;
//     }
//     // ✅ Validation function
//     const validateReport = (item: any, index: number) => {
//       if (!item.date) {
//         throw new Error(`date is required at index ${index}`);
//       }
//       if (!item.referenceNo) {
//         throw new Error(`referenceNo is required at index ${index}`);
//       }
//       if (!item.customerName) {
//         throw new Error(`customerName is required at index ${index}`);
//       }
//       if (item.openingAmount == null || isNaN(item.openingAmount)) {
//         throw new Error(`openingAmount must be a number at index ${index}`);
//       }
//       if (item.openingAmount < 0) {
//         throw new Error(`openingAmount cannot be negative at index ${index}`);
//       }
//       if (item.pendingAmount == null || isNaN(item.pendingAmount)) {
//         throw new Error(`pendingAmount must be a number at index ${index}`);
//       }
//       if (item.pendingAmount < 0) {
//         throw new Error(`pendingAmount cannot be negative at index ${index}`);
//       }
//       if (item.pendingAmount > item.openingAmount) {
//         throw new Error(
//           `pendingAmount cannot be greater than openingAmount at index ${index}`
//         );
//       }
//       if (!item.dueOn || isNaN(new Date(item.dueOn).getTime())) {
//         throw new Error(`dueOn must be a valid date at index ${index}`);
//       }
//       if (item.overdueDays == null || !Number.isInteger(item.overdueDays)) {
//         throw new Error(`overdueDays must be an integer at index ${index}`);
//       }
//       if (item.overdueDays < 0) {
//         throw new Error(`overdueDays cannot be negative at index ${index}`);
//       }
//       const allowedStatus = [
//         "draft",
//         "imported",
//         "sent",
//         "accepted",
//         "rejected",
//       ];
//       if (item.status && !allowedStatus.includes(item.status)) {
//         throw new Error(`Invalid status at index ${index}`);
//       }
//     };
//     // ✅ Run validation
//     reports.forEach((item, index) => validateReport(item, index));
//     // ✅ Prepare data
//     const finalData = reports.map((item) => ({
//       ...item,
//       userId: userData.userId,
//       companyId: userData.companyId || userData.userId,
//     }));
//     let result;
//     if (finalData.length === 1) {
//       result = await Report.create(finalData[0]);
//     } else {
//       result = await Report.bulkCreate(finalData, {
//         validate: true,
//         returning: true,
//       });
//     }
//     createSuccess(
//       res,
//       finalData.length === 1
//         ? "Report added successfully"
//         : "Report added successfully",
//       result
//     );
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
// export const addReport = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const payload = req.body;
//         if (referenceNo) {
//       whereCondition.referenceNo = referenceNo;
//     }
//     if (customerName) {
//       whereCondition.customerName = customerName;
//     }
//     if (date) {
//       // DB format: "2023-04-20T10:00:00.000Z"
//       // Input: "2023-04-20"
//       whereCondition.date = {
//         [Op.like]: `%${date}%`,
//       };
//     }
//     // ✅ Fetch latest matching record
//     const report = await Report.findOne({
//       where: whereCondition,
//       order: [["createdAt", "DESC"]],
//     });
//     if (!report) {
//       badRequest(res, "Report not found");
//       return;
//     }
//     // ==============================
//     // ✅ NORMALIZE INPUT (IMPORTANT)
//     // ==============================
//     let reports: any[] = [];
//     if (Array.isArray(payload)) {
//       // case: direct array
//       reports = payload;
//     } else if (Array.isArray(payload.data)) {
//       // case: { data: [...] }
//       reports = payload.data;
//     } else {
//       // case: single object
//       reports = [payload];
//     }
//     if (!reports.length) {
//       badRequest(res, "Payload cannot be empty");
//       return;
//     }
//     // ==============================
//     // ✅ VALIDATION
//     // ==============================
//     const allowedStatus = [
//       "draft",
//       "imported",
//       "sent",
//       "accepted",
//       "rejected",
//     ];
//     const validateReport = (item: any, index: number) => {
//       if (!item.date) {
//         throw new Error(`date is required at index ${index}`);
//       }
//       if (!item.referenceNo) {
//         throw new Error(`referenceNo is required at index ${index}`);
//       }
//       if (!item.customerName) {
//         throw new Error(`customerName is required at index ${index}`);
//       }
//       if (item.openingAmount == null || isNaN(item.openingAmount)) {
//         throw new Error(`openingAmount must be a number at index ${index}`);
//       }
//       if (item.openingAmount < 0) {
//         throw new Error(`openingAmount cannot be negative at index ${index}`);
//       }
//       if (item.pendingAmount == null || isNaN(item.pendingAmount)) {
//         throw new Error(`pendingAmount must be a number at index ${index}`);
//       }
//       if (item.pendingAmount < 0) {
//         throw new Error(`pendingAmount cannot be negative at index ${index}`);
//       }
//       if (item.pendingAmount > item.openingAmount) {
//         throw new Error(
//           `pendingAmount cannot be greater than openingAmount at index ${index}`
//         );
//       }
//       if (!item.dueOn || isNaN(new Date(item.dueOn).getTime())) {
//         throw new Error(`dueOn must be a valid date at index ${index}`);
//       }
//       if (item.overdueDays == null || !Number.isInteger(item.overdueDays)) {
//         throw new Error(`overdueDays must be an integer at index ${index}`);
//       }
//       if (item.overdueDays < 0) {
//         throw new Error(`overdueDays cannot be negative at index ${index}`);
//       }
//       if (item.status && !allowedStatus.includes(item.status)) {
//         throw new Error(`Invalid status at index ${index}`);
//       }
//     };
//     // Run validation
//     reports.forEach((item, index) => validateReport(item, index));
//     // ==============================
//     // ✅ PREPARE DATA
//     // ==============================
//     const finalData = reports.map((item) => ({
//       ...item,
//       userId: userData.userId,
//       companyId: userData.companyId || userData.userId,
//     }));
//     // ==============================
//     // ✅ INSERT DATA
//     // ==============================
//     let result;
//     if (finalData.length === 1) {
//       result = await Report.create(finalData[0]);
//     } else {
//       result = await Report.bulkCreate(finalData, {
//         validate: true,
//         returning: true,
//       });
//     }
//     // ==============================
//     // ✅ RESPONSE
//     // ==============================
//     createSuccess(
//       res,
//       "Report added successfully",
//       result
//     );
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const getReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!(userData === null || userData === void 0 ? void 0 : userData.userId)) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { page = "1", limit = "10", search = "", referenceNo, startDate, endDate, } = req.query;
        const pageNumber = Math.max(Number(page) || 1, 1);
        const pageSize = Math.min(Number(limit) || 10, 50);
        const offset = (pageNumber - 1) * pageSize;
        // ✅ Use AND conditions (important)
        const andConditions = [
            { userId: userData.userId },
        ];
        // 🔍 Global search
        if (search) {
            andConditions.push({
                [sequelize_1.Op.or]: [
                    { referenceNo: { [sequelize_1.Op.like]: `%${search}%` } },
                    { customerName: { [sequelize_1.Op.like]: `%${search}%` } },
                ],
            });
        }
        // 🎯 Reference filter (separate from search)
        if (referenceNo) {
            andConditions.push({
                referenceNo: { [sequelize_1.Op.like]: `%${referenceNo}%` },
            });
        }
        // 📅 Date range filter (using createdAt)
        if (startDate && endDate) {
            andConditions.push({
                createdAt: {
                    [sequelize_1.Op.between]: [
                        new Date(startDate),
                        new Date(endDate),
                    ],
                },
            });
        }
        else if (startDate) {
            andConditions.push({
                createdAt: {
                    [sequelize_1.Op.gte]: new Date(startDate),
                },
            });
        }
        else if (endDate) {
            andConditions.push({
                createdAt: {
                    [sequelize_1.Op.lte]: new Date(endDate),
                },
            });
        }
        const whereCondition = {
            [sequelize_1.Op.and]: andConditions,
        };
        // ✅ Fetch data
        const { count, rows } = yield dbConnection_2.Report.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit: pageSize,
            offset,
        });
        // ✅ Add rowIndex
        const updatedRows = rows.map((item, rowIndex) => (Object.assign(Object.assign({}, item.toJSON()), { rowIndex: offset + rowIndex + 1 })));
        (0, errorMessage_1.createSuccess)(res, "Reports fetched successfully", {
            totalItems: count,
            currentPage: pageNumber,
            totalPages: Math.ceil(count / pageSize),
            pageSize,
            data: updatedRows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getReport = getReport;
// export const getReportById = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const { id } = req.params;
//     const report = await Report.findOne({
//       where: {
//         id,
//         // userId: userData.userId,
//       },
//     });
//     if (!report) {
//       badRequest(res, "Report not found");
//       return;
//     }
//     createSuccess(res, "Report fetched successfully", report);
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const getReportDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!(userData === null || userData === void 0 ? void 0 : userData.userId)) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { referenceNo, customerName, date } = req.query;
        // ❗ Require at least one filter
        if (!referenceNo && !customerName && !date) {
            (0, errorMessage_1.badRequest)(res, "At least one filter is required");
            return;
        }
        const whereCondition = {
            userId: userData.userId, // 🔐 security
        };
        // ✅ Flexible filters
        if (referenceNo) {
            whereCondition.referenceNo = referenceNo;
        }
        if (customerName) {
            whereCondition.customerName = customerName;
        }
        if (date) {
            // DB format: "2023-04-20T10:00:00.000Z"
            // Input: "2023-04-20"
            whereCondition.date = {
                [sequelize_1.Op.like]: `%${date}%`,
            };
        }
        // ✅ Fetch latest matching record
        const report = yield dbConnection_2.Report.findOne({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
        });
        if (!report) {
            (0, errorMessage_1.badRequest)(res, "Report not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Report fetched successfully", report);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getReportDetails = getReportDetails;
const updateReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!(userData === null || userData === void 0 ? void 0 : userData.userId)) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { referenceNo, customerName, date } = req.query;
        // ❗ require at least one identifier
        if (!referenceNo && !customerName && !date) {
            (0, errorMessage_1.badRequest)(res, "At least one filter is required");
            return;
        }
        const whereCondition = {
            userId: userData.userId, // keep security
        };
        // 🎯 referenceNo
        if (referenceNo && customerName && date) {
            whereCondition.referenceNo = referenceNo;
            whereCondition.customerName = customerName;
            // whereCondition.date = date;
        }
        // 🎯 date (match full day)
        if (date) {
            // DB format: "2023-04-20T10:00:00.000Z"
            // Input: "2023-04-20"
            whereCondition.date = {
                [sequelize_1.Op.like]: `%${date}%`,
            };
        }
        const payload = req.body;
        const report = yield dbConnection_2.Report.findOne({
            where: whereCondition,
            order: [["createdAt", "DESC"]], // latest match
        });
        if (!report) {
            (0, errorMessage_1.badRequest)(res, "Report not found");
            return;
        }
        const updatedReport = yield report.update(payload);
        (0, errorMessage_1.createSuccess)(res, "Report updated successfully", updatedReport);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.updateReport = updateReport;
