import dotenv from "dotenv";
dotenv.config();
import { Sequelize, DataTypes } from "sequelize";
const env = process.env;
import { createUserModel } from "../app/model/user";
import { CategoryModel } from "../app/model/category";
import { MeetingModel } from "../app/model/meeting";
import { DeviceModel } from "../app/model/device";
import {Attendance} from "../app/model/attendance"
import {Leave} from '../app/model/leaverequests'
import {Expense} from '../app/model/expense'
import {ExpenseImage} from '../app/model/expanseImages'
import{ChatRoom} from '../app/model/chatRoom'
import{ChatParticipant} from '../app/model/ChatParticipant'
import{Message} from '../app/model/Message'
import{MeetingImageModel} from "../app/model/meetingImage"
import {CompanyModel} from "../app/model/meetingCompany"
import {UserModel} from "../app/model/meetingUser"
// import {Quotation} from "../app/model/quotation";
import {SubCategoryModel} from "../app/model/subCategory";
import {Quotations} from "../app/model/quotations";
import {CompanyModell} from "../app/model/company";
import {BranchModel} from "../app/model/branch";
import {ShiftModel} from "../app/model/Shift";
import {DepartmentModel} from "../app/model/department";
import {HolidayModel} from "../app/model/holiday";

const sequelize = new Sequelize(
  env.DB_NAME!,
  env.DB_USER_NAME!,
  env.DB_PASSWORD!,
  {
    host: env.DB_HOST!,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: true,
    ssl:true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,   // ✅ Important for AWS/Railway/Render
      },
    },
  }
);

const User = createUserModel(sequelize);
const Category = CategoryModel(sequelize);
const Meeting = MeetingModel(sequelize);
const Device = DeviceModel(sequelize);
const MeetingImage = MeetingImageModel(sequelize);
const MeetingCompany = CompanyModel(sequelize)
const MeetingUser =  UserModel(sequelize)
const SubCategory = SubCategoryModel(sequelize)
const Company = CompanyModell(sequelize)
const Branch = BranchModel(sequelize)
const Shift = ShiftModel(sequelize)
const Department = DepartmentModel(sequelize)
const Holiday = HolidayModel(sequelize)

Attendance.initModel(sequelize);
Leave.initModel(sequelize)
Expense.initModel(sequelize)
ExpenseImage.initModel(sequelize)
Quotations.initModel(sequelize)

ChatRoom.initModel(sequelize);
ChatParticipant.initModel(sequelize);
Message.initModel(sequelize);




// Self-referencing many-to-many relationship junction table
const UserCreators = sequelize.define("UserCreators", {
  user_id: {
    type: DataTypes.INTEGER,
    references: { model: "users", key: "id" },
    onDelete: "CASCADE",
  },
  created_by_user_id: {
    type: DataTypes.INTEGER,
    references: { model: "users", key: "id" },
    onDelete: "CASCADE",
  },
}, { tableName: "UserCreators", timestamps: true });

// User.belongsToMany(User, {
//   through: UserCreators,
//   as: "creators",
//   foreignKey: "user_id",
//   otherKey: "created_by_user_id",
// });

// User.belongsToMany(User, {
//   through: UserCreators,
//   as: "createdUsers",
//   foreignKey: "created_by_user_id",
//   otherKey: "user_id",
// });




User.hasMany(Attendance, { foreignKey: "employee_id" });
Attendance.belongsTo(User, { foreignKey: "employee_id", as: "user" });

User.hasMany(Leave, { foreignKey: "employee_id" });
Leave.belongsTo(User, { foreignKey: "employee_id", as: "user" });

User.hasMany(Expense, { foreignKey: "userId" });
Expense.belongsTo(User, { foreignKey: "userId", as: "user" });

Expense.hasMany(ExpenseImage, { foreignKey: "expenseId", as: "images" });
ExpenseImage.belongsTo(Expense, { foreignKey: "expenseId" });





ChatRoom.hasMany(ChatParticipant, {
  foreignKey: "chatRoomId",
  as: "participants",
});

ChatParticipant.belongsTo(ChatRoom, {
  foreignKey: "chatRoomId",
});

// ChatRoom → Messages
ChatRoom.hasMany(Message, {
  foreignKey: "chatRoomId",
  as: "messages",
});

Message.belongsTo(ChatRoom, {
  foreignKey: "chatRoomId",
});

// User → Message
User.hasMany(Message, { foreignKey: "senderId" });
Message.belongsTo(User, { foreignKey: "senderId" });

User.hasMany(ChatParticipant, {
  foreignKey: "userId",
  as: "chatParticipants"
});

ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });


// MeetingUser → Meeting (The Client Contact)
MeetingUser.hasMany(Meeting, { foreignKey: "meetingUserId" });
Meeting.belongsTo(MeetingUser, { foreignKey: "meetingUserId" });

// MeetingUser → MeetingCompany
MeetingUser.hasMany(MeetingCompany, { foreignKey: "meetingUserId" });
MeetingCompany.belongsTo(MeetingUser, { foreignKey: "meetingUserId" });

// MeetingUser → MeetingImage
MeetingUser.hasMany(MeetingImage, { foreignKey: "meetingUserId" });
MeetingImage.belongsTo(MeetingUser, { foreignKey: "meetingUserId" });

// Company → Meeting
MeetingCompany.hasMany(Meeting, { foreignKey: "companyId" });
Meeting.belongsTo(MeetingCompany, { foreignKey: "companyId" });

// Meeting → Images
Meeting.hasMany(MeetingImage, { foreignKey: "meetingId" });
MeetingImage.belongsTo(Meeting, { foreignKey: "meetingId" });

// Main Employee User → Meeting (This is what userId actually maps to!)
User.hasMany(Meeting, { foreignKey: "userId" });
Meeting.belongsTo(User, { foreignKey: "userId" });

// Company → Meeting
MeetingCompany.hasMany(Meeting, { foreignKey: "companyId" });
Meeting.belongsTo(MeetingCompany, { foreignKey: "companyId" });

// Meeting → Images
Meeting.hasMany(MeetingImage, { foreignKey: "meetingId" });
MeetingImage.belongsTo(Meeting, { foreignKey: "meetingId" });


Category.hasMany(SubCategory, {
  foreignKey: "CategoryId",
  as: "subCategories"
});

SubCategory.belongsTo(Category, {
  foreignKey: "CategoryId",
  as: "category"
});


//sale quotation
User.hasMany(Quotations, { foreignKey: "userId" });
Quotations.belongsTo(User, { foreignKey: "userId" });

// Sale.hasMany(Quotations, { foreignKey: "saleId" });
// Quotations.belongsTo(Sale, { foreignKey: "saleId" });





export const connectDB = async () => {
  try {
    console.log("✅ Database connection established successfully");
    await sequelize.authenticate();

    // Explicitly sync parent models first to ensure they exist for FK references
    await User.sync({ alter: true });
    await Category.sync({ alter: true });
    await Company.sync({ alter: true });

    // Explicitly sync joining table
    // await UserCreators.sync({ alter: true });

    // Sync all other models
    await sequelize.sync({ alter: true });
   
  } catch (err) {
    console.error("❌ DB error:", err);
  }
};

export {
  sequelize,
  User,
  Category,
  Meeting,
  Device,
  Attendance,
  Leave,
  Expense,
  ChatRoom,
  ChatParticipant,
  Message,
  MeetingImage,
  MeetingCompany,
  MeetingUser,
  ExpenseImage,
  // Quotation,
  SubCategory,
  Quotations,
  Company,
  Branch,
  Shift,
  Department,
  Holiday
};
