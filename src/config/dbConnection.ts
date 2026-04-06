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
import { BranchModel } from "../app/model/branch";
import { ShiftModel } from "../app/model/Shift";
import { DepartmentModel } from "../app/model/department";
import { HolidayModel } from "../app/model/holiday";

import { CompanyLeave } from "../app/model/Leave";

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
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
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
const Branch = BranchModel(sequelize);
const Shift = ShiftModel(sequelize);
const Department = DepartmentModel(sequelize);
const Holiday = HolidayModel(sequelize);

CompanyLeave.initModel(sequelize);

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

  ];

  for (const config of tableConfigs) {
    for (const column of config.columns) {
      try {
        await sequelize.query(`
          ALTER TABLE "${config.tableName}" 
          ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type};
        `);
        console.log(`✅ Checked/Added ${column.name} to table: ${config.tableName}`);
      } catch (err) {
        console.error(`❌ Error checking/adding ${column.name} to ${config.tableName}:`, err);
      }
    }
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

    console.log("✅ Fixed all meeting-related database constraints");
  } catch (err) {
    console.error("❌ Error fixing constraints:", err);
  }
};

// ===== DB CONNECTION =====


export const connectDB = async () => {
  try {
    console.log("✅ Database connection established successfully");

    // 1️⃣ Run manual migration for specific missing columns
    await ensureColumns(sequelize);

    // 2️⃣ Fix foreign key constraints for meeting tables
    await fixConstraints(sequelize);

    // 3️⃣ Standard Sequelize sync
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    


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
  Branch,
  Shift,
  Department,
  Holiday,
  CompanyLeave
};