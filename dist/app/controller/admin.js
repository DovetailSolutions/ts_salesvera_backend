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
exports.addProdut = exports.AddPropertys = exports.amenitiesdelete = exports.updateamenities = exports.amenitiesdetails = exports.amenitiesList = exports.addamenities = exports.flatDelete = exports.UpdateFlat = exports.FlatDetails = exports.getFlatList = exports.addFlat = exports.UpdateProperty = exports.deleteProperty = exports.PropertyDetails = exports.getPropertylist = exports.AddProperty = exports.DeleteCategory = exports.UpdateCategory = exports.categoryDetails = exports.getcategory = exports.AddCategory = exports.UpdatePassword = exports.GetProfile = exports.Login = exports.Register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
// import csv from "csv-parser";
// import fs from "fs";
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_1 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const UNIQUE_ROLES = ["admin", "super_admin"];
const Register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, firstName, lastName, phone, dob, role, createdBy } = req.body;
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
            // item,
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
        yield user.update({ refreshToken });
        // ✅ Respond
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
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
    }
});
exports.UpdatePassword = UpdatePassword;
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
        // ✅ Update category
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
const AddProperty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category_id, name } = req.body || {};
        if (!category_id || !name) {
            (0, errorMessage_1.badRequest)(res, "property / category missing ");
        }
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.PropertyType, "name", name);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "property type already exists");
            return;
        }
        const item = yield dbConnection_1.PropertyType.create({ name });
        yield item.addCategories(category_id);
        (0, errorMessage_1.createSuccess)(res, "property add successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.AddProperty = AddProperty;
const getPropertylist = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.query;
        const item = yield Middleware.getCategory(dbConnection_1.PropertyType, data);
        (0, errorMessage_1.createSuccess)(res, "Property list", item);
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Property not found");
            return;
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getPropertylist = getPropertylist;
const PropertyDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "property id is required");
            return;
        }
        const item = yield Middleware.getById(dbConnection_1.PropertyType, Number(id));
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Property not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "property details", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.PropertyDetails = PropertyDetails;
const deleteProperty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "property id is required");
            return;
        }
        const item = yield Middleware.getById(dbConnection_1.PropertyType, Number(id));
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Property not found");
            return;
        }
        yield item.setCategories([]);
        if (item !== null) {
            yield item.destroy();
        }
        (0, errorMessage_1.createSuccess)(res, "property delete successfully ");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.deleteProperty = deleteProperty;
const UpdateProperty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, category_id } = req.body;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Property ID is required");
            return;
        }
        // ✅ Prepare update object
        const updateData = {};
        if (name)
            updateData.name = name;
        if (category_id)
            updateData.category_id = category_id;
        // ✅ Check if property name already exists (avoid duplicates)
        if (name) {
            const isExist = yield Middleware.FindByField(dbConnection_1.PropertyType, "name", name);
            if (isExist && isExist.id !== Number(id)) {
                (0, errorMessage_1.badRequest)(res, "Property type already exists");
                return;
            }
        }
        // ✅ Update property
        const item = yield Middleware.UpdateData(dbConnection_1.PropertyType, Number(id), updateData);
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Property not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Property updated successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.UpdateProperty = UpdateProperty;
const addFlat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type } = req.body || {};
        if (!type) {
            (0, errorMessage_1.badRequest)(res, "flat type is missing ");
            return;
        }
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Flat, "type", type);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Flat type already exists");
            return;
        }
        const item = yield dbConnection_1.Flat.create({ type });
        (0, errorMessage_1.createSuccess)(res, "flat type add successfully ");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addFlat = addFlat;
