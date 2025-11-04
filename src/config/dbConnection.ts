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
  Expense
};
