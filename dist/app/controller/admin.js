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
exports.assignAdmin = exports.updateReport = exports.getReportDetails = exports.getReport = exports.addReport = exports.getRecordSale = exports.updateInvoice = exports.getInvoice = exports.addInvoice = exports.SubCategoryStatus = exports.CategoryStatus = exports.updateClient = exports.getClient = exports.updateQuotation = exports.getQuotationPdfList2 = exports.addQuotation2 = exports.assignEmployeeShift = exports.getFuelExpense = exports.getMeetingDistance = exports.addQuotationPdf = exports.downloadQuotationPdf = exports.getQuotationPdfList = exports.getSubCategory = exports.updateSubCategory = exports.addSubCategory = exports.addQuotation = exports.assignMeeting = exports.createClient = exports.userExpense = exports.getTopPerformers = exports.getDashboardSummary = exports.GetExpense = exports.UpdateExpense = exports.test = exports.BulkUploads = exports.BulkAddSalePerson = exports.getMeeting = exports.DeleteCategory = exports.UpdateCategory = exports.categoryDetails = exports.getCategoryWithSubCategories = exports.getcategory = exports.AddCategory = exports.GetAllUser = exports.assignSalesman = exports.MySalePerson = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const spaces_1 = require("../../config/spaces");
const csv_parser_1 = __importDefault(require("csv-parser"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const ejs_1 = __importDefault(require("ejs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_2 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const email_1 = require("../../config/email");
const checkPermission_1 = require("../../config/checkPermission");
const userHierarchy_1 = require("../../modules/shared/userHierarchy");
const companyAccess_1 = require("../../modules/shared/companyAccess");
const getPagination = (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
const generateTempPassword = () => {
    return crypto_1.default.randomBytes(6).toString("base64").replace(/[+/=]/g, "x");
};
const findUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return dbConnection_2.User.findOne({
        where: { id: userId },
        attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
    });
});
// Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword have moved
// to src/modules/auth/ — see auth.controller.ts/service.ts/repository.ts.
// Routes are mounted from server.ts, same URL paths as before.
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
                    attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role"],
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
        console.log("userData in GetAllUser:", userData); // Debugging line
        const { page = 1, limit = 10, search = "", role, shiftId, branchId } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const loggedInRole = userData === null || userData === void 0 ? void 0 : userData.role;
        // super_admin sees all users; everyone else sees only their descendants (children + grandchildren)
        let idFilter;
        if (loggedInRole === "super_admin") {
            idFilter = { [sequelize_1.Op.ne]: loggedInId };
        }
        else {
            const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
            if (childIds.length === 0) {
                (0, errorMessage_1.createSuccess)(res, "Users fetched successfully", {
                    page: pageNum,
                    limit: limitNum,
                    total: 0,
                    finalRows: [],
                });
                return;
            }
            idFilter = { [sequelize_1.Op.in]: childIds };
        }
        const where = { id: idFilter };
        if (role)
            where.role = role;
        if (shiftId)
            where.shiftId = Number(shiftId);
        if (branchId)
            where.branchId = Number(branchId);
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
                "employeeCode",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "shiftId",
                "branchId",
                "createdAt",
            ],
            where,
            offset,
            limit: limitNum,
            order: [["createdAt", "DESC"]],
            distinct: true,
            include: [
                {
                    model: dbConnection_2.User,
                    as: "creators",
                    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: dbConnection_2.Company,
                    as: "company",
                    attributes: ["id", "companyName"],
                    required: false,
                },
                {
                    model: dbConnection_2.Company,
                    as: "managedCompanies",
                    attributes: ["id", "companyName"],
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
        let ll = loggedInId; // default (admin)
        if (role === "manager" || role === "sale_person") {
            // Walk up the creator chain until we find an admin
            let currentId = Number(loggedInId);
            while (true) {
                const currentUser = yield dbConnection_2.User.findByPk(currentId, {
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
                const plain = currentUser === null || currentUser === void 0 ? void 0 : currentUser.get({ plain: true });
                const creator = (_a = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _a === void 0 ? void 0 : _a[0];
                if (!creator) {
                    if ((plain === null || plain === void 0 ? void 0 : plain.role) === "admin" || (plain === null || plain === void 0 ? void 0 : plain.role) === "super_admin")
                        ll = currentId;
                    break;
                }
                if (creator.role === "admin" || creator.role === "super_admin") {
                    ll = creator.id;
                    break;
                }
                currentId = creator.id;
            }
        }
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
const getCategoryWithSubCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
        let adminId = loggedInId;
        if (role === "manager" || role === "sale_person") {
            let currentId = Number(loggedInId);
            while (true) {
                const currentUser = yield dbConnection_2.User.findByPk(currentId, {
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
                const plain = currentUser === null || currentUser === void 0 ? void 0 : currentUser.get({ plain: true });
                const creator = (_a = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _a === void 0 ? void 0 : _a[0];
                if (!creator) {
                    if ((plain === null || plain === void 0 ? void 0 : plain.role) === "admin" || (plain === null || plain === void 0 ? void 0 : plain.role) === "super_admin")
                        adminId = currentId;
                    break;
                }
                if (creator.role === "admin" || creator.role === "super_admin") {
                    adminId = creator.id;
                    break;
                }
                currentId = creator.id;
            }
        }
        const categories = yield dbConnection_2.Category.findAll({
            where: { adminId },
            include: [
                {
                    model: dbConnection_2.SubCategory,
                    as: "subCategories",
                    required: false,
                },
            ],
            order: [["createdAt", "DESC"]],
        });
        const result = categories.map((cat) => {
            const catObj = cat.toJSON();
            const subCategories = (catObj.subCategories || []).map((sub) => (Object.assign(Object.assign({}, sub), { tax: sub.text, text: undefined })));
            return Object.assign(Object.assign({}, catObj), { subCategories });
        });
        (0, errorMessage_1.createSuccess)(res, "category with sub categories list", result);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getCategoryWithSubCategories = getCategoryWithSubCategories;
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
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category ID is missing");
            return;
        }
        if (!category_name && !status) {
            (0, errorMessage_1.badRequest)(res, "Nothing to update");
            return;
        }
        // Only check for duplicate name when category_name is being updated
        if (category_name) {
            const normalizedName = category_name.replace(/\s+/g, "").toLowerCase();
            const isCategoryExist = yield dbConnection_2.Category.findOne({
                where: {
                    [sequelize_1.Op.and]: [
                        sequelize_1.Sequelize.where(sequelize_1.Sequelize.fn("REPLACE", sequelize_1.Sequelize.fn("LOWER", sequelize_1.Sequelize.col("category_name")), " ", ""), normalizedName),
                        { adminId: loggedInId },
                        { id: { [sequelize_1.Op.ne]: id } },
                    ],
                },
            });
            if (isCategoryExist) {
                (0, errorMessage_1.badRequest)(res, "Category already exists");
                return;
            }
        }
        // Build update object with only provided fields
        const updateData = {};
        if (category_name)
            updateData.category_name = category_name;
        if (status)
            updateData.status = status;
        const updatedCategory = yield Middleware.UpdateData(dbConnection_2.Category, id, updateData);
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
        // FIX: previously `where` stayed `{}` (no userId filter at all) unless the
        // caller explicitly passed `empty=true` or `userId` — a plain GET with no
        // query params returned every company's meeting records. Always scope to
        // the caller's own team.
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(ll);
        const allowedIds = [ll, ...childIds];
        const where = {};
        if (empty === "true") {
            where.userId = ll;
        }
        else if (userId) {
            const requestedId = Number(userId);
            if (!allowedIds.includes(requestedId)) {
                (0, errorMessage_1.forbidden)(res, "You can only view meetings of your own team members");
                return;
            }
            where.userId = requestedId;
        }
        else {
            where.userId = { [sequelize_1.Op.in]: allowedIds };
        }
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
            include: [
                {
                    model: dbConnection_2.Meeting, // joined via Meeting.meetingUserId -> MeetingUser.id
                },
            ],
            distinct: true, // avoid inflated count from the hasMany join
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
const BulkAddSalePerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loginUser = userData === null || userData === void 0 ? void 0 : userData.userId;
        const loginRole = userData === null || userData === void 0 ? void 0 : userData.role;
        console.log(">>>>>>>>>>>>>>", userData);
        if (!loginUser) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized");
            return;
        }
        const { createdBy, branchId, shiftId } = req.body;
        // Validate branchId/shiftId (optional — applied to every row in the
        // batch) belong to the caller's own company, same as assignEmployeeShift
        // — an unvalidated cross-company id here would silently apply another
        // company's geofence/shift config to every bulk-created sale person.
        const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;
        let resolvedBranchId = null;
        let resolvedShiftId = null;
        if (branchId !== undefined && branchId !== null && branchId !== "") {
            const branch = yield dbConnection_2.Branch.findByPk(Number(branchId));
            if (!branch || (callerCompanyId && Number(branch.companyId) !== callerCompanyId)) {
                (0, errorMessage_1.badRequest)(res, "Branch not found");
                return;
            }
            resolvedBranchId = Number(branchId);
        }
        if (shiftId !== undefined && shiftId !== null && shiftId !== "") {
            const shift = yield dbConnection_2.Shift.findByPk(Number(shiftId));
            if (!shift || (callerCompanyId && Number(shift.companyId) !== callerCompanyId)) {
                (0, errorMessage_1.badRequest)(res, "Shift not found");
                return;
            }
            resolvedShiftId = Number(shiftId);
        }
        // Neither given for this batch — default to the company's main branch
        // (its first-ever registered branch) and its first-ever registered
        // shift instead of leaving every bulk-created sale person unassigned.
        if ((resolvedBranchId === null || resolvedShiftId === null) && callerCompanyId) {
            const defaults = yield (0, companyAccess_1.resolveDefaultBranchAndShift)(callerCompanyId);
            if (resolvedBranchId === null)
                resolvedBranchId = defaults.branchId;
            if (resolvedShiftId === null)
                resolvedShiftId = defaults.shiftId;
        }
        let creatorId;
        if (loginRole === "manager") {
            creatorId = Number(loginUser);
        }
        else {
            if (!createdBy) {
                (0, errorMessage_1.badRequest)(res, "createdBy is required");
                return;
            }
            creatorId = Number(createdBy);
            if (isNaN(creatorId)) {
                (0, errorMessage_1.badRequest)(res, "Invalid createdBy");
                return;
            }
            // FIX: previously createdBy was trusted straight from the request body
            // with no check that it's the caller themself or one of the caller's
            // own subordinates — an admin could attribute the bulk-created
            // sale-persons to a user in a completely different tenant, linking new
            // accounts into that other tenant's hierarchy.
            if (creatorId !== Number(loginUser)) {
                const callerChildIds = yield (0, userHierarchy_1.getAllChildUserIds)(Number(loginUser));
                if (!callerChildIds.includes(creatorId)) {
                    (0, errorMessage_1.forbidden)(res, "createdBy must be yourself or one of your own team members");
                    return;
                }
            }
        }
        // Resolve tenantId from the creator so bulk-created users are scoped correctly
        const creatorRecord = yield dbConnection_2.User.findByPk(creatorId, {
            attributes: ["id", "role", "tenantId"],
        });
        let resolvedTenantId = null;
        if (creatorRecord) {
            if (creatorRecord.role === "user") {
                resolvedTenantId = creatorRecord.id;
            }
            else if (creatorRecord.tenantId) {
                resolvedTenantId = creatorRecord.tenantId;
            }
        }
        if (!req.file) {
            (0, errorMessage_1.badRequest)(res, "CSV file is required");
            return;
        }
        const csvFile = req.file;
        const data = yield (0, spaces_1.getObjectFromSpaces)(csvFile.key, csvFile.bucket);
        if (!data.Body) {
            (0, errorMessage_1.badRequest)(res, "Unable to read CSV from Spaces");
            return;
        }
        const stream = data.Body;
        const rows = [];
        stream
            .pipe((0, csv_parser_1.default)({
            mapHeaders: ({ header }) => header.trim().toLowerCase(),
        }))
            .on("data", (row) => {
            var _a, _b, _c, _d, _e;
            rows.push({
                firstName: ((_a = row.firstname) === null || _a === void 0 ? void 0 : _a.trim()) || "",
                lastName: ((_b = row.lastname) === null || _b === void 0 ? void 0 : _b.trim()) || "",
                email: ((_c = row.email) === null || _c === void 0 ? void 0 : _c.trim().toLowerCase()) || "",
                phone: ((_d = row.phone) === null || _d === void 0 ? void 0 : _d.trim()) || "",
                dob: ((_e = row.dob) === null || _e === void 0 ? void 0 : _e.trim()) || "",
            });
        })
            .on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const invalidRows = [];
                const duplicateInCsv = [];
                const validRows = [];
                const seenEmails = new Set();
                for (const r of rows) {
                    if (!r.firstName ||
                        !r.lastName ||
                        !r.email ||
                        !r.phone ||
                        !r.dob) {
                        invalidRows.push(r);
                        continue;
                    }
                    if (seenEmails.has(r.email)) {
                        duplicateInCsv.push(r);
                        continue;
                    }
                    seenEmails.add(r.email);
                    validRows.push(r);
                }
                const existingByEmail = new Map();
                if (validRows.length > 0) {
                    const existingUsers = yield dbConnection_2.User.findAll({
                        where: Object.assign({ email: { [sequelize_1.Op.in]: validRows.map((r) => r.email) } }, (resolvedTenantId ? { tenantId: resolvedTenantId } : {})),
                        attributes: ["id", "email", "role"],
                        include: [
                            {
                                model: dbConnection_2.User,
                                as: "creators",
                                attributes: ["id"],
                                where: { id: creatorId },
                                required: false,
                                through: { attributes: [] },
                            },
                        ],
                    });
                    for (const user of existingUsers) {
                        existingByEmail.set(user.getDataValue("email"), user);
                    }
                }
                const created = [];
                const linkedExisting = [];
                const skippedDuplicate = [];
                const skippedRoleMismatch = [];
                for (const r of validRows) {
                    const existing = existingByEmail.get(r.email);
                    if (existing) {
                        if (existing.getDataValue("role") !== "sale_person") {
                            skippedRoleMismatch.push(r);
                            continue;
                        }
                        const alreadyLinked = (existing.creators || []).length > 0;
                        if (alreadyLinked) {
                            skippedDuplicate.push(r);
                            continue;
                        }
                        yield existing.addCreators([creatorId]);
                        linkedExisting.push({
                            id: existing.getDataValue("id"),
                            firstName: r.firstName,
                            lastName: r.lastName,
                            email: r.email,
                            phone: r.phone,
                        });
                        continue;
                    }
                    const tempPassword = generateTempPassword();
                    const item = yield dbConnection_2.User.create({
                        firstName: r.firstName,
                        lastName: r.lastName,
                        email: r.email,
                        phone: r.phone,
                        dob: r.dob,
                        password: tempPassword,
                        role: req.body.role,
                        createdBy: creatorId,
                        tenantId: resolvedTenantId,
                        branchId: resolvedBranchId,
                        shiftId: resolvedShiftId,
                    });
                    yield item.setCreators([creatorId]);
                    (0, email_1.sendEmail)("Welcome to SalesVera - Your Login Credentials", tempPassword, r.email, r.firstName, r.lastName).catch((err) => console.error(`Failed to send credentials email to ${r.email}:`, err));
                    created.push({
                        id: item.getDataValue("id"),
                        firstName: r.firstName,
                        lastName: r.lastName,
                        email: r.email,
                        phone: r.phone,
                        tempPassword,
                    });
                }
                (0, errorMessage_1.createSuccess)(res, "Bulk sale person upload completed", {
                    totalCSV: rows.length,
                    created: created.length,
                    linkedExisting: linkedExisting.length,
                    skippedInvalid: invalidRows.length,
                    skippedDuplicateInCsv: duplicateInCsv.length,
                    skippedDuplicate: skippedDuplicate.length,
                    skippedRoleMismatch: skippedRoleMismatch.length,
                    createdSalePersons: created,
                    linkedSalePersons: linkedExisting,
                });
            }
            catch (err) {
                (0, errorMessage_1.badRequest)(res, err instanceof Error
                    ? err.message
                    : "Bulk sale person upload failed", err);
            }
        }));
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.BulkAddSalePerson = BulkAddSalePerson;
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
        const data = yield (0, spaces_1.getObjectFromSpaces)(csvFile.key, csvFile.bucket);
        if (!data.Body) {
            (0, errorMessage_1.badRequest)(res, "Unable to read CSV from Spaces");
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
// Maps a leave_type to the EmployeeLeaveBalance columns it draws from.
// unpaid/short_leave/half_day are not balance-tracked — always approvable.
// Exported so user.ts can run the same balance check at request time (not just on approval).
// LEAVE_BALANCE_FIELDS/countLeaveDays/rejectLeaveAndRestoreBalance/
// approveLeave/assignLeaveBalance/formatLeaveBalance/getEmployeeLeaveBalance/
// getTeamLeaveBalances have moved to src/modules/leave/ — see
// leave.controller.ts/service.ts/repository.ts. Routes are mounted from
// server.ts, same URL paths as before. (user.ts imports
// LEAVE_BALANCE_FIELDS/countLeaveDays from leave.service now.)
const test = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { page = 1, limit = 10, search = "", role } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const createdWhere = {};
        if (search) {
            createdWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        if (role) {
            createdWhere.role = role;
        }
        const result = yield dbConnection_2.User.findByPk(loggedInId, {
            attributes: [
                "id",
                "employeeCode",
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
                        "employeeCode",
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
                    order: [["createdAt", "DESC"]],
                    include: [
                        {
                            model: dbConnection_2.User,
                            as: "createdUsers",
                            attributes: [
                                "id",
                                "employeeCode",
                                "firstName",
                                "lastName",
                                "email",
                                "phone",
                                "role",
                                "createdAt",
                            ],
                            through: { attributes: [] },
                            required: false,
                        },
                    ],
                },
                {
                    model: dbConnection_2.Company,
                    as: "company",
                    attributes: ["id", "companyName"],
                },
            ],
        });
        if (!result) {
            (0, errorMessage_1.badRequest)(res, "User not found");
            return;
        }
        let createdUsers = result.createdUsers || [];
        const total = createdUsers.length;
        createdUsers = createdUsers.slice(offset, offset + limitNum);
        const userJson = result.toJSON();
        userJson.createdUsers = createdUsers;
        (0, errorMessage_1.createSuccess)(res, "Users fetched successfully", {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
            user: userJson,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.test = test;
const UpdateExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { approvedByAdmin, approvedBySuperAdmin, userId, expenseId } = req.body || {};
        // FIX: `role` previously came from req.body — any caller could claim
        // role:"admin" to skip the manager-approval-first gate below. It must
        // come from the server-verified token instead.
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
        // Validate userId
        if (!userId) {
            (0, errorMessage_1.badRequest)(res, "userId is missing");
            return;
        }
        if (!expenseId) {
            (0, errorMessage_1.badRequest)(res, "expenseId is missing");
            return;
        }
        // FIX: previously trusted userId straight from the request body with no
        // check that the employee is on the caller's own team, letting any
        // admin/manager approve another company's expense by ID.
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        if (Number(userId) !== loggedInId && !childIds.includes(Number(userId))) {
            (0, errorMessage_1.forbidden)(res, "You can only manage expenses of your own team members");
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
        // ---------- Admin / Super Admin Approval ----------
        // FIX: role now comes from the verified token (see above), so super_admin
        // reaches this branch as itself instead of needing to misreport its role
        // as "admin" in the request body to pass the old body-trusted check.
        if (role === "admin" || role === "super_admin") {
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
// export const leaveList = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const { page = 1, limit = 10, search = "", role } = req.query;
//     const pageNum = Number(page);
//     const limitNum = Number(limit);
//     const offset = (pageNum - 1) * limitNum;
//     const loggedInId = userData?.userId;
//     const mainWhere: any = { id: loggedInId };
//     const createdWhere: any = {};
//     if (search) {
//       createdWhere[Op.or] = [
//         { firstName: { [Op.iLike]: `%${search}%` } },
//         { lastName: { [Op.iLike]: `%${search}%` } },
//         { email: { [Op.iLike]: `%${search}%` } },
//         { phone: { [Op.iLike]: `%${search}%` } },
//       ];
//     }
//     // Get total count
//     const totalCount = await User.count({
//       where: mainWhere,
//       // include: [
//       //   {
//       //     model: User,
//       //     as: "createdUsers",
//       //     where: createdWhere,
//       //     required: false,
//       //   },
//       // ],
//     });
//     const rows = await User.findByPk(loggedInId, {
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
//           model: User,
//           as: "createdUsers",
//           attributes: ["id", "firstName", "lastName", "email", "phone", "role","createdAt"],
//           through: { attributes: [] },
//           where: createdWhere,
//           required: false,
//           include: [
//             {
//               model: User,
//               as: "createdUsers",
//               attributes: [
//                 "id",
//                 "firstName",
//                 "lastName",
//                 "email",
//                 "phone",
//                 "role",
//                 "createdAt"
//               ],
//               through: { attributes: [] },
//               where: createdWhere,
//               required: false,
//               include: [
//                 {
//                   model: Leave,
//                   as: "Leaves",
//                   required: false,
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//       order: [["createdAt", "DESC"]],
//     });
//     createSuccess(res, "Users fetched successfully", {
//       page: pageNum,
//       limit: limitNum,
//       total: totalCount,
//       pages: Math.ceil(totalCount / limitNum),
//       user: rows,
//     });
//   } catch (error) {
//       const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//     return;
//   }
// };
// getAllChildUserIds has moved to src/modules/shared/userHierarchy.ts
// (imported below) so the leave/attendance/etc. modules can share it
// instead of duplicating the recursive team-hierarchy walk.
// leaveList/getTodayLeaveRequests have moved to src/modules/leave/ — see
// leave.controller.ts/service.ts/repository.ts.
const GetExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData.userId;
        const search = req.query.search;
        const { page, limit, offset } = getPagination(req);
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        const allUserIds = [...childIds];
        console.log("userData", userData);
        console.log("<<>>>>>>>>>>>>>", allUserIds);
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
                    model: dbConnection_2.ExpenseImage,
                    as: "images",
                },
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
        // FIX: previously called badRequest() here without returning, then fell
        // through to the 200 response below anyway — an empty list was never
        // actually an error case, it just tried to send two responses on the
        // same request (crashing with "headers already sent" server-side),
        // which is why this page failed for any company/user with zero expense
        // records instead of just showing an empty list.
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
// getAttendance/markAttendancePresent have moved to src/modules/attendance/
// — see attendance.controller.ts/service.ts/repository.ts.
// cancelLeaveAndMarkPresent has moved to src/modules/leave/ — see
// leave.controller.ts/service.ts/repository.ts.
// bulkMarkAttendance has moved to src/modules/attendance/ — see
// attendance.controller.ts/service.ts/repository.ts.
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
const getDashboardSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData.userId;
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        const todayDateOnly = new Date().toISOString().slice(0, 10);
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        // ── KPI windows ──────────────────────────────────────────────────────
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        const sevenDaysAgoDateOnly = sevenDaysAgo.toISOString().slice(0, 10);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 29);
        const thirtyDaysAgoDateOnly = thirtyDaysAgo.toISOString().slice(0, 10);
        const currentYear = now.getFullYear();
        // Valid Attendance.status enum values that count as "marked" (present in
        // some form) for rate calculations — "late" is a separate boolean
        // column, not a status value, and isn't included here.
        const MARKED_STATUSES = ["in", "present", "out", "leaveApproved"];
        const [presentCount, pendingLeaveApprovalCount, pendingExpenseCount, meetingsThisWeekCount, completedQuotationCount, completedInvoiceCount, attendanceMarkedLast7DaysCount, attendanceMarkedLast30DaysCount, lateMarkedLast30DaysCount, taskTotalCount, taskCompletedCount, taskOverdueCount, leaveBalances, headcountByBranchRaw,] = yield Promise.all([
            dbConnection_2.Attendance.count({
                where: {
                    employee_id: { [sequelize_1.Op.in]: childIds },
                    status: "present",
                    date: todayDateOnly,
                },
            }),
            dbConnection_2.Leave.count({
                where: {
                    employee_id: { [sequelize_1.Op.in]: childIds },
                    status: "pending",
                },
            }),
            dbConnection_2.Expense.count({
                where: {
                    userId: { [sequelize_1.Op.in]: childIds },
                    approvedByAdmin: "pending",
                },
            }),
            dbConnection_2.Meeting.count({
                where: {
                    userId: { [sequelize_1.Op.in]: childIds },
                    scheduledTime: { [sequelize_1.Op.between]: [weekStart, weekEnd] },
                },
            }),
            dbConnection_2.Quotations.count({
                where: {
                    userId: { [sequelize_1.Op.in]: childIds },
                    status: "accepted",
                },
            }),
            dbConnection_2.Invoices.count({
                where: {
                    userId: { [sequelize_1.Op.in]: childIds },
                    status: "accepted",
                },
            }),
            // Attendance rate (last 7 days): marked days / (team size * 7) — a
            // simple proxy, not adjusted for holidays/weekends off, matching the
            // "cheap to compute from data already modeled" brief.
            dbConnection_2.Attendance.count({
                where: {
                    employee_id: { [sequelize_1.Op.in]: childIds },
                    status: { [sequelize_1.Op.in]: MARKED_STATUSES },
                    date: { [sequelize_1.Op.gte]: sevenDaysAgoDateOnly },
                },
            }),
            // Punctuality rate (last 30 days): marked days vs. how many were late.
            dbConnection_2.Attendance.count({
                where: {
                    employee_id: { [sequelize_1.Op.in]: childIds },
                    status: { [sequelize_1.Op.in]: MARKED_STATUSES },
                    date: { [sequelize_1.Op.gte]: thirtyDaysAgoDateOnly },
                },
            }),
            dbConnection_2.Attendance.count({
                where: {
                    employee_id: { [sequelize_1.Op.in]: childIds },
                    late: true,
                    date: { [sequelize_1.Op.gte]: thirtyDaysAgoDateOnly },
                },
            }),
            // Task velocity
            dbConnection_2.Task.count({ where: { assignedTo: { [sequelize_1.Op.in]: childIds } } }),
            dbConnection_2.Task.count({ where: { assignedTo: { [sequelize_1.Op.in]: childIds }, status: { [sequelize_1.Op.in]: ["completed", "done"] } } }),
            dbConnection_2.Task.count({
                where: {
                    assignedTo: { [sequelize_1.Op.in]: childIds },
                    status: { [sequelize_1.Op.notIn]: ["completed", "done", "cancelled"] },
                    dueDate: { [sequelize_1.Op.lt]: now },
                },
            }),
            // Leave utilization (current year)
            dbConnection_2.EmployeeLeaveBalance.findAll({
                where: { employeeId: { [sequelize_1.Op.in]: childIds }, year: currentYear },
                raw: true,
            }),
            // Headcount by branch
            dbConnection_2.User.findAll({
                where: { id: { [sequelize_1.Op.in]: childIds } },
                attributes: ["branchId", [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("id")), "count"]],
                group: ["branchId"],
                raw: true,
            }),
        ]);
        const teamSize = childIds.length || 1;
        const attendanceRateLast7Days = Math.round((attendanceMarkedLast7DaysCount / (teamSize * 7)) * 1000) / 10;
        const punctualityRateLast30Days = attendanceMarkedLast30DaysCount > 0
            ? Math.round(((attendanceMarkedLast30DaysCount - lateMarkedLast30DaysCount) / attendanceMarkedLast30DaysCount) * 1000) / 10
            : null;
        const leaveAllocated = leaveBalances.reduce((sum, b) => sum + (b.casualLeaveAllocated || 0) + (b.sickLeaveAllocated || 0) + (b.paidLeaveAllocated || 0), 0);
        const leaveUsed = leaveBalances.reduce((sum, b) => sum + (b.casualLeaveUsed || 0) + (b.sickLeaveUsed || 0) + (b.paidLeaveUsed || 0), 0);
        const leaveUtilizationRate = leaveAllocated > 0 ? Math.round((leaveUsed / leaveAllocated) * 1000) / 10 : null;
        const headcountByBranch = headcountByBranchRaw.map((r) => ({
            branchId: r.branchId,
            count: Number(r.count),
        }));
        res.status(200).json({
            success: true,
            message: "Dashboard summary fetched successfully",
            data: {
                teamMemberCount: childIds.length,
                presentCount,
                pendingLeaveApprovalCount,
                pendingExpenseCount,
                meetingsThisWeekCount,
                completedQuotationCount,
                completedInvoiceCount,
                kpis: {
                    attendanceRateLast7Days,
                    punctualityRateLast30Days,
                    taskStats: {
                        total: taskTotalCount,
                        completed: taskCompletedCount,
                        overdue: taskOverdueCount,
                        completionRate: taskTotalCount > 0 ? Math.round((taskCompletedCount / taskTotalCount) * 1000) / 10 : null,
                    },
                    leaveUtilizationRate,
                    headcountByBranch,
                },
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getDashboardSummary = getDashboardSummary;
const getTopPerformers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData.userId;
        const limit = Number(req.query.limit) || 5;
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        if (childIds.length === 0) {
            res.status(200).json({
                success: true,
                message: "Top performers fetched successfully",
                data: [],
            });
            return;
        }
        const [users, taskRows, meetingRows] = yield Promise.all([
            dbConnection_2.User.findAll({
                where: { id: { [sequelize_1.Op.in]: childIds } },
                attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
            }),
            // Tasks completed on/before their dueDate
            dbConnection_2.Task.findAll({
                where: {
                    [sequelize_1.Op.and]: [
                        { assignedTo: { [sequelize_1.Op.in]: childIds } },
                        { status: { [sequelize_1.Op.in]: ["completed", "done"] } },
                        { dueDate: { [sequelize_1.Op.ne]: null } },
                        // Compare calendar dates only — dueDate is stored at midnight, so a
                        // same-day completion later in the day must still count as on time.
                        sequelize_1.Sequelize.where((0, sequelize_1.fn)("DATE", (0, sequelize_1.col)("updatedAt")), sequelize_1.Op.lte, (0, sequelize_1.fn)("DATE", (0, sequelize_1.col)("dueDate"))),
                    ],
                },
                attributes: ["assignedTo", [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("id")), "count"]],
                group: ["assignedTo"],
                raw: true,
            }),
            // Meetings that were completed/closed out
            dbConnection_2.Meeting.findAll({
                where: {
                    userId: { [sequelize_1.Op.in]: childIds },
                    status: { [sequelize_1.Op.in]: ["completed", "out"] },
                },
                attributes: ["userId", [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("id")), "count"]],
                group: ["userId"],
                raw: true,
            }),
        ]);
        const taskCountMap = new Map();
        taskRows.forEach((r) => taskCountMap.set(Number(r.assignedTo), Number(r.count)));
        const meetingCountMap = new Map();
        meetingRows.forEach((r) => meetingCountMap.set(Number(r.userId), Number(r.count)));
        const performers = users.map((u) => {
            const tasksCompletedOnTime = taskCountMap.get(u.id) || 0;
            const meetingsDone = meetingCountMap.get(u.id) || 0;
            return {
                id: u.id,
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                phone: u.phone,
                role: u.role,
                tasksCompletedOnTime,
                meetingsDone,
                score: tasksCompletedOnTime + meetingsDone,
            };
        });
        performers.sort((a, b) => b.score - a.score);
        res.status(200).json({
            success: true,
            message: "Top performers fetched successfully",
            data: performers.slice(0, limit),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getTopPerformers = getTopPerformers;
const fetchData = (model_1, where_1, limit_1, offset_1, dateFilter_1, ...args_1) => __awaiter(void 0, [model_1, where_1, limit_1, offset_1, dateFilter_1, ...args_1], void 0, function* (model, where, limit, offset, dateFilter, dateField = "date") {
    return yield model.findAndCountAll({
        // FIX: dateFilter was accepted as a param but never applied to the query —
        // startDate/endDate/lastDays/today filters were silently ignored.
        where: dateFilter && Object.keys(dateFilter).length > 0
            ? Object.assign(Object.assign({}, where), { [dateField]: dateFilter }) : where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
    });
});
// Attendance history for one employee, by id — paginated, optionally filtered
// by startDate/endDate, lastDays, or today (see getDateFilter).
// userAttendance has moved to src/modules/attendance/ — see
// attendance.controller.ts/service.ts/repository.ts.
const userExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId)
            return (0, errorMessage_1.badRequest)(res, "UserId is required", 400);
        // FIX: previously trusted userId straight from the query string with no
        // ownership check — any caller with expense:view could pass any userId
        // and read another team's/company's expense history.
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        const requestedUserId = Number(userId);
        if (requestedUserId !== loggedInId && !childIds.includes(requestedUserId)) {
            return (0, errorMessage_1.forbidden)(res, "You can only view expenses of your own team members");
        }
        const { page, limit, offset } = getPagination(req);
        const dateFilter = getDateFilter(req.query);
        // const user = await findUser(Number(userId));
        // if (!user) return badRequest(res, "User not found", 404);
        const { rows, count } = yield fetchData(dbConnection_2.Expense, { userId: requestedUserId }, limit, offset, dateFilter);
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
// userLeave has moved to src/modules/leave/ — see leave.controller.ts/
// service.ts/repository.ts.
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
// AttendanceBook has moved to src/modules/attendance/ — see
// attendance.controller.ts/service.ts/repository.ts. (Fixed a pre-existing
// double-response bug while moving: the empty-childIds case called
// badRequest() and then fell through to the full query/response anyway —
// same pattern already applied to ownLeave/GetExpense.)
const assignMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, meetingId, scheduledTime } = req.body || {};
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const role = userData === null || userData === void 0 ? void 0 : userData.role;
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
        // FIX: previously neither the meeting's company nor the assignee's team
        // membership were checked — a caller could supply a meetingId belonging
        // to another company and/or an arbitrary userId, cross-linking data
        // across tenants.
        if (role !== "super_admin" && meeting.companyId !== (userData === null || userData === void 0 ? void 0 : userData.companyId)) {
            (0, errorMessage_1.forbidden)(res, "You can only assign meetings within your own company");
            return;
        }
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        if (Number(userId) !== loggedInId && !childIds.includes(Number(userId))) {
            (0, errorMessage_1.forbidden)(res, "You can only assign meetings to your own team members");
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
// ownLeave has moved to src/modules/leave/ — see leave.controller.ts/
// service.ts/repository.ts. (Fixed a pre-existing double-response bug while
// moving: the empty-list case called badRequest() and then fell through to
// createSuccess() anyway — now it returns after badRequest, same pattern
// already applied to GetExpense.)
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
        const { sub_category_name, amount, tax, status, gstedit, totaledit, CategoryId, gst, unit, hsnCode, baseUnit, secondaryUnit } = req.body;
        if (!(sub_category_name === null || sub_category_name === void 0 ? void 0 : sub_category_name.trim())) {
            (0, errorMessage_1.badRequest)(res, "Sub category name is required");
            return;
        }
        if (!CategoryId) {
            (0, errorMessage_1.badRequest)(res, "CategoryId is required");
            return;
        }
        const cleanName = sub_category_name.trim();
        const normalizedName = cleanName.replace(/\s+/g, "").toLowerCase();
        const existingSubCategory = yield dbConnection_2.SubCategory.findOne({
            where: {
                [sequelize_1.Op.and]: [
                    sequelize_1.Sequelize.where(sequelize_1.Sequelize.fn("REPLACE", sequelize_1.Sequelize.fn("LOWER", sequelize_1.Sequelize.col("sub_category_name")), " ", ""), normalizedName),
                    { CategoryId: CategoryId },
                    { adminId: loggedInId },
                ],
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
            gst: gst !== null && gst !== void 0 ? gst : null,
            unit: unit !== null && unit !== void 0 ? unit : null,
            hsnCode: hsnCode !== null && hsnCode !== void 0 ? hsnCode : null,
            baseUnit: baseUnit !== null && baseUnit !== void 0 ? baseUnit : null,
            secondaryUnit: secondaryUnit !== null && secondaryUnit !== void 0 ? secondaryUnit : null,
            gstedit: gstedit !== null && gstedit !== void 0 ? gstedit : null,
            totaledit: totaledit !== null && totaledit !== void 0 ? totaledit : null
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
        const { sub_category_name, amount, tax, CategoryId, status, baseUnit, secondaryUnit, discountedit, gstedit, totaledit, hsnCode } = req.body;
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
        if (status !== undefined) {
            object.status = status;
        }
        if (baseUnit !== undefined) {
            object.baseUnit = baseUnit;
        }
        if (secondaryUnit !== undefined) {
            object.secondaryUnit = secondaryUnit;
        }
        if (discountedit !== undefined) {
            object.discountedit = discountedit;
        }
        if (gstedit !== undefined) {
            object.gstedit = gstedit;
        }
        if (totaledit !== undefined) {
            object.totaledit = totaledit;
        }
        if (hsnCode !== undefined) {
            object.hsnCode = hsnCode;
        }
        object.managerId = loggedInId;
        // Duplicate check ONLY if name is being updated
        if (sub_category_name !== undefined) {
            const cleanName = sub_category_name.trim();
            const normalizedName = cleanName.replace(/\s+/g, "").toLowerCase();
            const duplicate = yield dbConnection_2.SubCategory.findOne({
                where: {
                    [sequelize_1.Op.and]: [
                        sequelize_1.Sequelize.where(sequelize_1.Sequelize.fn("REPLACE", sequelize_1.Sequelize.fn("LOWER", sequelize_1.Sequelize.col("sub_category_name")), " ", ""), normalizedName),
                        { CategoryId: CategoryId !== null && CategoryId !== void 0 ? CategoryId : existingSubCategory.CategoryId },
                        { adminId: loggedInId },
                        { id: { [sequelize_1.Op.ne]: id } },
                    ],
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
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { count, rows } = yield dbConnection_2.Quotations.findAndCountAll({
            where: {
                // userId: userData.userId
                status: {
                    [sequelize_1.Op.notIn]: ["cancelled", "deleted"]
                }
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
        // FIX: previously trusted userId straight from the query string with no
        // ownership check — any caller could pass any userId and read another
        // team's/company's meeting-distance data.
        const loggedInId = Number(userData.userId);
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        if (userId !== loggedInId && !childIds.includes(userId)) {
            (0, errorMessage_1.forbidden)(res, "You can only view meeting distances of your own team members");
            return;
        }
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
        // FIX: previously trusted userId straight from the query string with no
        // ownership check — any caller could pass any userId and read another
        // team's/company's fuel-expense data.
        const loggedInId = Number(userData.userId);
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(loggedInId);
        if (userId !== loggedInId && !childIds.includes(userId)) {
            (0, errorMessage_1.forbidden)(res, "You can only view fuel expenses of your own team members");
            return;
        }
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
// addCompany/getCompany/getCompanyById/updateCompany/assignCompanyManager/
// removeCompanyManager/getCompanyManagers/getMyCompanies/switchCompany/
// deleteCompany/getOwnCompany have moved to src/modules/company/ — see
// company.controller.ts/service.ts/repository.ts. Routes are mounted from
// server.ts, same URL paths as before. (Dropped a leftover debug console.log
// of the full userData object in addCompany while moving.)
// Branch CRUD (addBranch/updateBranch/getBranch/getBranchById) has moved to
// src/modules/branch/ — see branch.controller.ts/service.ts/repository.ts.
// Routes are mounted from server.ts, same URL paths as before.
// validateShiftItem/buildShiftCreateAttrs/addShift have moved to
// src/modules/shift/ — see shift.controller.ts/service.ts/repository.ts.
// Routes are mounted from server.ts, same URL paths as before.
// (assignEmployeeShift below stays here — cross-domain concern, not shift-only.)
// ============================================================
// PATCH /admin/assign-employee-shift
// Assign (or clear) an employee's shift/department/branch — there was
// previously no way to do this at all; the attendance engine needs it to
// resolve "this employee's assigned shift" instead of a hardcoded default.
// Body: { employeeId, shiftId?, departmentId?, branchId? } (null clears)
// ============================================================
const assignEmployeeShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const loggedInId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!userData || !loggedInId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const { employeeId, shiftId, departmentId, branchId } = req.body || {};
        if (!employeeId || isNaN(Number(employeeId))) {
            (0, errorMessage_1.badRequest)(res, "Valid employeeId is required");
            return;
        }
        const childIds = yield (0, userHierarchy_1.getAllChildUserIds)(Number(loggedInId));
        if (Number(employeeId) !== Number(loggedInId) && !childIds.includes(Number(employeeId))) {
            (0, errorMessage_1.forbidden)(res, "You can only assign shifts to your own team members");
            return;
        }
        const employee = yield dbConnection_2.User.findByPk(Number(employeeId));
        if (!employee) {
            (0, errorMessage_1.badRequest)(res, "Employee not found");
            return;
        }
        // FIX: previously only checked that the shift/department *existed*
        // anywhere in the system, and branchId wasn't validated at all — a
        // caller could assign an employee a shift/branch/department belonging
        // to a completely different company, silently applying that other
        // company's geofence/working-hours config to this employee's attendance.
        // Every reference must belong to the caller's own resolved company.
        const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;
        if (shiftId !== undefined && shiftId !== null) {
            const shift = yield dbConnection_2.Shift.findByPk(Number(shiftId));
            if (!shift || (callerCompanyId && Number(shift.companyId) !== callerCompanyId)) {
                (0, errorMessage_1.badRequest)(res, "Shift not found");
                return;
            }
        }
        if (departmentId !== undefined && departmentId !== null) {
            const department = yield dbConnection_2.Department.findByPk(Number(departmentId));
            if (!department || (callerCompanyId && Number(department.companyId) !== callerCompanyId)) {
                (0, errorMessage_1.badRequest)(res, "Department not found");
                return;
            }
        }
        if (branchId !== undefined && branchId !== null) {
            const branch = yield dbConnection_2.Branch.findByPk(Number(branchId));
            if (!branch || (callerCompanyId && Number(branch.companyId) !== callerCompanyId)) {
                (0, errorMessage_1.badRequest)(res, "Branch not found");
                return;
            }
        }
        const updates = {};
        if (shiftId !== undefined)
            updates.shiftId = shiftId === null ? null : Number(shiftId);
        if (departmentId !== undefined)
            updates.departmentId = departmentId === null ? null : Number(departmentId);
        if (branchId !== undefined)
            updates.branchId = branchId === null ? null : Number(branchId);
        yield employee.update(updates);
        (0, errorMessage_1.createSuccess)(res, "Employee shift assignment updated", {
            id: employee.getDataValue("id"),
            shiftId: employee.getDataValue("shiftId"),
            departmentId: employee.getDataValue("departmentId"),
            branchId: employee.getDataValue("branchId"),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.assignEmployeeShift = assignEmployeeShift;
// updateShift/getShift/getShiftById have moved to src/modules/shift/ — see
// shift.controller.ts/service.ts/repository.ts. Routes are mounted from
// server.ts, same URL paths as before.
// Department CRUD (addDepartment/updateDepartment/getDepartment/
// getDepartmentById) has moved to src/modules/department/ — see
// department.controller.ts/service.ts/repository.ts. Routes are mounted
// from server.ts, same URL paths as before.
// Holiday CRUD (addHoliday/updateHoliday/getHoliday/getHolidayById) has
// moved to src/modules/holiday/ — see holiday.controller.ts/service.ts/
// repository.ts. Routes are mounted from server.ts, same URL paths as
// before, so nothing outside this file changed.
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
        // const existing = await Quotations.findOne({
        //   where: {
        //     userId: Number(userData.userId),
        //     referenceNumber: data.referenceNumber
        //   }
        // });
        // if (existing) {
        //    badRequest(res, "Quotation already exists with this reference number");
        //    return
        // }
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
            guid: data.guid || null,
            alterid: data.alterid || null
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
        // ✅ Validate status
        const allowedStatus = ["draft", "accepted", "rejected"];
        if (status && !allowedStatus.includes(status)) {
            return (0, errorMessage_1.badRequest)(res, "Invalid status value");
        }
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
        // ✅ Base where condition for Quotations
        // We now filter by all IDs discovered in the hierarchy (Self + all Descendants)
        let whereCondition = {
            userId: { [sequelize_1.Op.in]: teamUserIds },
            status: {
                [sequelize_1.Op.notIn]: ["cancelled", "deleted"]
            }
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
        quotationData.TallyAPISync = true;
        yield quotationData.save();
        (0, errorMessage_1.createSuccess)(res, "Quotation updated successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateQuotation = updateQuotation;
// addLeave/getLeave/getLeaveById/updateLeave (CompanyLeave leave-type
// policy CRUD) have moved to src/modules/leave/ — see leave.controller.ts/
// service.ts/repository.ts. Routes are mounted from server.ts, same URL
// paths as before.
// addCompanyBank has moved to src/modules/company/ — see
// company.controller.ts/service.ts/repository.ts.
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
        const { tallyInvoiceNumber = "web", customerName, quotationId, status, QuotationNumber, QuotationDate, date, guid, alterid } = data, restData = __rest(data, ["tallyInvoiceNumber", "customerName", "quotationId", "status", "QuotationNumber", "QuotationDate", "date", "guid", "alterid"]);
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
            guid: guid || null,
            alterid: alterid || null
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
        // Drafts are gated separately via proformainvoice:view — a user with only
        // invoice:view should not see draft-status invoices in the list.
        const canViewDraft = yield (0, checkPermission_1.userHasPermission)(Number(userData.userId), userData.role, "proformainvoice", "view");
        // ✅ FIX: Use ONLY ONE whereCondition
        let whereCondition = {
            userId: { [sequelize_1.Op.in]: teamUserIds },
            status: {
                [sequelize_1.Op.notIn]: canViewDraft ? ["cancelled", "deleted"] : ["cancelled", "deleted", "draft"]
            }
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
            // Without proformainvoice:view, drop "draft" from an explicit status filter too.
            if (!canViewDraft) {
                statusArray = statusArray.filter((s) => s !== "draft");
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
        invoice.TallyAPISync = true;
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
        // ✅ DUPLICATE CHECK (referenceNo + date)
        const conditions = reports.map((item) => ({
            referenceNo: item.referenceNo,
            date: item.date,
        }));
        const existingReports = yield dbConnection_2.Report.findAll({
            where: {
                [sequelize_1.Op.or]: conditions,
            },
        });
        if (existingReports.length > 0) {
            const duplicates = existingReports
                .map((r) => `Ref: ${r.referenceNo}, Date: ${r.date}`)
                .join("; ");
            (0, errorMessage_1.badRequest)(res, `Duplicate reports found: ${duplicates}`);
            return;
        }
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
const assignAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        let obj = {};
        if (req.body.adminId) {
            obj.adminId = req.body.adminId;
        }
        if (req.body.managerId) {
            obj.managerId = req.body.managerId;
        }
        const item = yield dbConnection_2.Company.update(obj, {
            where: {
                id: Number(req.params.id)
            }
        });
        (0, errorMessage_1.createSuccess)(res, "Admin assigned successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.assignAdmin = assignAdmin;
// forgotPassword/verifyOtp/changePassword have moved to src/modules/auth/
// — see auth.controller.ts/service.ts/repository.ts.
