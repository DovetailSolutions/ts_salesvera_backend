import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";
const env = process.env;

// ===== MODELS =====
import { createUserModel } from "../app/model/user";
import { CategoryModel } from "../app/model/category";
import { SubCategoryModel } from "../app/model/subCategory";

import { MeetingModel } from "../app/model/meeting";
import { MeetingImageModel } from "../app/model/meetingImage";
import { MeetingCompanyModel } from "../app/model/meetingCompany";
import { UserModel } from "../app/model/meetingUser";

import { DeviceModel } from "../app/model/device";

import { Attendance } from "../app/model/attendance";
import { Leave } from "../app/model/leaverequests";

import { Expense } from "../app/model/expense";
import { ExpenseImage } from "../app/model/expanseImages";

import { ChatRoom } from "../app/model/chatRoom";
import { ChatParticipant } from "../app/model/ChatParticipant";
import { Message } from "../app/model/Message";

import { Quotations } from "../app/model/quotations";

import { CompanyModell } from "../app/model/company";
import { CompanyManagerModel } from "../app/model/companyManager";
import { BranchModel } from "../app/model/branch";
import { ShiftModel } from "../app/model/Shift";
import { DepartmentModel } from "../app/model/department";
import { HolidayModel } from "../app/model/holiday";

import { CompanyLeave } from "../app/model/Leave";
import { EmployeeLeaveBalance } from "../app/model/EmployeeLeaveBalance";

import { CompanyBankModel } from "../app/model/bank";

import { Invoices } from "../app/model/Invoice";

import { RecordSales } from "../app/model/saleRecord";
import { Notification } from "../app/model/Notification";
import { RepostModel } from "../app/model/report";


// RBAC Models
import { PermissionModel } from "../app/model/permission";
import { UserPermissionModel } from "../app/model/userPermission";

import { Task } from "../app/model/task";
import { TaskHistory } from "../app/model/taskHistory";

// ===== SEQUELIZE INIT =====
const sequelize = new Sequelize(
  env.DB_NAME || "default_db",
  env.DB_USER_NAME || "default_user",
  env.DB_PASSWORD || "default_password",
  {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
    ...(env.DB_HOST !== "127.0.0.1" && env.DB_HOST !== "localhost"
      ? {
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          },
        }
      : {}),
  }


);

// ===== INIT MODELS =====

// Core
const User = createUserModel(sequelize);
const Category = CategoryModel(sequelize);
const SubCategory = SubCategoryModel(sequelize);

// Meeting
const Meeting = MeetingModel(sequelize);
const MeetingImage = MeetingImageModel(sequelize);
const MeetingCompany = MeetingCompanyModel(sequelize);
const MeetingUser = UserModel(sequelize);

// Device
const Device = DeviceModel(sequelize);

// HR
Attendance.initModel(sequelize);
Leave.initModel(sequelize);

// Expense
Expense.initModel(sequelize);
ExpenseImage.initModel(sequelize);

// Chat
ChatRoom.initModel(sequelize);
ChatParticipant.initModel(sequelize);
Message.initModel(sequelize);

// Sales
Quotations.initModel(sequelize);

// Company Structure
const Company = CompanyModell(sequelize);
const CompanyManager = CompanyManagerModel(sequelize);
const Branch = BranchModel(sequelize);

const Department = DepartmentModel(sequelize);
const Holiday = HolidayModel(sequelize);
const Shift = ShiftModel(sequelize);

CompanyLeave.initModel(sequelize);
EmployeeLeaveBalance.initModel(sequelize);

const CompanyBank = CompanyBankModel(sequelize);

Invoices.initModel(sequelize);

RecordSales.initModel(sequelize);
Notification.initModel(sequelize);

// RBAC
const Permission = PermissionModel(sequelize);
const UserPermission = UserPermissionModel(sequelize);

const Report = RepostModel(sequelize);

// Task Management
Task.initModel(sequelize);
TaskHistory.initModel(sequelize);

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
User.hasMany(Attendance, { foreignKey: "employee_id" });
Attendance.belongsTo(User, { foreignKey: "employee_id", as: "user" });

User.hasMany(Leave, { foreignKey: "employee_id" });
Leave.belongsTo(User, { foreignKey: "employee_id", as: "user" });

