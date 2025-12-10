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
exports.ownLeave = exports.assignMeeting = exports.AttendanceBook = exports.createClient = exports.userLeave = exports.userExpense = exports.userAttendance = exports.getAttendance = exports.GetExpense = exports.leaveList = exports.UpdateExpense = exports.test = exports.approveLeave = exports.BulkUploads = exports.getMeeting = exports.DeleteCategory = exports.UpdateCategory = exports.categoryDetails = exports.getcategory = exports.AddCategory = exports.GetAllUser = exports.assignSalesman = exports.MySalePerson = exports.UpdatePassword = exports.GetProfile = exports.Login = exports.Register = void 0;
const sequelize_1 = require("sequelize");
const client_s3_1 = require("@aws-sdk/client-s3");
const csv_parser_1 = __importDefault(require("csv-parser"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_1 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const UNIQUE_ROLES = ["super_admin"];
const getPagination = (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
const findUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return dbConnection_1.User.findOne({
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
        if (role === "sale_person" || role === "manager" || role === "admin") {
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
        // Validate input
        if (!email || !password) {
            (0, errorMessage_1.badRequest)(res, "Email and password are required");
        }
        // Find user
        const user = yield Middleware.FindByEmail(dbConnection_1.User, email);
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
        }
        // Allowed roles
        const allowedRoles = ["admin", "manager", "super_admin"];
        if (!allowedRoles.includes(user.get("role"))) {
            (0, errorMessage_1.badRequest)(res, "Access restricted. Only admin & manager can login.");
        }
        // Validate password
        const hashedPassword = user.get("password");
        const isPasswordValid = yield bcrypt_1.default.compare(password, hashedPassword);
        if (!isPasswordValid) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
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
        const { rows, count } = yield dbConnection_1.User.findAndCountAll({
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
                    model: dbConnection_1.User,
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
        const { category_name } = req.body || {};
        if (!category_name) {
            (0, errorMessage_1.badRequest)(res, "category name is missing");
            return;
        }
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Category, "category_name", category_name, loggedInId);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Category already exists");
            return;
        }
        const item = yield dbConnection_1.Category.create({
            category_name,
            adminId: loggedInId,
            managerId: loggedInId,
        });
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
    var _a;
    try {
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
        let ll = loggedInId; // default (admin or fallback)
        let manager = null;
        // 🔹 If logged-in user is MANAGER → fetch admin (creator)
        if (role === "manager") {
            manager = yield dbConnection_1.User.findByPk(loggedInId, {
                attributes: ["id", "role"],
                include: [
                    {
                        model: dbConnection_1.User,
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
        const item = yield Middleware.getCategory(dbConnection_1.Category, data, "", ll);
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
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Category, "category_name", category_name, "");
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
    var _a;
    try {
        const { page = 1, limit = 10, search = "", userId, date, empty, } = req.query;
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
        let ll = loggedInId;
        let manager = null;
        if (role === "manager") {
            manager = yield dbConnection_1.User.findByPk(loggedInId, {
                attributes: ["id", "role"],
                include: [
                    {
                        model: dbConnection_1.User,
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
            where.adminId = ll; // <-- correctly added to where clause
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
        const { rows, count } = yield dbConnection_1.Meeting.findAndCountAll({
            attributes: [
                "id",
                "companyName",
                "personName",
                "mobileNumber",
                "companyEmail",
                "meetingTimeIn",
                "meetingTimeOut",
                "meetingPurpose",
                "userId",
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
        // Correct check for multer.array()
        if (!req.files || req.files.length === 0) {
            (0, errorMessage_1.badRequest)(res, "CSV file is required");
            return;
        }
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
                customerType: "existing",
                adminId: loginUser,
                managerId: loginUser,
            });
        })
            .on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const uniqueRows = [];
                for (const r of results) {
                    const exists = yield dbConnection_1.Meeting.findOne({
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
                    yield dbConnection_1.Meeting.bulkCreate(uniqueRows);
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
        yield dbConnection_1.Leave.update(obj, {
            where: { employee_id, id: leaveID },
        });
        if (status === "rejected") {
            yield dbConnection_1.Attendance.update({ status: "leaveReject" }, { where: { employee_id, status: "leave" } });
        }
        if (status === "approved") {
            yield dbConnection_1.Attendance.update({ status: "leaveApproved" }, { where: { employee_id, status: "leave" } });
        }
        // Fetch updated leave after update
        const updatedLeave = yield dbConnection_1.Leave.findOne({
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
        const totalCount = yield dbConnection_1.User.count({
            where: mainWhere,
        });
        const rows = yield dbConnection_1.User.findByPk(loggedInId, {
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
                    model: dbConnection_1.User,
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
                            model: dbConnection_1.User,
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
        const item = yield dbConnection_1.Expense.findOne({ where: { userId, id: expenseId } });
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
                const user = (yield dbConnection_1.User.findByPk(id, {
                    include: [
                        {
                            model: dbConnection_1.User,
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
        const { rows, count } = yield dbConnection_1.User.findAndCountAll({
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
                    model: dbConnection_1.Leave,
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
        const { rows, count } = yield dbConnection_1.Expense.findAndCountAll({
            where: expenseWhere, // 👈 final merged condition
            include: [
                {
                    model: dbConnection_1.User,
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
        const { rows, count } = yield dbConnection_1.User.findAndCountAll({
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
                    model: dbConnection_1.Attendance,
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
        const { rows, count } = yield fetchData(dbConnection_1.Attendance, { employee_id: Number(userId) }, limit, offset, dateFilter);
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
        const { rows, count } = yield fetchData(dbConnection_1.Expense, { userId: Number(userId) }, limit, offset, dateFilter);
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
        const { rows, count } = yield fetchData(dbConnection_1.Leave, { employee_id: Number(userId) }, limit, offset
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
        const { companyName, personName, mobileNumber, companyEmail } = req.body || {};
        // Required fields check
        if (![companyName, personName, mobileNumber, companyEmail].every(Boolean)) {
            (0, errorMessage_1.badRequest)(res, "All fields are required");
            return;
        }
        // Check if client already exists
        const isExist = yield dbConnection_1.Meeting.findOne({
            where: {
                [sequelize_1.Op.or]: [{ adminId: userId }, { managerId: userId }],
                companyName,
                personName,
                mobileNumber,
                companyEmail,
            },
        });
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, "Client already exists");
            return;
        }
        // Create new client
        yield dbConnection_1.Meeting.create({
            companyName,
            personName,
            mobileNumber,
            companyEmail,
            adminId: userId,
            managerId: userId,
            customerType: "existing",
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
        const { rows: users, count: totalCount } = yield dbConnection_1.User.findAndCountAll({
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
                    model: dbConnection_1.Attendance,
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
        const meeting = yield dbConnection_1.Meeting.findOne({ where: { id: meetingId } });
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
        yield dbConnection_1.Meeting.create({
            companyName: meeting.companyName,
            personName: meeting.personName,
            mobileNumber: meeting.mobileNumber,
            companyEmail: meeting.companyEmail,
            userId,
            scheduledTime,
            status: "scheduled",
            customerType: "existing"
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
        const { rows, count } = yield dbConnection_1.Leave.findAndCountAll({
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
