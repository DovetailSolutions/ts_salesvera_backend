import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";
const env = process.env;
import { createUserModel } from "../app/model/user";
import { CategoryModel } from "../app/model/category";
import { MeetingTypeModel } from "../app/model/meeting";
import { DeviceModel } from "../app/model/device";
import {Attendance} from "../app/model/attendance"
import {Leave} from '../app/model/leaverequests'
import {Expense} from '../app/model/expense'
import{ChatRoom} from '../app/model/chatRoom'
import{ChatParticipant} from '../app/model/ChatParticipant'
import{Message} from '../app/model/Message'


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
      // ssl: {
      //   require: true,
      //   rejectUnauthorized: false,   // ✅ Important for AWS/Railway/Render
      // },
    },
  }
);

Attendance.initModel(sequelize);
Leave.initModel(sequelize)
Expense.initModel(sequelize)

const User = createUserModel(sequelize);
const Category = CategoryModel(sequelize);
const Meeting = MeetingTypeModel(sequelize);
const Device = DeviceModel(sequelize);
// const Chat = ChatRoom(sequelize);
// const Message = Message(sequelize);
// // const Device = DeviceModel(sequelize);
ChatRoom.initModel(sequelize);
ChatParticipant.initModel(sequelize);
Message.initModel(sequelize);




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




User.hasMany(Attendance, { foreignKey: "employee_id" });
Attendance.belongsTo(User, { foreignKey: "employee_id", as: "user" });

User.hasMany(Leave, { foreignKey: "employee_id" });
Leave.belongsTo(User, { foreignKey: "employee_id", as: "user" });

User.hasMany(Expense, { foreignKey: "userId" });
Expense.belongsTo(User, { foreignKey: "userId", as: "user" });





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





export const connectDB = async () => {
  try {
    console.log("✅ Database connection established successfully");
    await sequelize.sync({ alter: true });
    await sequelize.authenticate();
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
  Message
};
