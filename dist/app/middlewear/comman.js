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
exports.withuserlogin = exports.getCategory = exports.findOneByCondition = exports.deleteByCondition = exports.findAllWithInclude = exports.findOneWithInclude = exports.updateByCondition = exports.UpdateData = exports.findByOTP = exports.Pipeline = exports.Update = exports.getById = exports.DeleteItembyId = exports.getAllList2 = exports.getAllList3 = exports.getAllList = exports.GetPost = exports.CreateData2 = exports.CreateData = exports.CreateToken = exports.FindByPhone2 = exports.FindByPhone = exports.FindByField = exports.findByRole = exports.FindByEmail = void 0;
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("../../config/dbConnection");
// Find by email (Sequelize version)
const FindByEmail = (model, email) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.findOne({ where: { email } }); // ✅ correct Sequelize syntax
    }
    catch (error) {
        console.error("Error in FindByEmail:", error);
        throw error;
    }
});
exports.FindByEmail = FindByEmail;
const findByRole = (model, role) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.findOne({ where: { role } });
    }
    catch (error) {
        throw error;
    }
});
exports.findByRole = findByRole;
const FindByField = (model, fieldName, fieldValue, id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Normalize value: lowercase + remove spaces
        const normalizedValue = fieldValue.replace(/\s+/g, "").toLowerCase();
        return yield model.findOne({
            where: sequelize_1.Sequelize.where(sequelize_1.Sequelize.fn("REPLACE", sequelize_1.Sequelize.fn("LOWER", sequelize_1.Sequelize.col(fieldName)), " ", ""), normalizedValue),
        });
    }
    catch (error) {
        console.error(`Error in FindByFieldNormalized (${fieldName}):`, error);
        throw error;
    }
});
exports.FindByField = FindByField;
const FindByPhone = (model, phone) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.findOne({ where: { phone } });
    }
    catch (err) {
        return err;
    }
});
exports.FindByPhone = FindByPhone;
const FindByPhone2 = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.findOne({ where: { phoneNumber: data } });
    }
    catch (err) {
        return err;
    }
});
exports.FindByPhone2 = FindByPhone2;
// Create JWT token
// export const CreateToken = (userId: string,role:string): string => {
//   return jwt.sign({ userId,role }, process.env.JWT_SECRET || "secret", {
//     expiresIn: "1d",
//   });
// };
const CreateToken = (userId, role) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId, role }, process.env.JWT_SECRET || "dovetailPharma", { expiresIn: "1d" } // short-lived
    );
    const refreshToken = jsonwebtoken_1.default.sign({ userId, role }, process.env.JWT_SECRET || "dovetailPharma", { expiresIn: "7d" } // long-lived
    );
    return { accessToken, refreshToken };
};
exports.CreateToken = CreateToken;
// crate data 
const CreateData = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Creating data with:", JSON.stringify(data, null, 2));
        return yield model.create(data);
    }
    catch (error) {
        console.error("Error in CreateData:", error);
        throw new Error("Failed to create data");
    }
});
exports.CreateData = CreateData;
const CreateData2 = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.create(data);
    }
    catch (error) {
        console.error("Error in CreateData:", error);
        throw new Error("Failed to create data");
    }
});
exports.CreateData2 = CreateData2;
// get post 
const GetPost = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const item = yield model.findAll();
        return item;
    }
    catch (error) {
        return error;
    }
});
exports.GetPost = GetPost;
const getAllList = (model_1, ...args_1) => __awaiter(void 0, [model_1, ...args_1], void 0, function* (model, data = {}, searchFields = []) {
    try {
        const { page = 1, limit = 10, date, search } = data, filters = __rest(data, ["page", "limit", "date", "search"]);
        const whereConditions = Object.assign({}, filters);
        if (date) {
            whereConditions.date = date;
        }
        // 🔍 Add search functionality
        if (search && searchFields.length > 0) {
            whereConditions[sequelize_1.Op.or] = searchFields.map((field) => ({
                [field]: { [sequelize_1.Op.like]: `%${search}%` }, // Or Op.iLike if Postgres
            }));
        }
        const offset = (Number(page) - 1) * Number(limit);
        const { count, rows } = yield model.findAndCountAll({
            where: whereConditions,
            limit: Number(limit),
            offset,
        });
        if (rows.length === 0) {
            throw new Error("Company does not exist");
        }
        return {
            success: true,
            data: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalRecords: count,
                totalPages: Math.ceil(count / Number(limit)),
            },
        };
    }
    catch (error) {
        console.error("Database Error:", error);
        throw error;
    }
});
exports.getAllList = getAllList;
const getAllList3 = (model_1, ...args_1) => __awaiter(void 0, [model_1, ...args_1], void 0, function* (model, data = {}, searchFields = [], include = []) {
    try {
        const { page = 1, limit = 10, date, search } = data, filters = __rest(data, ["page", "limit", "date", "search"]);
        const whereConditions = {};
        // Only keep actual filters, not pagination values
        Object.keys(filters).forEach((key) => {
            if (filters[key] !== undefined && filters[key] !== "") {
                whereConditions[key] = filters[key];
            }
        });
        if (date) {
            whereConditions.date = date;
        }
        if (search && searchFields.length > 0) {
            whereConditions[sequelize_1.Op.or] = searchFields.map((field) => ({
                [field]: { [sequelize_1.Op.iRegexp]: `^${search}` },
            }));
        }
        const offset = (Number(page) - 1) * Number(limit);
        const rows = yield model.findAll({
            where: whereConditions,
            include,
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
        });
        console.log(rows.length);
        let count = rows.length;
        return {
            success: true,
            data: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalRecords: count,
                totalPages: Math.ceil(count / Number(limit)),
            },
        };
    }
    catch (error) {
        console.error("Database Error:", error);
        throw error;
    }
});
exports.getAllList3 = getAllList3;
const getAllList2 = (model_1, ...args_1) => __awaiter(void 0, [model_1, ...args_1], void 0, function* (model, data = {}, searchFields = [], extraOptions = {}) {
    try {
        const { page = 1, limit = 10, search } = data, filters = __rest(data, ["page", "limit", "search"]);
        const offset = (Number(page) - 1) * Number(limit);
        const whereConditions = Object.assign({}, filters);
        // 🔍 Add search functionality
        if (search && searchFields.length > 0) {
            whereConditions[sequelize_1.Op.or] = searchFields.map((field) => ({
                [field]: { [sequelize_1.Op.like]: `%${search}%` }, // Or Op.iLike if Postgres
            }));
        }
        const result = yield model.findAndCountAll({
            where: whereConditions,
            limit: Number(limit),
            offset,
            include: extraOptions.include || [], // ✅ allow associations
            order: [["createdAt", "DESC"]],
            distinct: true, // ✅ ensures unique lead IDs in count
        });
        let count = result.count;
        // console.log(">>>>>>>>>>>>>>>>>>count",count)
        return {
            data: result.rows,
            pagination: {
                total: result.count,
                page: Number(page),
                limit: Number(limit),
                totalRecords: count,
                totalPages: Math.ceil(count / Number(limit)),
            },
        };
    }
    catch (error) {
        console.error("Error in getAllList:", error);
        throw error;
    }
});
exports.getAllList2 = getAllList2;
const DeleteItembyId = (model, id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deletedCount = yield model.destroy({
            where: { id }
        });
        return deletedCount;
    }
    catch (error) {
        throw error;
    }
});
exports.DeleteItembyId = DeleteItembyId;
const getById = (model, id, user_id // optional parameter
) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let result;
        if (user_id) {
            // ✅ When user_id is provided → use `findOne` with both conditions
            result = yield model.findOne({
                where: { id, user_id },
            });
        }
        else {
            // ✅ When only id is provided → use `findByPk`
            result = yield model.findByPk(id);
        }
        return result;
    }
    catch (error) {
        console.error("Get By ID Error:", error);
        throw error;
    }
});
exports.getById = getById;
const Update = (model, id, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.update(data, {
            where: { id }
        });
    }
    catch (error) {
        throw error;
    }
});
exports.Update = Update;
const Pipeline = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = +data.page || 1;
        const limit = +data.limit || 10;
        const offset = (page - 1) * limit;
        const where = {};
        // Always filter by user_id if present
        if (data.user_id) {
            where.user_id = data.user_id;
        }
        // Optional search filters
        if (data.search) {
            where[sequelize_1.Op.or] = [
                { company_name: { [sequelize_1.Op.iLike]: `%${data.search}%` } },
                { company_email: { [sequelize_1.Op.iLike]: `%${data.search}%` } },
            ];
        }
        // Optional status filter
        if (data.status) {
            where.status = data.status;
        }
        // Optional state filter (future)
        if (data.state) {
            where.state = data.state;
        }
        // Optional city filter (future)
        if (data.city) {
            where.city = data.city;
        }
        const { count, rows } = yield model.findAndCountAll({
            where,
            offset,
            limit,
            order: [["createdAt", "DESC"]],
        });
        const totalPages = Math.ceil(count / limit);
        return {
            totalCount: count,
            totalPages,
            rows,
        };
    }
    catch (err) {
        console.error("Pipeline error:", err);
        return {
            totalCount: 0,
            totalPages: 0,
            rows: [],
        };
    }
});
exports.Pipeline = Pipeline;
const findByOTP = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const item = yield model.findOne({
            where: { otp: data.otp } // ✅ Add `where` if using Sequelize
        });
        return item; // Will return null if not found
    }
    catch (error) {
        throw error; // Let caller handle the error properly
    }
});
exports.findByOTP = findByOTP;
const UpdateData = (model, id, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [affectedRows] = yield model.update(data, {
            where: { id },
        });
        if (affectedRows === 0) {
            return null; // No record updated
        }
        return yield model.findByPk(id);
    }
    catch (error) {
        console.error("Error in Update:", error);
        throw new Error("Failed to update data");
    }
});
exports.UpdateData = UpdateData;
const updateByCondition = (model, condition, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.update(data, {
            where: condition
        });
    }
    catch (error) {
        console.error("Update Error:", error);
        throw error;
    }
});
exports.updateByCondition = updateByCondition;
const findOneWithInclude = (_a) => __awaiter(void 0, [_a], void 0, function* ({ baseModel, id, include, primaryKeyField = "id", }) {
    return yield baseModel.findOne({
        where: { [primaryKeyField]: id },
        include,
    });
});
exports.findOneWithInclude = findOneWithInclude;
const findAllWithInclude = (_a) => __awaiter(void 0, [_a], void 0, function* ({ baseModel, include = [], where = {}, limit, offset, order, }) {
    return yield baseModel.findAll({
        where,
        include,
        limit,
        offset,
        order,
    });
});
exports.findAllWithInclude = findAllWithInclude;
const deleteByCondition = (baseModel, condition) => __awaiter(void 0, void 0, void 0, function* () {
    return yield baseModel.destroy({
        where: condition,
    });
});
exports.deleteByCondition = deleteByCondition;
const findOneByCondition = (model, condition) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield model.findOne({ where: condition });
    }
    catch (error) {
        console.error("Find One Error:", error);
        throw error;
    }
});
exports.findOneByCondition = findOneByCondition;
const getCategory = (Model_1, data_1, ...args_1) => __awaiter(void 0, [Model_1, data_1, ...args_1], void 0, function* (Model, data, id = "", login = "") {
    try {
        const { page = 1, limit = 10, search = "", category_id } = data;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.name = { [sequelize_1.Op.iLike]: `%${search}%` };
        }
        if (id) {
            where.user_id = id;
        }
        if (id) {
            where.adminId = id;
        }
        if (id) {
            where.managerId = id;
        }
        // ✅ If filtering by category_id, use include instead of where
        const include = [];
        if (category_id) {
            include.push({
                model: dbConnection_1.Category,
                as: "categories",
                where: { id: Number(category_id) },
                through: { attributes: [] }, // hides junction table fields
            });
        }
        // ✅ Total count with include
        const totalItems = yield Model.count({
            where,
            include: include.length ? include : undefined,
            distinct: true,
        });
        // ✅ Fetch rows with pagination & include
        const rows = yield Model.findAll({
            where,
            include: include.length ? include : undefined,
            limit: limitNum,
            offset,
            order: [["createdAt", "DESC"]],
        });
        return {
            rows,
            pagination: {
                totalItems,
                currentPage: pageNum,
                totalPages: Math.ceil(totalItems / limitNum),
                limit: limitNum,
            },
        };
    }
    catch (error) {
        throw error;
    }
});
exports.getCategory = getCategory;
const withuserlogin = (model_1, id_1, ...args_1) => __awaiter(void 0, [model_1, id_1, ...args_1], void 0, function* (model, id, data = {}, searchFields = [], include = []) {
    try {
        const { page = 1, limit = 10, date, search } = data, filters = __rest(data, ["page", "limit", "date", "search"]);
        const whereConditions = {};
        if (id) {
            whereConditions.employee_id = id;
        }
        // Only keep actual filters, not pagination values
        Object.keys(filters).forEach((key) => {
            if (filters[key] !== undefined && filters[key] !== "") {
                whereConditions[key] = filters[key];
            }
        });
        if (date) {
            whereConditions.date = date;
        }
        if (search && searchFields.length > 0) {
            whereConditions[sequelize_1.Op.or] = searchFields.map((field) => ({
                [field]: { [sequelize_1.Op.iRegexp]: `^${search}` },
            }));
        }
        const offset = (Number(page) - 1) * Number(limit);
        const rows = yield model.findAll({
            where: whereConditions,
            include,
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
        });
        console.log(rows.length);
        let count = rows.length;
        return {
            success: true,
            data: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalRecords: count,
                totalPages: Math.ceil(count / Number(limit)),
            },
        };
    }
    catch (error) {
        console.error("Database Error:", error);
        throw error;
    }
});
exports.withuserlogin = withuserlogin;
