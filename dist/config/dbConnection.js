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
exports.Device = exports.Meeting = exports.Project = exports.Property = exports.Amenities = exports.Flat = exports.PropertyType = exports.Category = exports.User = exports.sequelize = exports.connectDB = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sequelize_1 = require("sequelize");
const env = process.env;
const user_1 = require("../app/model/user");
const category_1 = require("../app/model/category");
const propertytpe_1 = require("../app/model/propertytpe");
const flattype_1 = require("../app/model/flattype");
const amenities_1 = require("../app/model/amenities");
const property_1 = require("../app/model/property");
const project_1 = require("../app/model/project");
const meeting_1 = require("../app/model/meeting");
const device_1 = require("../app/model/device");
const sequelize = new sequelize_1.Sequelize(env.DB_NAME || "default_db", env.DB_USER_NAME || "default_user", env.DB_PASSWORD || "default_password", {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
});
exports.sequelize = sequelize;
const User = (0, user_1.createUserModel)(sequelize);
exports.User = User;
const Category = (0, category_1.CategoryModel)(sequelize);
exports.Category = Category;
const PropertyType = (0, propertytpe_1.PropertyTypeModel)(sequelize);
exports.PropertyType = PropertyType;
const Flat = (0, flattype_1.FlatTypeModel)(sequelize);
exports.Flat = Flat;
const Amenities = (0, amenities_1.AmenitiesModel)(sequelize);
exports.Amenities = Amenities;
const Property = (0, property_1.PropertyModel)(sequelize);
exports.Property = Property;
const Project = (0, project_1.ProjectModel)(sequelize);
exports.Project = Project;
const Meeting = (0, meeting_1.MeetingTypeModel)(sequelize);
exports.Meeting = Meeting;
const Device = (0, device_1.DeviceModel)(sequelize);
exports.Device = Device;
User.belongsToMany(User, {
    through: "UserCreators",
    as: "creators",
    foreignKey: "user_id",
    otherKey: "created_by_user_id",
});
User.belongsToMany(User, {
    through: "UserCreators",
    as: "createdUsers",
    foreignKey: "created_by_user_id",
    otherKey: "user_id",
});
//join
PropertyType.belongsToMany(Category, {
    through: "PropertyCategories",
    foreignKey: "property_id",
    otherKey: "category_id",
    as: "categories",
});
Category.belongsToMany(PropertyType, {
    through: "PropertyCategories",
    foreignKey: "category_id",
    otherKey: "property_id",
    as: "propertyTypes",
});
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("✅ Database connection established successfully");
        yield sequelize.sync({ alter: true });
        yield sequelize.authenticate();
    }
    catch (err) {
        console.error("❌ DB error:", err);
    }
});
exports.connectDB = connectDB;