User.hasMany(EmployeeLeaveBalance, { foreignKey: "employeeId", as: "leaveBalances" });
EmployeeLeaveBalance.belongsTo(User, { foreignKey: "employeeId", as: "employee" });

// Expense
User.hasMany(Expense, { foreignKey: "userId" });
Expense.belongsTo(User, { foreignKey: "userId", as: "user" });

Expense.hasMany(ExpenseImage, { foreignKey: "expenseId", as: "images" });
ExpenseImage.belongsTo(Expense, { foreignKey: "expenseId" });

// Chat
ChatRoom.hasMany(ChatParticipant, {
  foreignKey: "chatRoomId",
  as: "participants",
});
ChatParticipant.belongsTo(ChatRoom, { foreignKey: "chatRoomId" });

ChatRoom.hasMany(Message, {
  foreignKey: "chatRoomId",
  as: "messages",
});
Message.belongsTo(ChatRoom, { foreignKey: "chatRoomId" });

User.hasMany(Message, { foreignKey: "senderId" });
Message.belongsTo(User, { foreignKey: "senderId" });

// Self-referential: reply-to chain (WhatsApp-style quoted messages)
Message.belongsTo(Message, { foreignKey: "replyTo", as: "repliedMessage" });

User.hasMany(ChatParticipant, {
  foreignKey: "userId",
  as: "chatParticipants",
});
ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });

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
User.hasMany(Quotations, { foreignKey: "userId" });
Quotations.belongsTo(User, { foreignKey: "userId" });

// User / Company
User.hasOne(Company, { foreignKey: "adminId", as: "company" });
Company.belongsTo(User, { foreignKey: "adminId", as: "admin" });

// Many-to-many: a manager can manage multiple companies, a company can have multiple managers
Company.belongsToMany(User, { through: CompanyManager, as: "managers", foreignKey: "companyId", otherKey: "managerId" });
User.belongsToMany(Company, { through: CompanyManager, as: "managedCompanies", foreignKey: "managerId", otherKey: "companyId" });
CompanyManager.belongsTo(Company, { foreignKey: "companyId", as: "company" });
CompanyManager.belongsTo(User, { foreignKey: "managerId", as: "manager" });

Company.hasMany(Branch, { foreignKey: "companyId", as: "branches" });
Branch.belongsTo(Company, { foreignKey: "companyId", as: "company" });

User.belongsTo(Branch, {
  foreignKey: "branchId",
  as: "branch",
});

Branch.hasMany(User, {
  foreignKey: "branchId",
  as: "users",
});

Company.hasMany(Department, { foreignKey: "companyId", as: "departments" });
Department.belongsTo(Company, { foreignKey: "companyId", as: "company" });

Company.hasMany(Holiday, { foreignKey: "companyId", as: "holidays" });
Holiday.belongsTo(Company, { foreignKey: "companyId", as: "company" });

Company.hasMany(Shift, { foreignKey: "companyId", as: "shifts" });
Shift.belongsTo(Company, { foreignKey: "companyId", as: "company" });

Company.hasMany(CompanyLeave, { foreignKey: "companyId", as: "companyLeaves" });
CompanyLeave.belongsTo(Company, { foreignKey: "companyId", as: "company" });

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
User.hasMany(Notification, { foreignKey: "receiverId", as: "receivedNotifications", constraints: false });
Notification.belongsTo(User, { foreignKey: "receiverId", as: "receiver", constraints: false });

User.hasMany(Notification, { foreignKey: "senderId", as: "sentNotifications", constraints: false });
Notification.belongsTo(User, { foreignKey: "senderId", as: "sender", constraints: false });

// Task associations
User.hasMany(Task, { foreignKey: "assignedTo", as: "assignedTasks", constraints: false });
Task.belongsTo(User, { foreignKey: "assignedTo", as: "assignee", constraints: false });

User.hasMany(Task, { foreignKey: "assignedBy", as: "createdTasks", constraints: false });
Task.belongsTo(User, { foreignKey: "assignedBy", as: "creator", constraints: false });

Company.hasMany(Task, { foreignKey: "companyId", as: "tasks", constraints: false });
Task.belongsTo(Company, { foreignKey: "companyId", as: "company", constraints: false });