const getFlatList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.query;
        const item = yield Middleware.getCategory(dbConnection_1.Flat, data);
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "flat not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "flat list", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getFlatList = getFlatList;
const FlatDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "flat id missing");
        }
        const item = yield Middleware.getById(dbConnection_1.Flat, Number(id));
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "falt not found");
        }
        (0, errorMessage_1.createSuccess)(res, "falt details", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.FlatDetails = FlatDetails;
const UpdateFlat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        const { type } = req.body;
        console.log(">>>>>>>>>>>>>>>>type", type);
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Flat, "type", type);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Flat type already exists");
            return;
        }
        const item = yield Middleware.Update(dbConnection_1.Flat, Number(id), { type });
        console.log(">>>>>>>>>>>>>>>>>>item", item);
        (0, errorMessage_1.createSuccess)(res, "flat data update successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.UpdateFlat = UpdateFlat;
const flatDelete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "flat is missing");
        }
        const item = yield Middleware.DeleteItembyId(dbConnection_1.Flat, Number(id));
        (0, errorMessage_1.createSuccess)(res, "flat delete successfully ");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.flatDelete = flatDelete;
const addamenities = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type } = req.body || {};
        if (!type) {
            (0, errorMessage_1.badRequest)(res, "Amenities type is missing ");
            return;
        }
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Amenities, "type", type);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Amenities type already exists");
            return;
        }
        const item = yield dbConnection_1.Amenities.create({ type });
        (0, errorMessage_1.createSuccess)(res, "Amenities type add successfully ");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.addamenities = addamenities;
