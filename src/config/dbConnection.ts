import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";
const env = process.env;
import { createUserModel } from "../app/model/user";
import { CategoryModel } from "../app/model/category";
import { PropertyTypeModel } from "../app/model/propertytpe";
import { FlatTypeModel } from "../app/model/flattype";
import { AmenitiesModel } from "../app/model/amenities";
import { PropertyModel } from "../app/model/property";
import { ProjectModel } from "../app/model/project";
import { MeetingTypeModel } from "../app/model/meeting";
import { DeviceModel } from "../app/model/device";

const sequelize = new Sequelize(
  env.DB_NAME || "default_db",
  env.DB_USER_NAME || "default_user",
  env.DB_PASSWORD || "default_password",
  {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
  }
);

const User = createUserModel(sequelize);
const Category = CategoryModel(sequelize);
const PropertyType = PropertyTypeModel(sequelize);
const Flat = FlatTypeModel(sequelize);
const Amenities = AmenitiesModel(sequelize);
const Property = PropertyModel(sequelize);
const Project = ProjectModel(sequelize);
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
  PropertyType,
  Flat,
  Amenities,
  Property,
  Project,
  Meeting,
  Device,
};
