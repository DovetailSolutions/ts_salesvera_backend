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
exports.TaskHistory = exports.Task = exports.Report = exports.Notification = exports.UserPermission = exports.Permission = exports.RecordSales = exports.Invoices = exports.CompanyBank = exports.CompanyLeave = exports.Holiday = exports.Department = exports.Shift = exports.Branch = exports.Company = exports.Quotations = exports.MeetingUser = exports.MeetingCompany = exports.MeetingImage = exports.Message = exports.ChatParticipant = exports.ChatRoom = exports.ExpenseImage = exports.Expense = exports.Leave = exports.Attendance = exports.Device = exports.Meeting = exports.SubCategory = exports.Category = exports.User = exports.sequelize = exports.connectDB = void 0;
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
const Leave_1 = require("../app/model/Leave");
Object.defineProperty(exports, "CompanyLeave", { enumerable: true, get: function () { return Leave_1.CompanyLeave; } });
const bank_1 = require("../app/model/bank");
const Invoice_1 = require("../app/model/Invoice");
Object.defineProperty(exports, "Invoices", { enumerable: true, get: function () { return Invoice_1.Invoices; } });
const saleRecord_1 = require("../app/model/saleRecord");
Object.defineProperty(exports, "RecordSales", { enumerable: true, get: function () { return saleRecord_1.RecordSales; } });
const Notification_1 = require("../app/model/Notification");
Object.defineProperty(exports, "Notification", { enumerable: true, get: function () { return Notification_1.Notification; } });
const report_1 = require("../app/model/report");
// RBAC Models
const permission_1 = require("../app/model/permission");
const userPermission_1 = require("../app/model/userPermission");
const task_1 = require("../app/model/task");
Object.defineProperty(exports, "Task", { enumerable: true, get: function () { return task_1.Task; } });
const taskHistory_1 = require("../app/model/taskHistory");
Object.defineProperty(exports, "TaskHistory", { enumerable: true, get: function () { return taskHistory_1.TaskHistory; } });
// ===== SEQUELIZE INIT =====
const sequelize = new sequelize_1.Sequelize(env.DB_NAME || "default_db", env.DB_USER_NAME || "default_user", env.DB_PASSWORD || "default_password", Object.assign({ host: env.DB_HOST, port: Number(env.DB_PORT) || 5432, dialect: "postgres", logging: false }, (env.DB_HOST !== "127.0.0.1" && env.DB_HOST !== "localhost"
    ? {
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
    }
    : {})));
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
const MeetingCompany = (0, meetingCompany_1.MeetingCompanyModel)(sequelize);
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
const Department = (0, department_1.DepartmentModel)(sequelize);
exports.Department = Department;
const Holiday = (0, holiday_1.HolidayModel)(sequelize);
exports.Holiday = Holiday;
const Shift = (0, Shift_1.ShiftModel)(sequelize);
exports.Shift = Shift;
Leave_1.CompanyLeave.initModel(sequelize);
const CompanyBank = (0, bank_1.CompanyBankModel)(sequelize);
exports.CompanyBank = CompanyBank;
Invoice_1.Invoices.initModel(sequelize);
saleRecord_1.RecordSales.initModel(sequelize);
Notification_1.Notification.initModel(sequelize);
// RBAC
const Permission = (0, permission_1.PermissionModel)(sequelize);
exports.Permission = Permission;
const UserPermission = (0, userPermission_1.UserPermissionModel)(sequelize);
exports.UserPermission = UserPermission;
const Report = (0, report_1.RepostModel)(sequelize);
exports.Report = Report;
// Task Management
task_1.Task.initModel(sequelize);
taskHistory_1.TaskHistory.initModel(sequelize);
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
// Self-referential: reply-to chain (WhatsApp-style quoted messages)
Message_1.Message.belongsTo(Message_1.Message, { foreignKey: "replyTo", as: "repliedMessage" });
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
// User / Company
User.hasOne(Company, { foreignKey: "adminId", as: "company" });
Company.belongsTo(User, { foreignKey: "adminId", as: "admin" });
User.hasOne(Company, { foreignKey: "managerId", as: "managedCompany" });
Company.belongsTo(User, { foreignKey: "managerId", as: "manager" });
Company.hasMany(Branch, { foreignKey: "companyId", as: "branches" });
Branch.belongsTo(Company, { foreignKey: "companyId", as: "company" });
Company.hasMany(Department, { foreignKey: "companyId", as: "departments" });
Department.belongsTo(Company, { foreignKey: "companyId", as: "company" });
Company.hasMany(Holiday, { foreignKey: "companyId", as: "holidays" });
Holiday.belongsTo(Company, { foreignKey: "companyId", as: "company" });
Company.hasMany(Shift, { foreignKey: "companyId", as: "shifts" });
Shift.belongsTo(Company, { foreignKey: "companyId", as: "company" });
Company.hasMany(Leave_1.CompanyLeave, { foreignKey: "companyId", as: "companyLeaves" });
Leave_1.CompanyLeave.belongsTo(Company, { foreignKey: "companyId", as: "company" });
Company.hasMany(CompanyBank, { foreignKey: "companyId", as: "companyBanks" });
CompanyBank.belongsTo(Company, { foreignKey: "companyId", as: "company" });
// RBAC Associations
// Permission ↔ UserPermission
Permission.hasMany(UserPermission, { foreignKey: "permissionId", as: "userPermissions" });
UserPermission.belongsTo(Permission, { foreignKey: "permissionId", as: "permission" });
// User ↔ UserPermission (receiver)
User.hasMany(UserPermission, { foreignKey: "userId", as: "assignedPermissions" });
UserPermission.belongsTo(User, { foreignKey: "userId", as: "permissionHolder" });
// User ↔ UserPermission (granter)
User.hasMany(UserPermission, { foreignKey: "grantedBy", as: "grantedPermissions" });
UserPermission.belongsTo(User, { foreignKey: "grantedBy", as: "permissionGranter" });
// Company ↔ UserPermission
Company.hasMany(UserPermission, { foreignKey: "companyId", as: "companyUserPermissions" });
UserPermission.belongsTo(Company, { foreignKey: "companyId", as: "company" });
// Notification associations
// constraints: false prevents Sequelize alter:true from generating invalid
// "ALTER COLUMN SET DEFAULT NULL REFERENCES ..." SQL on PostgreSQL.
// FK constraints are added manually in fixConstraints() instead.
User.hasMany(Notification_1.Notification, { foreignKey: "receiverId", as: "receivedNotifications", constraints: false });
Notification_1.Notification.belongsTo(User, { foreignKey: "receiverId", as: "receiver", constraints: false });
User.hasMany(Notification_1.Notification, { foreignKey: "senderId", as: "sentNotifications", constraints: false });
Notification_1.Notification.belongsTo(User, { foreignKey: "senderId", as: "sender", constraints: false });
// Task associations
User.hasMany(task_1.Task, { foreignKey: "assignedTo", as: "assignedTasks", constraints: false });
task_1.Task.belongsTo(User, { foreignKey: "assignedTo", as: "assignee", constraints: false });
User.hasMany(task_1.Task, { foreignKey: "assignedBy", as: "createdTasks", constraints: false });
task_1.Task.belongsTo(User, { foreignKey: "assignedBy", as: "creator", constraints: false });
Company.hasMany(task_1.Task, { foreignKey: "companyId", as: "tasks", constraints: false });
task_1.Task.belongsTo(Company, { foreignKey: "companyId", as: "company", constraints: false });
// TaskHistory associations
task_1.Task.hasMany(taskHistory_1.TaskHistory, { foreignKey: "taskId", as: "history", constraints: false });
taskHistory_1.TaskHistory.belongsTo(task_1.Task, { foreignKey: "taskId", constraints: false });
User.hasMany(taskHistory_1.TaskHistory, { foreignKey: "changedBy", as: "taskChanges", constraints: false });
taskHistory_1.TaskHistory.belongsTo(User, { foreignKey: "changedBy", as: "changedByUser", constraints: false });
/**
 * 🛠️ MANUAL MIGRATION HELPER
 * This ensures the 'meeting_user_id' column exists in essential tables.
 * This is needed because standard sync({ alter: true }) sometimes fails on AWS
 * to add new columns to existing tables.
 */
