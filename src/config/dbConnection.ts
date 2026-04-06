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
import { CompanyModel } from "../app/model/meetingCompany";
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
    // dialectOptions: {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false,
    //   },
    // },
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
const MeetingCompany = CompanyModel(sequelize);
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

// ===== DB CONNECTION =====
export const connectDB = async () => {
  try {
    console.log("✅ Database connection established successfully");

    await sequelize.sync({ alter: true });
    await sequelize.authenticate();
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