// TaskHistory associations
Task.hasMany(TaskHistory, { foreignKey: "taskId", as: "history", constraints: false });
TaskHistory.belongsTo(Task, { foreignKey: "taskId", constraints: false });

User.hasMany(TaskHistory, { foreignKey: "changedBy", as: "taskChanges", constraints: false });
TaskHistory.belongsTo(User, { foreignKey: "changedBy", as: "changedByUser", constraints: false });




/**
 * 🛠️ MANUAL MIGRATION HELPER
 * This ensures the 'meeting_user_id' column exists in essential tables. 
 * This is needed because standard sync({ alter: true }) sometimes fails on AWS 
 * to add new columns to existing tables.
 */
const ensureColumns = async (sequelize: Sequelize) => {
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
        { name: "lastLoginCompanyId", type: "INTEGER" },
        { name: "branchId", type: "INTEGER" },
      ],
    },
    {
      tableName: "quotations",
      columns: [
        { name: "branchId", type: "INTEGER" },
      ],
    },
    {
      tableName: "sub_categories",
      columns: [
        { name: "tally_guid", type: "VARCHAR(255)" },
        { name: "baseUnit", type: "VARCHAR(255)" },
        { name: "secandryUnit", type: "VARCHAR(255)" },
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
    {
      // ✅ company_leaves: compOffBalance/casualLeaveBalance/sickLeaveBalance were
      // added to the CompanyLeave model but never patched into the live DB table.
      tableName: "company_leaves",
      columns: [
        { name: "compOffBalance", type: "INTEGER DEFAULT 0" },
        { name: "casualLeaveBalance", type: "INTEGER DEFAULT 0" },
        { name: "sickLeaveBalance", type: "INTEGER DEFAULT 0" },
      ],
    },
    {
      tableName: "repost",
      columns: [
        { name: "tallyGuid", type: "VARCHAR(255)" },
      ],
    },
  ];


  for (const config of tableConfigs) {
    // 1️⃣ Ensure Table Exists (Emergency fallback for missing tables)
    if (config.tableName === "shifts") {
      try {
        await sequelize.query(`
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
        
      } catch (err) {
        console.error(`❌ Error creating table shifts:`, err);
      }
    }

    // 2️⃣ Ensure Columns Exist
    for (const column of config.columns) {
      try {
        await sequelize.query(`
          ALTER TABLE "${config.tableName}" 
          ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type};
        `);
      
      } catch (err) {
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
      await sequelize.query(`ALTER TABLE "${item.table}" DROP CONSTRAINT IF EXISTS "${item.constraint}";`);

    } catch (err) {
      // Ignore if doesn't exist
    }
  }

  // ✅ Ensure company_managers junction table exists (many-to-many: company ↔ manager)
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "company_managers" (
        "id" SERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL,
        "managerId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "company_managers_unique" UNIQUE ("companyId", "managerId")
      );
    `);
  } catch (err) {
    console.error(`❌ Error creating table company_managers:`, err);
  }

  // ✅ Ensure company_banks table exists (new table added to model)
  try {
    await sequelize.query(`
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
    
  } catch (err) {
    console.error(`❌ Error creating table company_banks:`, err);
  }

  // ✅ Ensure employee_leave_balances table exists (per-employee yearly leave balance)
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "employee_leave_balances" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" INTEGER NOT NULL,
        "companyId" INTEGER,
        "branchId" INTEGER,
        "year" INTEGER NOT NULL,
        "casualLeaveAllocated" INTEGER DEFAULT 0,
        "casualLeaveUsed" INTEGER DEFAULT 0,
        "sickLeaveAllocated" INTEGER DEFAULT 0,
        "sickLeaveUsed" INTEGER DEFAULT 0,
        "paidLeaveAllocated" INTEGER DEFAULT 0,
        "paidLeaveUsed" INTEGER DEFAULT 0,
        "assignedBy" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "employee_leave_balances_employee_year_unique" UNIQUE ("employeeId", "year")
      );
    `);

  } catch (err) {
    console.error(`❌ Error creating table employee_leave_balances:`, err);
  }

  // ✅ Ensure invoices table exists (auto sync sometimes fails)
  try {
    await sequelize.query(`
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

  } catch (err) {
    console.error(`❌ Error creating table invoices:`, err);
  }

  // ✅ Ensure notifications table exists
  try {
    await sequelize.query(`
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

  } catch (err) {
    console.error(`❌ Error creating table notifications:`, err);
  }

  // ✅ Ensure record_sales table exists
  try {
    await sequelize.query(`
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

  } catch (err) {
    console.error(`❌ Error creating table record_sales:`, err);
  }

  // ✅ Ensure repost table exists
  try {
    await sequelize.query(`
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

  } catch (err) {
    console.error(`❌ Error creating table repost:`, err);
  }

  // ✅ Ensure permissions table exists (RBAC master table)
  try {
    await sequelize.query(`
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
  } catch (err) {
    console.error(`❌ Error creating table permissions:`, err);
  }

  // ✅ Ensure user_permissions table exists (RBAC user assignments)
  try {
    await sequelize.query(`
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
  } catch (err) {
    console.error(`❌ Error creating table user_permissions:`, err);
  }

  // ✅ Ensure tasks table exists (task management)
  try {
    await sequelize.query(`
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
  } catch (err) {
    console.error(`❌ Error creating table tasks:`, err);
  }

  // ✅ Ensure task_history table exists (audit trail)
  try {
    await sequelize.query(`
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
  } catch (err) {
    console.error(`❌ Error creating table task_history:`, err);
  }
};




/**
 * 🛠️ MANUAL CONSTRAINT FIX
 * Since we moved meeting data to 'meeting_companies', we must update the 
 * foreign key constraints in your existing tables. 
 */
const fixConstraints = async (sequelize: Sequelize) => {
  try {
    // 1️⃣ Point 'meetings' to the correct 'meeting_companies' table
    await sequelize.query(`
      ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_company_id_fkey";
      ALTER TABLE "meetings" ADD CONSTRAINT "meetings_company_id_fkey" 
      FOREIGN KEY ("company_id") REFERENCES "meeting_companies" ("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // 2️⃣ Ensure 'meetings' points to correct 'users' and 'meeting_users'
    await sequelize.query(`
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
    await sequelize.query(`
      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_receiverId_fkey";
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_senderId_fkey";
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

  } catch (err) {
    console.error("❌ Error fixing constraints:", err);
  }
};

/**
 * 🛠️ DATA INTEGRITY HELPER
 * Ensures that all 'companyId' references in child tables are valid.
 * If a 'companyId' points to a non-existent company, it sets it to NULL.
 * This prevents Foreign Key constraint violations during sync.
 */
const ensureDataIntegrity = async (sequelize: Sequelize) => {
  const tables = ["departments", "branches", "shifts", "holidays", "invoices", "company_leaves", "company_banks"];

  for (const table of tables) {
    try {
      // 1️⃣ Check if table and companyId column exist before running update
      const [results]: any = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = 'companyId';
      `);

      if (results.length > 0) {
        await sequelize.query(`
          DELETE FROM "${table}" 
          WHERE "companyId" IS NOT NULL 
          AND "companyId" NOT IN (SELECT "id" FROM "companies");
        `);
        
      }

      // 2️⃣ Handle Invoices specific data integrity (status ENUM conversion)
      if (table === "invoices") {
        const [statusCols]: any = await sequelize.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'invoices' AND column_name = 'status';
        `);

        if (statusCols.length > 0) {
          // If the status column is not already an ENUM, sanitize it
          // In Postgres, ENUM types often show up as 'USER-DEFINED' in information_schema
          const colInfo = statusCols[0];
          if (colInfo.data_type === 'character varying' || colInfo.data_type === 'text') {
            await sequelize.query(`UPDATE "invoices" SET "status" = 'draft' WHERE "status" IS NULL OR "status" NOT IN ('draft', 'sent', 'accepted', 'rejected')`);

            await sequelize.query(`DO $$ BEGIN CREATE TYPE "public"."enum_invoices_status" AS ENUM('draft', 'sent', 'accepted', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$`);

            // Drop default before type conversion — PostgreSQL cannot auto-cast string default to ENUM
            await sequelize.query(`ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT`);

            await sequelize.query(`ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "public"."enum_invoices_status" USING ("status"::"public"."enum_invoices_status")`);

            await sequelize.query(`ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_invoices_status"`);
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error during data integrity check for ${table}:`, err);
    }
  }

  // 3️⃣ Notifications type column: convert VARCHAR → ENUM before sync({ alter: true })
  try {
    const [typeCols]: any = await sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'type';
    `);

    if (typeCols.length > 0 && (typeCols[0].data_type === 'character varying' || typeCols[0].data_type === 'text')) {
      await sequelize.query(`
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
  } catch (err) {
    console.error('❌ Error converting notifications.type to ENUM:', err);
  }

  // repost.status column: convert VARCHAR → ENUM before sync({ alter: true })
  try {
    const [repostStatusCols]: any = await sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'repost' AND column_name = 'status';
    `);

    if (repostStatusCols.length > 0 && (repostStatusCols[0].data_type === 'character varying' || repostStatusCols[0].data_type === 'text')) {
      await sequelize.query(`
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
    await sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."enum_repost_status" ADD VALUE IF NOT EXISTS 'cancelled';
        ALTER TYPE "public"."enum_repost_status" ADD VALUE IF NOT EXISTS 'deleted';
      EXCEPTION WHEN others THEN null;
      END $$;
    `);
  } catch (err) {
    console.error('❌ Error converting repost.status to ENUM:', err);
  }

  // Table Sanitization (fix NULL values for NOT NULL columns)
  try {
    // Sanitize Companies table
    await sequelize.query(`
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
    await sequelize.query(`
      DELETE FROM "meetings" 
      WHERE "user_id" IS NULL 
      OR "company_id" IS NULL;
    `);
    console.log(`✅ Cleaned up orphaned records from meetings table`);
  } catch (err) {
    console.error(`❌ Error during table sanitization:`, err);
  }
};

// ===== DB CONNECTION =====


export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    
    // Check if the database is fresh (no users table)
    const tableNames = await sequelize.getQueryInterface().showAllTables();
    const isFreshDB = !tableNames.includes("users");

    if (isFreshDB) {
      console.log("🌱 Fresh database detected. Running clean sync...");
      await sequelize.sync();
    } else {
      // 1️⃣ Run manual migration for specific missing columns
      await ensureColumns(sequelize);

      // 2️⃣ Fix foreign key constraints for meeting tables
      await fixConstraints(sequelize);

      // 3️⃣ Ensure data integrity (orphaned companyId cleanup)
      await ensureDataIntegrity(sequelize);

      // 4️⃣ Standard Sequelize sync
      await sequelize.sync({ alter: true });
    }

    // 5️⃣ Seed RBAC permissions table (idempotent — safe every boot)
    const { seedPermissions } = await import("./seedPermissions");
    await seedPermissions();

    // 6️⃣ Seed default Super Admin user (idempotent — safe every boot)
    const [adminUser, created] = await User.findOrCreate({
      where: { email: "admin@salesvera.com" },
      defaults: {
        password: "password123", // Hashes automatically via User beforeCreate hook
        firstName: "Super",
        lastName: "Admin",
        phone: "1234567890",
        dob: "1990-01-01",
        role: "super_admin",
        onlineSatus: "offline",
        status: "active",
      },
    });
    if (created) {
      console.log("🌱 Seeded default Super Admin user: admin@salesvera.com / password123");
    }

  } catch (err) {
    console.error("❌ DB error:", err);
  }
};

// ===== EXPORTS =====
export {
  sequelize,
  User,
  Category,
  SubCategory,
  Meeting,
  Device,
  Attendance,
  Leave,
  Expense,
  ExpenseImage,
  ChatRoom,
  ChatParticipant,
  Message,
  MeetingImage,
  MeetingCompany,
  MeetingUser,
  Quotations,
  Company,
  CompanyManager,
  Branch,
  Shift,
  Department,
  Holiday,
  CompanyLeave,
  EmployeeLeaveBalance,
  CompanyBank,
  Invoices,
  RecordSales,
  // RBAC
  Permission,
  UserPermission,
  Notification,
  Report,
  Task,
  TaskHistory,
};