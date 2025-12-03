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
exports.Message = exports.ChatParticipant = exports.ChatRoom = exports.Expense = exports.Leave = exports.Attendance = exports.Device = exports.Meeting = exports.Category = exports.User = exports.sequelize = exports.connectDB = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sequelize_1 = require("sequelize");
const env = process.env;
const user_1 = require("../app/model/user");
const category_1 = require("../app/model/category");
const meeting_1 = require("../app/model/meeting");
const device_1 = require("../app/model/device");
const attendance_1 = require("../app/model/attendance");
Object.defineProperty(exports, "Attendance", { enumerable: true, get: function () { return attendance_1.Attendance; } });
const leaverequests_1 = require("../app/model/leaverequests");
Object.defineProperty(exports, "Leave", { enumerable: true, get: function () { return leaverequests_1.Leave; } });
const expense_1 = require("../app/model/expense");
Object.defineProperty(exports, "Expense", { enumerable: true, get: function () { return expense_1.Expense; } });
const chatRoom_1 = require("../app/model/chatRoom");
Object.defineProperty(exports, "ChatRoom", { enumerable: true, get: function () { return chatRoom_1.ChatRoom; } });
const ChatParticipant_1 = require("../app/model/ChatParticipant");
Object.defineProperty(exports, "ChatParticipant", { enumerable: true, get: function () { return ChatParticipant_1.ChatParticipant; } });
const Message_1 = require("../app/model/Message");
Object.defineProperty(exports, "Message", { enumerable: true, get: function () { return Message_1.Message; } });
const sequelize = new sequelize_1.Sequelize(env.DB_NAME || "default_db", env.DB_USER_NAME || "default_user", env.DB_PASSWORD || "default_password", {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
    // ssl: {
    //   require: true,
    //   rejectUnauthorized: false,   // ✅ Important for AWS/Railway/Render
    // },
    },
});
exports.sequelize = sequelize;
attendance_1.Attendance.initModel(sequelize);
leaverequests_1.Leave.initModel(sequelize);
expense_1.Expense.initModel(sequelize);
const User = (0, user_1.createUserModel)(sequelize);
exports.User = User;
const Category = (0, category_1.CategoryModel)(sequelize);
exports.Category = Category;
const Meeting = (0, meeting_1.MeetingTypeModel)(sequelize);
exports.Meeting = Meeting;
const Device = (0, device_1.DeviceModel)(sequelize);
exports.Device = Device;
// const Chat = ChatRoom(sequelize);
// const Message = Message(sequelize);
// // const Device = DeviceModel(sequelize);
chatRoom_1.ChatRoom.initModel(sequelize);
ChatParticipant_1.ChatParticipant.initModel(sequelize);
Message_1.Message.initModel(sequelize);
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
User.hasMany(attendance_1.Attendance, { foreignKey: "employee_id" });
attendance_1.Attendance.belongsTo(User, { foreignKey: "employee_id", as: "user" });
User.hasMany(leaverequests_1.Leave, { foreignKey: "employee_id" });
leaverequests_1.Leave.belongsTo(User, { foreignKey: "employee_id", as: "user" });
User.hasMany(expense_1.Expense, { foreignKey: "userId" });
expense_1.Expense.belongsTo(User, { foreignKey: "userId", as: "user" });
chatRoom_1.ChatRoom.hasMany(ChatParticipant_1.ChatParticipant, {
    foreignKey: "chatRoomId",
    as: "participants",
});
ChatParticipant_1.ChatParticipant.belongsTo(chatRoom_1.ChatRoom, {
    foreignKey: "chatRoomId",
});
// ChatRoom → Messages
chatRoom_1.ChatRoom.hasMany(Message_1.Message, {
    foreignKey: "chatRoomId",
    as: "messages",
});
Message_1.Message.belongsTo(chatRoom_1.ChatRoom, {
    foreignKey: "chatRoomId",
});
// User → Message
User.hasMany(Message_1.Message, { foreignKey: "senderId" });
Message_1.Message.belongsTo(User, { foreignKey: "senderId" });
User.hasMany(ChatParticipant_1.ChatParticipant, {
    foreignKey: "userId",
    as: "chatParticipants"
});
ChatParticipant_1.ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });
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