const amenitiesList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.query;
        const item = yield Middleware.getCategory(dbConnection_1.Amenities, data);
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
exports.amenitiesList = amenitiesList;
const amenitiesdetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Amenities id missing");
        }
        const item = yield Middleware.getById(dbConnection_1.Amenities, Number(id));
        if (!item) {
            (0, errorMessage_1.badRequest)(res, "Amenities not found");
        }
        (0, errorMessage_1.createSuccess)(res, "Amenities details", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.amenitiesdetails = amenitiesdetails;
const updateamenities = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params || {};
        const { type } = req.body;
        console.log(">>>>>>>>>>>>>>>>type", type);
        const isCategoryExist = yield Middleware.FindByField(dbConnection_1.Amenities, "type", type);
        if (isCategoryExist) {
            (0, errorMessage_1.badRequest)(res, "Amenities type already exists");
            return;
        }
        const item = yield Middleware.Update(dbConnection_1.Amenities, Number(id), { type });
        console.log(">>>>>>>>>>>>>>>>>>item", item);
        (0, errorMessage_1.createSuccess)(res, "Amenities data update successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateamenities = updateamenities;
const amenitiesdelete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Amenities is missing");
        }
        const item = yield Middleware.DeleteItembyId(dbConnection_1.Amenities, Number(id));
        (0, errorMessage_1.createSuccess)(res, "Amenities delete successfully ");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.amenitiesdelete = amenitiesdelete;
const AddPropertys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, listing_type, property_for, owner_ship, builder_id, project_id, category_id, property_type, amenities_id, title, unique_selling_point, state, city, country, locality, address, facing, bedroom, bathroom, balconies, floor_no, total_floor, furnished_status, price, price_negotiable, price_include, other_charge, maintenance_charge, maintenance_mode, corner_plot, length, breadth, is_active, possession_status, image, } = req.body || {};
        const allowedFields = [
            "name",
            "listing_type",
            "property_for",
            "owner_ship",
            "builder_id",
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
        const object = {};
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
        // ✅ Save to DB
        const item = yield dbConnection_1.Property.create(object);
        (0, errorMessage_1.createSuccess)(res, "Property added successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.AddPropertys = AddPropertys;
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
// export const Pdf = async (req: Request, res: Response) => {
//   try {
//     const file = req.file;
//     if (!file || !file.buffer) {
//       badRequest(res, "PDF file is required");
//       return;
//     }
//     const pdfData = await pdfParse(file.buffer);
//     const lines = pdfData.text
//       .split("\n")
//       .map((l) => l.trim())
//       .filter((l) => l.length > 0);
//     const journalData: any = { periods: [] };
//     let currentPeriod: any = null;
//     let currentEntry: any = null;
//     // Extract company info
//     journalData.companyInfo = {
//       companyName: lines[0] || "",
//       address: lines[1] || "",
//       journalType: lines[2] || "",
//       financialYear: "2025-2026",
//     };
//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i];
//       // Skip header lines
//       if (
//         line.includes("S.No.") ||
//         line.includes("Dr. Amount") ||
//         line.includes("Cr. Amount") ||
//         line.includes("Particulars")
//       )
//         continue;
//       // Period start line
//       const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+B\/F\s+([\d,.]+)\s+([\d,.]+)/);
//       if (dateMatch) {
//         if (currentPeriod && currentPeriod.entries.length > 0)
//           journalData.periods.push(currentPeriod);
//         currentPeriod = {
//           date: dateMatch[1],
//           entries: [],
//         };
//         continue;
//       }
//       // Debit entry (starts with serial no)
//       const serialMatch = line.match(/^(\d+)\s+(.+?)\s+([\d,.]+)$/);
//       if (serialMatch && currentPeriod) {
//         if (currentEntry) currentPeriod.entries.push(currentEntry);
//         currentEntry = {
//           serialNo: serialMatch[1],
//           transactions: [
//             {
//               particulars: serialMatch[2].trim(),
//               debit: parseFloat(serialMatch[3].replace(/,/g, "")),
//               credit: 0,
//             },
//           ],
//         };
//         continue;
//       }
//       // Credit or additional transactions
//       const creditMatch = line.match(/^(.+?)\s+([\d,.]+)$/);
//       if (creditMatch && currentEntry && !line.match(/Total|C\/F|B\/F/)) {
//         currentEntry.transactions.push({
//           particulars: creditMatch[1].trim(),
//           debit: 0,
//           credit: parseFloat(creditMatch[2].replace(/,/g, "")),
//         });
//         continue;
//       }
//       // Narration line
//       if (
//         currentEntry &&
//         currentEntry.transactions.length > 0 &&
//         !line.match(/^\d/) &&
//         !line.match(/^Total|C\/F|B\/F/)
//       ) {
//         const last = currentEntry.transactions[currentEntry.transactions.length - 1];
//         last.narration = last.narration ? `${last.narration} ${line}` : line;
//         continue;
//       }
//     }
//     if (currentEntry && currentPeriod) currentPeriod.entries.push(currentEntry);
//     if (currentPeriod && currentPeriod.entries.length > 0) journalData.periods.push(currentPeriod);
//     const transformedData = transformToDesiredFormat(journalData);
//     res.status(200).json({
//       success: true,
//       data: transformedData,
//     });
//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage, error);
//   }
// };
// function transformToDesiredFormat(journalData: any) {
//   const entries: any[] = [];
//   for (const period of journalData.periods) {
//     for (const entry of period.entries) {
//       const txs = entry.transactions;
//       if (txs.length >= 2) {
//         const jrnlEntry: any = {
//           ledname1: txs[0]?.particulars || "",
//           Dbtamt1: formatAmount(txs[0]?.debit),
//           Ledname2: txs[1]?.particulars || "",
//           Dbtamt2: formatAmount(txs[1]?.credit),
//           Ledname3: "",
//           Dbtamt3: "",
//           Narration: "",
//         };
//         // Handle ROUND OFF or third transaction
//         if (txs.length >= 3) {
//           jrnlEntry.Ledname3 = txs[2]?.particulars || "";
//           jrnlEntry.Dbtamt3 = formatAmount(txs[2]?.credit || txs[2]?.debit);
//         }
//         // Pick first narration found
//         for (const tx of txs) {
//           if (tx.narration) {
//             jrnlEntry.Narration = tx.narration.trim();
//             break;
//           }
//         }
//         entries.push({ Jrnlentry: jrnlEntry });
//       }
//     }
//   }
//   return entries;
// }
// function formatAmount(val: number): string {
//   return val ? val.toFixed(2) : "";
// }
// // Type definitions
// interface JournalPeriod {
//   date: string;
//   broughtForward: { debit: number; credit: number };
//   entries: JournalEntry[];
//   carryForward: { debit: number; credit: number };
//   total: { debit: number; credit: number };
// }
// interface JournalEntry {
//   serialNo: string;
//   transactions: Transaction[];
// }
// interface Transaction {
//   particulars: string;
//   debit: number;
//   credit: number;
//   narration?: string;
// }