const ensureColumns = (sequelize) => __awaiter(void 0, void 0, void 0, function* () {
    const tableConfigs = [
        {
            tableName: "meeting_companies",
            columns: [
                { name: "meeting_user_id", type: "INTEGER" },
                { name: "company_name", type: "VARCHAR(255)" },
                { name: "person_name", type: "VARCHAR(255)" },
                { name: "mobile_number", type: "VARCHAR(255)" },
                { name: "company_email", type: "VARCHAR(255)" },
                { name: "customer_type", type: "VARCHAR(255)" },
                { name: "gst_number", type: "VARCHAR(255)" },
                { name: "quotation_number", type: "VARCHAR(255)" },
                { name: "state", type: "VARCHAR(255)" },
                { name: "city", type: "VARCHAR(255)" },
                { name: "country", type: "VARCHAR(255)" },
                { name: "remarks", type: "TEXT" },
                { name: "address", type: "TEXT" },
            ],
        },
        {
            tableName: "meetings",
            columns: [
                { name: "user_id", type: "INTEGER" },
                { name: "company_id", type: "INTEGER" },
                { name: "meeting_user_id", type: "INTEGER" },
                { name: "category_id", type: "INTEGER" },
                { name: "meeting_purpose", type: "VARCHAR(255)" },
                { name: "scheduled_time", type: "TIMESTAMP" },
                { name: "meeting_time_in", type: "TIMESTAMP" },
                { name: "meeting_time_out", type: "TIMESTAMP" },
                { name: "total_distance", type: "VARCHAR(255)" },
                { name: "leg_distance", type: "VARCHAR(255)" },
                { name: "status", type: "VARCHAR(50)" },
                { name: "latitude_in", type: "VARCHAR(255)" },
                { name: "longitude_in", type: "VARCHAR(255)" },
                { name: "latitude_out", type: "VARCHAR(255)" },
                { name: "longitude_out", type: "VARCHAR(255)" },
            ],
        },
        {
            tableName: "meeting_images",
            columns: [{ name: "meeting_user_id", type: "INTEGER" }],
        },
        {
            tableName: "meeting_users",
            columns: [
                { name: "user_id", type: "INTEGER" },
                { name: "customer_type", type: "VARCHAR(255)" },
                { name: "address", type: "TEXT" },
            ],
        },
        {
            tableName: "shifts",
            columns: [
                { name: "shiftName", type: "VARCHAR(255)" },
                { name: "shiftCode", type: "VARCHAR(255)" },
                { name: "startTime", type: "TIME" },
                { name: "endTime", type: "TIME" },
                { name: "adminId", type: "INTEGER" },
                { name: "managerId", type: "INTEGER" },
                { name: "userId", type: "INTEGER" },
                { name: "companyId", type: "INTEGER" },
                { name: "branchId", type: "INTEGER" },
            ],
        },
        {
            // ✅ Companies table: ensure 'adminId' and 'managerId' columns exist
            // These were added to the model but the AWS DB doesn't have them yet
            // because Sequelize's alter:true sync failed to add them automatically.
            tableName: "companies",
            columns: [
                { name: "adminId", type: "INTEGER" },
                { name: "managerId", type: "INTEGER" },
                { name: "legalName", type: "VARCHAR(255)" },
                { name: "registrationNo", type: "VARCHAR(255)" },
                { name: "companyEmail", type: "VARCHAR(255)" },
                { name: "companyPhone", type: "VARCHAR(255)" },
            ],
        },
        {
            tableName: "users",
            columns: [
                { name: "otp", type: "VARCHAR(255)" },
                { name: "otpExpiry", type: "TIMESTAMP WITH TIME ZONE" },
                { name: "tenantId", type: "INTEGER" },
            ],
        },
        {
            tableName: "sub_categories",
            columns: [
                { name: "tally_guid", type: "VARCHAR(255)" },
            ],
        },
        {
            tableName: "meeting_users",
            columns: [
                { name: "tally_guid", type: "VARCHAR(255)" },
            ],
        },
        {
            tableName: "messages",
            columns: [
                { name: "mediaUrl", type: "TEXT" },
                { name: "mediaType", type: "VARCHAR(50)" },
                { name: "fileName", type: "VARCHAR(255)" },
                { name: "replyTo", type: "INTEGER" },
                { name: "status", type: "VARCHAR(10) DEFAULT 'unseen'" },
            ],
        },
    ];
    for (const config of tableConfigs) {
        // 1️⃣ Ensure Table Exists (Emergency fallback for missing tables)
        if (config.tableName === "shifts") {
            try {
                yield sequelize.query(`
          CREATE TABLE IF NOT EXISTS "shifts" (
            "id" SERIAL PRIMARY KEY,
            "shiftName" VARCHAR(255),
            "shiftCode" VARCHAR(255),
            "startTime" TIME,
            "endTime" TIME,
            "adminId" INTEGER,
            "managerId" INTEGER,
            "userId" INTEGER,
            "companyId" INTEGER,
            "branchId" INTEGER,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
            }
            catch (err) {
                console.error(`❌ Error creating table shifts:`, err);
            }
        }
        // 2️⃣ Ensure Columns Exist
        for (const column of config.columns) {
            try {
                yield sequelize.query(`
          ALTER TABLE "${config.tableName}" 
          ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type};
        `);
            }
            catch (err) {
                console.error(`❌ Error checking/adding ${column.name} to ${config.tableName}:`, err);
            }
        }
    }
    // 3️⃣ Remove Unique Constraints to allow duplicates (as requested)
    const constraintsToDrop = [
        { table: "shifts", constraint: "shifts_shiftCode_key" },
        { table: "branches", constraint: "branches_branchCode_key" },
        { table: "departments", constraint: "departments_deptCode_key" },
        { table: "holidays", constraint: "holidays_holidayDate_key" },
    ];
    for (const item of constraintsToDrop) {
        try {
            yield sequelize.query(`ALTER TABLE "${item.table}" DROP CONSTRAINT IF EXISTS "${item.constraint}";`);
        }
        catch (err) {
            // Ignore if doesn't exist
        }
    }
    // ✅ Ensure company_banks table exists (new table added to model)
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "company_banks" (
        "id" SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL,
        "branchId" INTEGER,
        "userId" INTEGER NOT NULL,
        "bankAccountHolder" VARCHAR(255) NOT NULL,
        "bankName" VARCHAR(255) NOT NULL,
        "bankAccountNumber" VARCHAR(255) NOT NULL,
        "bankIfsc" VARCHAR(255) NOT NULL,
        "bankBranchName" VARCHAR(255),
        "bankAccountType" VARCHAR(255),
        "bankMicr" VARCHAR(255),
        "upiId" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table company_banks:`, err);
    }
    // ✅ Ensure invoices table exists (auto sync sometimes fails)
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "companyId" INTEGER NOT NULL,
        "quotationId" INTEGER,
        "invoice" JSON,
        "status" VARCHAR(50) DEFAULT 'draft',
        "invoiceNumber" VARCHAR(255) NOT NULL,
        "customerName" VARCHAR(255),
        "quotationNumber" VARCHAR(255),
        "quotationDate" TIMESTAMP WITH TIME ZONE,
        "dueDate" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table invoices:`, err);
    }
    // ✅ Ensure notifications table exists
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" SERIAL PRIMARY KEY,
        "receiverId" INTEGER NOT NULL,
        "senderId" INTEGER,
        "type" VARCHAR(100) NOT NULL DEFAULT 'system',
        "title" VARCHAR(255) NOT NULL,
        "body" TEXT NOT NULL,
        "data" JSONB,
        "isRead" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table notifications:`, err);
    }
    // ✅ Ensure record_sales table exists
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "record_sales" (
        "id" SERIAL PRIMARY KEY,
        "customerName" VARCHAR(255) NOT NULL,
        "productDescription" TEXT NOT NULL,
        "saleAmount" FLOAT NOT NULL,
        "remarks" TEXT,
        "paymentReceived" BOOLEAN DEFAULT FALSE,
        "userId" INTEGER NOT NULL,
        "companyId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table record_sales:`, err);
    }
    // ✅ Ensure repost table exists
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "repost" (
        "id" SERIAL PRIMARY KEY,
        "date" VARCHAR(255) NOT NULL,
        "reference_no" VARCHAR(255) NOT NULL,
        "customer_name" VARCHAR(255) NOT NULL,
        "opening_amount" DECIMAL(10, 2) NOT NULL,
        "pending_amount" DECIMAL(10, 2) NOT NULL,
        "due_on" TIMESTAMP WITH TIME ZONE NOT NULL,
        "overdue_days" INTEGER NOT NULL,
        "status" VARCHAR(50) DEFAULT 'draft',
        "userId" INTEGER,
        "companyId" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table repost:`, err);
    }
    // ✅ Ensure permissions table exists (RBAC master table)
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" SERIAL PRIMARY KEY,
        "module" VARCHAR(100) NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "idx_permissions_module_action" UNIQUE ("module", "action")
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table permissions:`, err);
    }
    // ✅ Ensure user_permissions table exists (RBAC user assignments)
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "user_permissions" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "permissionId" INTEGER NOT NULL,
        "companyId" INTEGER NOT NULL,
        "grantedBy" INTEGER NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "idx_user_perm_unique" UNIQUE ("userId", "permissionId", "companyId")
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table user_permissions:`, err);
    }
    // ✅ Ensure tasks table exists (task management)
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" SERIAL PRIMARY KEY,
        "title" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'todo',
        "priority" VARCHAR(50) NOT NULL DEFAULT 'medium',
        "dueDate" TIMESTAMP WITH TIME ZONE,
        "assignedTo" INTEGER,
        "assignedBy" INTEGER NOT NULL,
        "companyId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table tasks:`, err);
    }
    // ✅ Ensure task_history table exists (audit trail)
    try {
        yield sequelize.query(`
      CREATE TABLE IF NOT EXISTS "task_history" (
        "id" SERIAL PRIMARY KEY,
        "taskId" INTEGER NOT NULL,
        "changedBy" INTEGER NOT NULL,
        "field" VARCHAR(100) NOT NULL,
        "oldValue" TEXT,
        "newValue" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    catch (err) {
        console.error(`❌ Error creating table task_history:`, err);
    }
});
/**
 * 🛠️ MANUAL CONSTRAINT FIX
 * Since we moved meeting data to 'meeting_companies', we must update the
 * foreign key constraints in your existing tables.
 */
const fixConstraints = (sequelize) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1️⃣ Point 'meetings' to the correct 'meeting_companies' table
        yield sequelize.query(`
      ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_company_id_fkey";
      ALTER TABLE "meetings" ADD CONSTRAINT "meetings_company_id_fkey" 
      FOREIGN KEY ("company_id") REFERENCES "meeting_companies" ("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);
        // 2️⃣ Ensure 'meetings' points to correct 'users' and 'meeting_users'
        yield sequelize.query(`
      ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_user_id_fkey";
      ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_meeting_user_id_fkey";
      ALTER TABLE "meetings" ADD CONSTRAINT "meetings_meeting_user_id_fkey"
      FOREIGN KEY ("meeting_user_id") REFERENCES "meeting_users" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);
        // 3️⃣ Notification FK constraints (managed manually — not via Sequelize alter:true)
        yield sequelize.query(`
      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_receiverId_fkey";
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_senderId_fkey";
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    }
    catch (err) {
        console.error("❌ Error fixing constraints:", err);
    }
});
/**
 * 🛠️ DATA INTEGRITY HELPER
 * Ensures that all 'companyId' references in child tables are valid.
 * If a 'companyId' points to a non-existent company, it sets it to NULL.
 * This prevents Foreign Key constraint violations during sync.
 */
const ensureDataIntegrity = (sequelize) => __awaiter(void 0, void 0, void 0, function* () {
    const tables = ["departments", "branches", "shifts", "holidays", "invoices", "company_leaves", "company_banks"];
    for (const table of tables) {
        try {
            // 1️⃣ Check if table and companyId column exist before running update
            const [results] = yield sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = 'companyId';
      `);
            if (results.length > 0) {
                yield sequelize.query(`
          DELETE FROM "${table}" 
          WHERE "companyId" IS NOT NULL 
          AND "companyId" NOT IN (SELECT "id" FROM "companies");
        `);
            }
            // 2️⃣ Handle Invoices specific data integrity (status ENUM conversion)
            if (table === "invoices") {
                const [statusCols] = yield sequelize.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'invoices' AND column_name = 'status';
        `);
                if (statusCols.length > 0) {
                    // If the status column is not already an ENUM, sanitize it
                    // In Postgres, ENUM types often show up as 'USER-DEFINED' in information_schema
                    const colInfo = statusCols[0];
                    if (colInfo.data_type === 'character varying' || colInfo.data_type === 'text') {
                        yield sequelize.query(`UPDATE "invoices" SET "status" = 'draft' WHERE "status" IS NULL OR "status" NOT IN ('draft', 'sent', 'accepted', 'rejected')`);
                        yield sequelize.query(`DO $$ BEGIN CREATE TYPE "public"."enum_invoices_status" AS ENUM('draft', 'sent', 'accepted', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
                        // Drop default before type conversion — PostgreSQL cannot auto-cast string default to ENUM
                        yield sequelize.query(`ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT`);
                        yield sequelize.query(`ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "public"."enum_invoices_status" USING ("status"::"public"."enum_invoices_status")`);
                        yield sequelize.query(`ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_invoices_status"`);
                    }
                }
            }
        }
        catch (err) {
            console.error(`❌ Error during data integrity check for ${table}:`, err);
        }
    }
    // 3️⃣ Notifications type column: convert VARCHAR → ENUM before sync({ alter: true })
    try {
        const [typeCols] = yield sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'type';
    `);
        if (typeCols.length > 0 && (typeCols[0].data_type === 'character varying' || typeCols[0].data_type === 'text')) {
            yield sequelize.query(`
        UPDATE "notifications"
        SET "type" = 'system'
        WHERE "type" IS NULL OR "type" NOT IN ('chat', 'task', 'meeting', 'system', 'other');

        ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT;

        DO $$ BEGIN
          CREATE TYPE "public"."enum_notifications_type" AS ENUM('chat', 'task', 'meeting', 'system', 'other');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        ALTER TABLE "notifications"
        ALTER COLUMN "type" TYPE "public"."enum_notifications_type"
        USING ("type"::"public"."enum_notifications_type");

        ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system';
      `);
            console.log('✅ Converted notifications.type from VARCHAR to ENUM');
        }
    }
    catch (err) {
        console.error('❌ Error converting notifications.type to ENUM:', err);
    }
    // repost.status column: convert VARCHAR → ENUM before sync({ alter: true })
    try {
        const [repostStatusCols] = yield sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'repost' AND column_name = 'status';
    `);
        if (repostStatusCols.length > 0 && (repostStatusCols[0].data_type === 'character varying' || repostStatusCols[0].data_type === 'text')) {
            yield sequelize.query(`
        UPDATE "repost"
        SET "status" = 'draft'
        WHERE "status" IS NULL OR "status" NOT IN ('draft', 'imported', 'sent', 'accepted', 'rejected', 'cancelled', 'deleted');

        ALTER TABLE "repost" ALTER COLUMN "status" DROP DEFAULT;

        DO $$ BEGIN
          CREATE TYPE "public"."enum_repost_status" AS ENUM('draft', 'imported', 'sent', 'accepted', 'rejected', 'cancelled', 'deleted');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        ALTER TABLE "repost"
        ALTER COLUMN "status" TYPE "public"."enum_repost_status"
        USING ("status"::"public"."enum_repost_status");

        ALTER TABLE "repost" ALTER COLUMN "status" SET DEFAULT 'draft';
      `);
            console.log('✅ Converted repost.status from VARCHAR to ENUM');
        }
        // Add missing enum values to existing enum_repost_status if already an ENUM
        yield sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."enum_repost_status" ADD VALUE IF NOT EXISTS 'cancelled';
        ALTER TYPE "public"."enum_repost_status" ADD VALUE IF NOT EXISTS 'deleted';
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
    }
    catch (err) {
        console.error('❌ Error converting repost.status to ENUM:', err);
    }
    // Table Sanitization (fix NULL values for NOT NULL columns)
    try {
        // Sanitize Companies table
        yield sequelize.query(`
      UPDATE "companies" 
      SET "legalName" = "companyName" 
      WHERE "legalName" IS NULL;

      UPDATE "companies" 
      SET "registrationNo" = 'N/A' 
      WHERE "registrationNo" IS NULL;

      UPDATE "companies" 
      SET "companyEmail" = 'unknown@example.com' 
      WHERE "companyEmail" IS NULL;

      UPDATE "companies" 
      SET "companyPhone" = '0000000000' 
      WHERE "companyPhone" IS NULL;
    `);
        console.log(`✅ Sanitized mandatory fields in companies table`);
        // Sanitize Meetings table
        yield sequelize.query(`
      DELETE FROM "meetings" 
      WHERE "user_id" IS NULL 
      OR "company_id" IS NULL;
    `);
        console.log(`✅ Cleaned up orphaned records from meetings table`);
    }
    catch (err) {
        console.error(`❌ Error during table sanitization:`, err);
    }
});
// ===== DB CONNECTION =====
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1️⃣ Run manual migration for specific missing columns
        yield ensureColumns(sequelize);
        // 2️⃣ Fix foreign key constraints for meeting tables
        yield fixConstraints(sequelize);
        // 3️⃣ Ensure data integrity (orphaned companyId cleanup)
        yield ensureDataIntegrity(sequelize);
        // 4️⃣ Standard Sequelize sync
        yield sequelize.authenticate();
        // await sequelize.sync({ alter: true });
        // 5️⃣ Seed RBAC permissions table (idempotent — safe every boot)
        const { seedPermissions } = yield Promise.resolve().then(() => __importStar(require("./seedPermissions")));
        yield seedPermissions();
    }
    catch (err) {
        console.error("❌ DB error:", err);
    }
});
exports.connectDB = connectDB;
