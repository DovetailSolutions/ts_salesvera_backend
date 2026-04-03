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
exports.Holiday = exports.Department = exports.Shift = exports.Branch = exports.Company = exports.Quotations = exports.MeetingUser = exports.MeetingCompany = exports.MeetingImage = exports.Message = exports.ChatParticipant = exports.ChatRoom = exports.ExpenseImage = exports.Expense = exports.Leave = exports.Attendance = exports.Device = exports.Meeting = exports.SubCategory = exports.Category = exports.User = exports.sequelize = exports.connectDB = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sequelize_1 = require("sequelize");
const env = process.env;
// ===== MODELS =====
const user_1 = require("../app/model/user");
const category_1 = require("../app/model/category");
const subCategory_1 = require("../app/model/subCategory");
const meeting_1 = require("../app/model/meeting");
const meetingImage_1 = require("../app/model/meetingImage");
const meetingCompany_1 = require("../app/model/meetingCompany");
const meetingUser_1 = require("../app/model/meetingUser");
const device_1 = require("../app/model/device");
const attendance_1 = require("../app/model/attendance");
Object.defineProperty(exports, "Attendance", { enumerable: true, get: function () { return attendance_1.Attendance; } });
const leaverequests_1 = require("../app/model/leaverequests");
Object.defineProperty(exports, "Leave", { enumerable: true, get: function () { return leaverequests_1.Leave; } });
const expense_1 = require("../app/model/expense");
Object.defineProperty(exports, "Expense", { enumerable: true, get: function () { return expense_1.Expense; } });
const expanseImages_1 = require("../app/model/expanseImages");
Object.defineProperty(exports, "ExpenseImage", { enumerable: true, get: function () { return expanseImages_1.ExpenseImage; } });
const chatRoom_1 = require("../app/model/chatRoom");
Object.defineProperty(exports, "ChatRoom", { enumerable: true, get: function () { return chatRoom_1.ChatRoom; } });
const ChatParticipant_1 = require("../app/model/ChatParticipant");
Object.defineProperty(exports, "ChatParticipant", { enumerable: true, get: function () { return ChatParticipant_1.ChatParticipant; } });
const Message_1 = require("../app/model/Message");
Object.defineProperty(exports, "Message", { enumerable: true, get: function () { return Message_1.Message; } });
const quotations_1 = require("../app/model/quotations");
Object.defineProperty(exports, "Quotations", { enumerable: true, get: function () { return quotations_1.Quotations; } });
const company_1 = require("../app/model/company");
const branch_1 = require("../app/model/branch");
const Shift_1 = require("../app/model/Shift");
const department_1 = require("../app/model/department");
const holiday_1 = require("../app/model/holiday");
// ===== SEQUELIZE INIT =====
const sequelize = new sequelize_1.Sequelize(env.DB_NAME || "default_db", env.DB_USER_NAME || "default_user", env.DB_PASSWORD || "default_password", {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: true,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false,
        },
    },
});
exports.sequelize = sequelize;
// ===== INIT MODELS =====
// Core
const User = (0, user_1.createUserModel)(sequelize);
exports.User = User;
const Category = (0, category_1.CategoryModel)(sequelize);
exports.Category = Category;
const SubCategory = (0, subCategory_1.SubCategoryModel)(sequelize);
exports.SubCategory = SubCategory;
// Meeting
const Meeting = (0, meeting_1.MeetingModel)(sequelize);
exports.Meeting = Meeting;
const MeetingImage = (0, meetingImage_1.MeetingImageModel)(sequelize);
exports.MeetingImage = MeetingImage;
const MeetingCompany = (0, meetingCompany_1.CompanyModel)(sequelize);
exports.MeetingCompany = MeetingCompany;
const MeetingUser = (0, meetingUser_1.UserModel)(sequelize);
exports.MeetingUser = MeetingUser;
// Device
const Device = (0, device_1.DeviceModel)(sequelize);
exports.Device = Device;
// HR
attendance_1.Attendance.initModel(sequelize);
leaverequests_1.Leave.initModel(sequelize);
// Expense
expense_1.Expense.initModel(sequelize);
expanseImages_1.ExpenseImage.initModel(sequelize);
// Chat
chatRoom_1.ChatRoom.initModel(sequelize);
ChatParticipant_1.ChatParticipant.initModel(sequelize);
Message_1.Message.initModel(sequelize);
// Sales
quotations_1.Quotations.initModel(sequelize);
// Company Structure
const Company = (0, company_1.CompanyModell)(sequelize);
exports.Company = Company;
const Branch = (0, branch_1.BranchModel)(sequelize);
exports.Branch = Branch;
const Shift = (0, Shift_1.ShiftModel)(sequelize);
exports.Shift = Shift;
const Department = (0, department_1.DepartmentModel)(sequelize);
exports.Department = Department;
const Holiday = (0, holiday_1.HolidayModel)(sequelize);
exports.Holiday = Holiday;
// ===== ASSOCIATIONS =====
// User self relation
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
// Attendance / Leave
User.hasMany(attendance_1.Attendance, { foreignKey: "employee_id" });
attendance_1.Attendance.belongsTo(User, { foreignKey: "employee_id", as: "user" });
User.hasMany(leaverequests_1.Leave, { foreignKey: "employee_id" });
leaverequests_1.Leave.belongsTo(User, { foreignKey: "employee_id", as: "user" });
// Expense
User.hasMany(expense_1.Expense, { foreignKey: "userId" });
expense_1.Expense.belongsTo(User, { foreignKey: "userId", as: "user" });
expense_1.Expense.hasMany(expanseImages_1.ExpenseImage, { foreignKey: "expenseId", as: "images" });
expanseImages_1.ExpenseImage.belongsTo(expense_1.Expense, { foreignKey: "expenseId" });
// Chat
chatRoom_1.ChatRoom.hasMany(ChatParticipant_1.ChatParticipant, {
    foreignKey: "chatRoomId",
    as: "participants",
});
ChatParticipant_1.ChatParticipant.belongsTo(chatRoom_1.ChatRoom, { foreignKey: "chatRoomId" });
chatRoom_1.ChatRoom.hasMany(Message_1.Message, {
    foreignKey: "chatRoomId",
    as: "messages",
});
Message_1.Message.belongsTo(chatRoom_1.ChatRoom, { foreignKey: "chatRoomId" });
User.hasMany(Message_1.Message, { foreignKey: "senderId" });
Message_1.Message.belongsTo(User, { foreignKey: "senderId" });
User.hasMany(ChatParticipant_1.ChatParticipant, {
    foreignKey: "userId",
    as: "chatParticipants",
});
ChatParticipant_1.ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });
// Meeting
MeetingUser.hasMany(Meeting, { foreignKey: "meetingUserId" });
Meeting.belongsTo(MeetingUser, { foreignKey: "meetingUserId" });
MeetingUser.hasMany(MeetingCompany, { foreignKey: "meetingUserId" });
MeetingCompany.belongsTo(MeetingUser, { foreignKey: "meetingUserId" });
MeetingUser.hasMany(MeetingImage, { foreignKey: "meetingUserId" });
MeetingImage.belongsTo(MeetingUser, { foreignKey: "meetingUserId" });
MeetingCompany.hasMany(Meeting, { foreignKey: "companyId" });
Meeting.belongsTo(MeetingCompany, { foreignKey: "companyId" });
Meeting.hasMany(MeetingImage, { foreignKey: "meetingId" });
MeetingImage.belongsTo(Meeting, { foreignKey: "meetingId" });
User.hasMany(Meeting, { foreignKey: "userId" });
Meeting.belongsTo(User, { foreignKey: "userId" });
// Category
Category.hasMany(SubCategory, {
    foreignKey: "CategoryId",
    as: "subCategories",
});
SubCategory.belongsTo(Category, {
    foreignKey: "CategoryId",
    as: "category",
});
// Quotations
User.hasMany(quotations_1.Quotations, { foreignKey: "userId" });
quotations_1.Quotations.belongsTo(User, { foreignKey: "userId" });
// ===== DB CONNECTION =====
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
