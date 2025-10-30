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
exports.deleteProduct = exports.updateProduct = exports.getProjectDetails = exports.getProjectList = exports.AddPropertys = exports.addProdut = exports.getCategory = exports.Logout = exports.scheduled = exports.GetMeetingList = exports.EndMeeting = exports.CreateMeeting = exports.MySalePerson = exports.UpdateProfile = exports.GetProfile = exports.Login = exports.Register = void 0;
const sequelize_1 = require("sequelize");
const bcrypt_1 = __importDefault(require("bcrypt"));
// import csv from "csv-parser";
// import fs from "fs";
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_1 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const web_1 = require("stream/web");
const Register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone } = req.body;
        const isExist = yield dbConnection_1.User.findOne({
            where: { phone },
        }); // ✅ pass as an object
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, "Phone number already exists");
        }
        const item = yield dbConnection_1.User.create({
            phone,
            role: "user",
        });
        (0, errorMessage_1.createSuccess)(res, "admin register done", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.Register = Register;
const Login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, deviceToken, devicemodel, devicename, deviceType, deviceId } = req.body || {};
        console.log(">>>>>>>>>>>>>>>>>>>req.body", req.body);
        if (!email || !password) {
            (0, errorMessage_1.badRequest)(res, "Email and password are required");
            return;
        }
        // ✅ Check if user exists
        const user = yield Middleware.FindByEmail(dbConnection_1.User, email);
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
            return;
        }
        // ✅ Validate password
        const hashedPassword = user.getDataValue("password");
        const isPasswordValid = yield bcrypt_1.default.compare(password, hashedPassword);
        if (!isPasswordValid) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
            web_1.ReadableStreamDefaultController;
        }
        // ✅ Create access & refresh tokens
        const { accessToken, refreshToken } = Middleware.CreateToken(String(user.getDataValue("id")), String(user.getDataValue("role")));
        // ✅ Save refresh token in DB
        yield user.update({ refreshToken });
        if (deviceToken) {
            const existing = yield dbConnection_1.Device.findOne({ where: { deviceToken } });
            if (!existing) {
                yield dbConnection_1.Device.create({
                    userId: user === null || user === void 0 ? void 0 : user.id,
                    deviceToken,
                    deviceType,
                    deviceId,
                    devicemodel,
                    devicename,
                    isActive: true, // ✅ REQUIRED
                });
            }
            else {
                yield existing.update({
                    userId: user.id,
                    deviceType,
                    devicemodel,
                    devicename,
                    deviceId,
                    isActive: true,
                });
            }
        }
        // ✅ Respond to client
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            accessToken,
            refreshToken,
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
        const item = yield Middleware.getById(dbConnection_1.User, Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "user details", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.GetProfile = GetProfile;
const UpdateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { firstName, lastName, email } = req.body || {};
        // ✅ Build update object dynamically
        const updates = { firstName, lastName, email };
        const filteredUpdates = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined && v !== ""));
        if (Object.keys(filteredUpdates).length === 0) {
            (0, errorMessage_1.badRequest)(res, "No valid fields provided to update");
            return;
        }
        // ✅ Update user
        const updatedUser = yield Middleware.Update(dbConnection_1.User, Number(userData.userId), filteredUpdates);
        if (!updatedUser) {
            (0, errorMessage_1.badRequest)(res, "User not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Profile updated successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.UpdateProfile = UpdateProfile;
const MySalePerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const userData = req.userData;
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
        const result = yield dbConnection_1.User.findByPk(userData.userId, {
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
const CreateMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const isExist = yield dbConnection_1.Meeting.findOne({
            where: {
                userId: finalUserId,
                status: "in", // You wrote "in" but in schema you used: pending | completed | cancelled
            },
        });
        /** ✅ If active meeting exists → Stop */
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, `You already have an active meeting started at ${isExist.meetingTimeIn}`);
            return;
        }
        const { companyName, personName, mobileNumber, customerType, meetingPurpose, categoryId, status, latitude_in, longitude_in, meetingTimeIn, scheduledTime, } = req.body || {};
        /** ✅ Required fields validation */
        const requiredFields = {
            companyName,
            personName,
            mobileNumber,
            customerType,
            meetingPurpose,
            categoryId,
            status,
            // latitude_in,
            // longitude_in,
            // meetingTimeIn,
        };
        for (const key in requiredFields) {
            if (!requiredFields[key]) {
                (0, errorMessage_1.badRequest)(res, `${key} is required`);
                return;
            }
        }
        /** ✅ userId priority: req.body → token */
        if (!finalUserId) {
            (0, errorMessage_1.badRequest)(res, "userId is required");
            return;
        }
        /** ✅ Prepare payload */
        const payload = {
            companyName,
            personName,
            mobileNumber,
            customerType,
            meetingPurpose,
            categoryId,
            status,
            userId: finalUserId,
        };
        if (meetingTimeIn) {
            payload.meetingTimeIn = meetingTimeIn;
        }
        if (latitude_in) {
            payload.latitude_in = latitude_in;
        }
        if (longitude_in) {
            payload.longitude_in = longitude_in;
        }
        if (scheduledTime) {
            payload.scheduledTime = scheduledTime;
        }
        /** ✅ Save data */
        const item = yield Middleware.CreateData(dbConnection_1.Meeting, payload);
        (0, errorMessage_1.createSuccess)(res, "Meeting successfully added", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.CreateMeeting = CreateMeeting;
const EndMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { meetingId, latitude_out, longitude_out, remarks } = req.body || {};
        if (!meetingId) {
            (0, errorMessage_1.badRequest)(res, "meetingId is required");
            return;
        }
        /** ✅ Check meeting exist for this user & active */
        const isExist = yield dbConnection_1.Meeting.findOne({
            where: {
                id: meetingId,
                userId: finalUserId,
                status: "in",
            },
        });
        if (!isExist) {
            (0, errorMessage_1.badRequest)(res, "No active meeting found with this meetingId");
            return;
        }
        /** ✅ Update meeting */
        isExist.status = "completed";
        isExist.latitude_out = latitude_out !== null && latitude_out !== void 0 ? latitude_out : null;
        isExist.longitude_out = longitude_out !== null && longitude_out !== void 0 ? longitude_out : null;
        isExist.meetingTimeOut = new Date();
        if (remarks)
            isExist.remarks = remarks;
        yield isExist.save();
        (0, errorMessage_1.createSuccess)(res, "Meeting ended successfully", isExist);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.EndMeeting = EndMeeting;
const GetMeetingList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, search = "", status } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!finalUserId) {
            (0, errorMessage_1.badRequest)(res, "UserId not found");
            return;
        }
        /** ✅ Search condition */
        const where = {
            userId: finalUserId,
        };
        if (search) {
            where[sequelize_1.Op.or] = [
                { companyName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { personName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { mobileNumber: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { remarks: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        if (status) {
            where.status = status;
        }
        /** ✅ Query with pagination + count */
        const { rows, count } = yield dbConnection_1.Meeting.findAndCountAll({
            where,
            limit: limitNum,
            offset,
            order: [["createdAt", "DESC"]],
        });
        /** ✅ Pagination Info */
        const pageInfo = {
            currentPage: pageNum,
            pageSize: limitNum,
            totalItems: count,
            totalPages: Math.ceil(count / limitNum),
        };
        (0, errorMessage_1.createSuccess)(res, "Meeting list fetched", { pageInfo, data: rows });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.GetMeetingList = GetMeetingList;
const scheduled = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { meetingId, latitude_in, longitude_in } = req.body || {};
        if (!meetingId) {
            (0, errorMessage_1.badRequest)(res, "meetingId is required");
            return;
        }
        /** ✅ Check meeting exist for this user & active */
        const isExist = yield dbConnection_1.Meeting.findOne({
            where: {
                id: meetingId,
                userId: finalUserId,
                status: "scheduled",
            },
        });
        if (!isExist) {
            (0, errorMessage_1.badRequest)(res, "No scheduled meeting found with this meetingId");
            return;
        }
        /** ✅ Update meeting */
        isExist.status = "in";
        isExist.latitude_in = latitude_in !== null && latitude_in !== void 0 ? latitude_in : null;
        isExist.longitude_in = longitude_in !== null && longitude_in !== void 0 ? longitude_in : null;
        isExist.meetingTimeIn = new Date();
        yield isExist.save();
        (0, errorMessage_1.createSuccess)(res, "Meeting successfully start", isExist);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.scheduled = scheduled;
const Logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { deviceId } = req.body;
        if (!deviceId) {
            (0, errorMessage_1.badRequest)(res, "device token is missing");
        }
        yield dbConnection_1.Device.destroy({ where: { deviceId } });
        (0, errorMessage_1.createSuccess)(res, "logout sussfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.Logout = Logout;
const getCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.query;
        const item = yield Middleware.getAllList(dbConnection_1.Category, data);
        (0, errorMessage_1.createSuccess)(res, "get all category", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.getCategory = getCategory;
const addProdut = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // ✅ Get user ID from JWT
        const userData = req.userData;
        const user_id = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { project_name, status, project_details, project_features, price_range_from, price_range_to, price_per_sqft, units_size_sqft, total_units, location, city, state, country, possession_date, builder_name, project_images, is_active, } = req.body || {};
        const allowedFields = [
            "project_name",
            "status",
            "project_details",
            "project_features",
            "price_range_from",
            "price_range_to",
            "price_per_sqft",
            "units_size_sqft",
            "total_units",
            "location",
            "city",
            "state",
            "country",
            "possession_date",
            "builder_name",
            "project_images",
            "is_active",
        ];
        // ✅ Build object with non-empty values
        const object = { user_id }; // include user_id
        for (const key of allowedFields) {
            const value = req.body[key];
            if (value !== undefined && value !== null && value !== "") {
                object[key] = value;
            }
        }
        // ✅ Auto-calculate price_per_sqft if missing
        if (price_range_from &&
            price_range_to &&
            !price_per_sqft &&
            units_size_sqft) {
            const avgPrice = (Number(price_range_from) + Number(price_range_to)) / 2;
            object.price_per_sqft = avgPrice / Number(units_size_sqft);
        }
        // ✅ Save to DB
        const item = yield dbConnection_1.Project.create(object);
        (0, errorMessage_1.createSuccess)(res, "Project added successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addProdut = addProdut;
const AddPropertys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const builder_id = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { name, listing_type, property_for, owner_ship, project_id, category_id, property_type, amenities_id, title, unique_selling_point, state, city, country, locality, address, facing, bedroom, bathroom, balconies, floor_no, total_floor, furnished_status, price, price_negotiable, price_include, other_charge, maintenance_charge, maintenance_mode, corner_plot, length, breadth, is_active, possession_status, image, } = req.body || {};
        const allowedFields = [
            "name",
            "listing_type",
            "property_for",
            "owner_ship",
            "project_id",
            "category_id",
            "property_type",
            "amenities_id",
            "title",
            "price",
            "unique_selling_point",
            "state",
            "city",
            "country",
            "locality",
            "address",
            "facing",
            "bedroom",
            "bathroom",
            "balconies",
            "floor_no",
            "total_floor",
            "furnished_status",
            "price_negotiable",
            "price_include",
            "other_charge",
            "maintenance_charge",
            "maintenance_mode",
            "corner_plot",
            "length",
            "breadth",
            "is_active",
            "possession_status",
            "image",
        ];
        const object = { builder_id };
        // ✅ Add only non-empty fields
        for (const key of allowedFields) {
            if (req.body[key] !== undefined &&
                req.body[key] !== null &&
                req.body[key] !== "") {
                object[key] = req.body[key];
            }
        }
        // ✅ Auto calculations
        if (length && breadth) {
            object.area = Number(length) * Number(breadth);
        }
        if (price) {
            // If area exists, calculate price per sqft
            if (object.area) {
                object.price_per_sqft = Number(price) / Number(object.area);
            }
            // 25% of price as booking amount
            object.booking_amount = Number(price) * 0.25;
        }
        console.log("✅ Final Property Object:", object);
        const item = yield dbConnection_1.Property.create(object);
        (0, errorMessage_1.createSuccess)(res, "Property added successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.AddPropertys = AddPropertys;
const getProjectList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const data = req.query;
        const item = yield Middleware.getCategory(dbConnection_1.Project, data, userData === null || userData === void 0 ? void 0 : userData.userId);
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Amenities not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Amenities list", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getProjectList = getProjectList;
const getProjectDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        const userData = req.userData;
        // ✅ Validate input
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Project ID is required");
            return;
        }
        // ✅ Fetch project by ID and user ID (if provided)
        const item = yield Middleware.getById(dbConnection_1.Project, Number(id), Number(userData === null || userData === void 0 ? void 0 : userData.userId));
        // ✅ Handle not found
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Project not found");
            return;
        }
        // ✅ Success response
        (0, errorMessage_1.createSuccess)(res, "Project details fetched successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getProjectDetails = getProjectDetails;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // project ID
        const userData = req.userData;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Project ID is required");
            return;
        }
        // ✅ Extract allowed fields
        const allowedFields = [
            "project_name",
            "status",
            "project_details",
            "project_features",
            "price_range_from",
            "price_range_to",
            "price_per_sqft",
            "units_size_sqft",
            "total_units",
            "location",
            "city",
            "state",
            "country",
            "possession_date",
            "builder_name",
            "project_images",
            "is_active",
        ];
        // ✅ Build update object with only provided values
        const updates = {};
        for (const key of allowedFields) {
            const value = req.body[key];
            if (value !== undefined && value !== null && value !== "") {
                updates[key] = value;
            }
        }
        if (Object.keys(updates).length === 0) {
            (0, errorMessage_1.badRequest)(res, "No valid fields provided for update");
            return;
        }
        // ✅ Auto-calculate price_per_sqft if needed
        const { price_range_from, price_range_to, price_per_sqft, units_size_sqft, } = req.body;
        if (price_range_from &&
            price_range_to &&
            !price_per_sqft &&
            units_size_sqft) {
            const avgPrice = (Number(price_range_from) + Number(price_range_to)) / 2;
            updates.price_per_sqft = avgPrice / Number(units_size_sqft);
        }
        // ✅ Find project owned by current user (if applicable)
        const project = yield Middleware.getById(dbConnection_1.Project, Number(id), Number(userData === null || userData === void 0 ? void 0 : userData.userId));
        if (!project) {
            (0, errorMessage_1.badRequest)(res, "Project not found or not authorized");
            return;
        }
        // ✅ Perform update
        yield project.update(updates);
        (0, errorMessage_1.createSuccess)(res, "Project updated successfully", project);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // project ID
        const userData = req.userData;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Project ID is required");
            return;
        }
        const item = yield Middleware.DeleteItembyId(dbConnection_1.Project, Number(id), Number(userData === null || userData === void 0 ? void 0 : userData.userId));
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "product not founded");
        }
        (0, errorMessage_1.createSuccess)(res, "product delete successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.deleteProduct = deleteProduct;
