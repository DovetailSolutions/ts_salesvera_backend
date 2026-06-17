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
exports.getDistance = exports.getAllSubordinateIds = exports.getAllListCategory = exports.withuserlogin = exports.getCategory = exports.findOneByCondition = exports.deleteByCondition = exports.findAllWithInclude = exports.findOneWithInclude = exports.updateByCondition = exports.UpdateData = exports.findByOTP = exports.Pipeline = exports.Update = exports.getById = exports.DeleteItembyId = exports.getAllList2 = exports.getAllList3 = exports.getAllList = exports.GetPost = exports.CreateData2 = exports.CreateData = exports.CreateToken = exports.FindByPhone2 = exports.FindByPhone = exports.FindByField = exports.findByRole = exports.FindByEmailInTenant = exports.FindByEmail = void 0;
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("../../config/dbConnection");
const axios_1 = __importDefault(require("axios"));
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
// Tenant-scoped email lookup — same email can exist in different tenant trees
const FindByEmailInTenant = (model, email, tenantId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (tenantId === null || tenantId === undefined) {
            // super_admin / user (tenant root) — global uniqueness
            return yield model.findOne({ where: { email } });
        }
        return yield model.findOne({ where: { email, tenantId } });
    }
    catch (error) {
        console.error("Error in FindByEmailInTenant:", error);
        throw error;
    }
});
exports.FindByEmailInTenant = FindByEmailInTenant;
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
            // where: Sequelize.where(
            //   Sequelize.fn(
            //     "REPLACE",
            //     Sequelize.fn("LOWER", Sequelize.col(fieldName)),
            //     " ",
            //     ""
            //   ),
            //   normalizedValue
            // ),
            where: {
                [sequelize_1.Op.and]: [
                    sequelize_1.Sequelize.where(sequelize_1.Sequelize.fn("REPLACE", sequelize_1.Sequelize.fn("LOWER", sequelize_1.Sequelize.col(fieldName)), " ", ""), normalizedValue),
                    { adminId: id }
                ]
            }
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
const CreateToken = (userId, role, companyId) => {
    const payload = { userId, role };
    if (companyId)
        payload.companyId = Number(companyId);
    console.log("Creating token with payload:", payload);
    const accessToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || "dovetailPharma", { expiresIn: "30d" } // short-lived
    );
    const refreshToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || "dovetailPharma", { expiresIn: "60d" } // long-lived
    );
    return { accessToken, refreshToken };
};
exports.CreateToken = CreateToken;
// crate data 
const CreateData = (model, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
        // ✅ Pagination calculation
        const pageNum = Number(page);
        const limitNum = Math.min(Number(limit), 50); // safety limit
        const offset = (pageNum - 1) * limitNum;
        // -------------------------
        // MAIN WHERE
        // -------------------------
        const where = {};
        // 🔍 Search (case-insensitive)
        if (search) {
            where.name = {
                [sequelize_1.Op.iLike]: `%${search}%`,
            };
        }
        // 👤 User filter
        if (id) {
            where.user_id = id;
        }
        // Filter categories by the admin who created them
        if (login) {
            where.adminId = login;
        }
        // -------------------------
        // INCLUDE CATEGORY FILTER
        // -------------------------
        const include = [];
        if (category_id) {
            include.push({
                model: dbConnection_1.Category,
                as: "categories",
                where: {
                    id: Number(category_id),
                    [sequelize_1.Op.or]: [
                        { adminId: login },
                        { managerId: login },
                    ],
                },
                through: { attributes: [] },
            });
        }
        // -------------------------
        // FETCH DATA + COUNT
        // -------------------------
        const { rows, count } = yield Model.findAndCountAll({
            where,
            include: include.length ? include : undefined,
            limit: limitNum,
            offset,
            order: [["createdAt", "DESC"]],
            distinct: true, // important when using include
        });
        // -------------------------
        // RESPONSE
        // -------------------------
        return {
            rows,
            totalItems: count,
            currentPage: pageNum,
            totalPages: Math.ceil(count / limitNum),
            limit: limitNum,
        };
    }
    catch (error) {
        throw error;
    }
});
exports.getCategory = getCategory;
const withuserlogin = (model_1, id_1, ...args_1) => __awaiter(void 0, [model_1, id_1, ...args_1], void 0, function* (model, id, data = {}, searchFields = [], include = []) {
    try {
        const { page = 1, limit = 10, month, year, search } = data, filters = __rest(data, ["page", "limit", "month", "year", "search"]);
        const whereConditions = {};
        if (id) {
            whereConditions.employee_id = id;
        }
        // Normal filters
        Object.keys(filters).forEach((key) => {
            if (filters[key] !== undefined && filters[key] !== "") {
                whereConditions[key] = filters[key];
            }
        });
        // Month filter
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            whereConditions.date = {
                [sequelize_1.Op.between]: [startDate, endDate],
            };
        }
        // Search
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
        const count = rows.length;
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
const getAllListCategory = (model_1, ...args_1) => __awaiter(void 0, [model_1, ...args_1], void 0, function* (model, data = {}, searchFields = []) {
    try {
        const { page = 1, limit = 100, date, search } = data, filters = __rest(data, ["page", "limit", "date", "search"]);
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
            include: [
                {
                    model: dbConnection_1.SubCategory,
                    as: "subCategories",
                    required: false
                }
            ],
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
exports.getAllListCategory = getAllListCategory;
const getAllSubordinateIds = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let rootId = userId;
    let currentId = userId;
    // 1. Climb UP to find the highest 'admin' or 'manager' (Company Root)
    // This ensures we capture the entire company tree starting from the top.
    while (true) {
        const userWithCreators = yield dbConnection_1.User.findByPk(currentId, {
            include: [
                {
                    model: dbConnection_1.User,
                    as: "creators",
                    attributes: ["id", "role"],
                    through: { attributes: [] },
                },
            ],
        });
        if (!userWithCreators)
            break;
        const creator = (_a = userWithCreators.creators) === null || _a === void 0 ? void 0 : _a[0];
        if (!creator)
            break;
        // If we hit a super_admin, we stop climbing and keep the previous valid root
        if (creator.role === "super_admin") {
            break;
        }
        // Update rootId to the creator if they are an admin or manager
        if (["admin", "manager"].includes(creator.role)) {
            rootId = creator.id;
        }
        // Move up to the next level
        currentId = creator.id;
    }
    // 2. Fetch all subordinates DOWN from the rootId (Full hierarchy)
    let teamUserIds = [];
    // Check if root itself is not super_admin
    const rootUser = yield dbConnection_1.User.findByPk(rootId);
    if (rootUser && rootUser.role !== "super_admin") {
        teamUserIds.push(rootId);
    }
    let queue = [rootId];
    let processedIds = new Set([rootId]);
    while (queue.length > 0) {
        const pid = queue.shift();
        const userWithCreated = yield dbConnection_1.User.findByPk(pid, {
            include: [
                {
                    model: dbConnection_1.User,
                    as: "createdUsers",
                    attributes: ["id", "role"],
                    through: { attributes: [] },
                },
            ],
        });
        if (userWithCreated === null || userWithCreated === void 0 ? void 0 : userWithCreated.createdUsers) {
            for (const child of userWithCreated.createdUsers) {
                if (!processedIds.has(child.id)) {
                    processedIds.add(child.id);
                    // Only include manager, sale_person, admin etc. but NOT super_admin
                    if (child.role !== "super_admin") {
                        teamUserIds.push(child.id);
                        queue.push(child.id);
                    }
                }
            }
        }
        // Fallback: also pick up users linked via the direct createdBy FK column
        // (covers users created before the junction table was populated, or whose
        // junction-table row is missing for any other reason).
        const childrenByCreatedBy = yield dbConnection_1.User.findAll({
            where: { createdBy: pid, role: { [sequelize_1.Op.ne]: "super_admin" } },
            attributes: ["id", "role"],
        });
        for (const child of childrenByCreatedBy) {
            if (!processedIds.has(child.id)) {
                processedIds.add(child.id);
                teamUserIds.push(child.id);
                queue.push(child.id);
            }
        }
    }
    return teamUserIds;
});
exports.getAllSubordinateIds = getAllSubordinateIds;
const getDistance = (lat1, lng1, lat2, lng2, meetingId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const url = "https://maps.googleapis.com/maps/api/distancematrix/json";
        const response = yield axios_1.default.get(url, {
            params: {
                origins: `${lat1},${lng1}`,
                destinations: `${lat2},${lng2}`,
                key: process.env.GOOGLE_MAP_API_KEY,
            },
        });
        const data = response.data;
        if (data.status === "OK" &&
            ((_d = (_c = (_b = (_a = data.rows) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.elements) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.status) === "OK") {
            const distanceInMeters = data.rows[0].elements[0].distance.value;
            const distanceInKm = Number((distanceInMeters / 1000).toFixed(3));
            // < 1 km → show in meters, >= 1 km → show in km
            const display = distanceInMeters < 1000
                ? `${distanceInMeters} m`
                : `${distanceInKm} km`;
            // Save to meeting if distance >= 1 meter
            if (distanceInMeters >= 1 && meetingId) {
                yield dbConnection_1.Meeting.update({ legDistance: display }, { where: { id: meetingId } });
            }
            return { meters: distanceInMeters, km: distanceInKm, display };
        }
        return { meters: 0, km: 0, display: "0 m" };
    }
    catch (error) {
        console.log("Distance API Error:", error);
        return { meters: 0, km: 0, display: "0 m" };
    }
});
exports.getDistance = getDistance;
