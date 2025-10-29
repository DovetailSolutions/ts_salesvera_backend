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
exports.createUserModel = exports.User = void 0;
const sequelize_1 = require("sequelize");
const bcrypt_1 = __importDefault(require("bcrypt"));
class User extends sequelize_1.Model {
}
exports.User = User;
// 4. Define the model
const createUserModel = (sequelize) => {
    const User = sequelize.define("User", {
        firstName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        lastName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        email: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        password: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        phone: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: sequelize_1.DataTypes.ENUM("user", "admin", "client", "super_admin", "manager", "sale_person"),
            allowNull: false,
            defaultValue: "user",
        },
        refreshToken: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        dob: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        profile: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        // createdBy: {
        //   type:DataTypes.ARRAY(DataTypes.INTEGER),
        //   allowNull: true,
        //   references: {
        //     model: "users", // If FK
        //     key: "id",
        //   },
        // },
    }, {
        tableName: "users",
        timestamps: true,
        hooks: {
            beforeCreate: (user) => __awaiter(void 0, void 0, void 0, function* () {
                if (user.password) {
                    const salt = yield bcrypt_1.default.genSalt(10);
                    user.password = yield bcrypt_1.default.hash(user.password, salt);
                }
            }),
            beforeUpdate: (user) => __awaiter(void 0, void 0, void 0, function* () {
                if (user.changed("password") && user.password) {
                    const salt = yield bcrypt_1.default.genSalt(10);
                    user.password = yield bcrypt_1.default.hash(user.password, salt);
                }
            }),
        },
    });
    return User;
};
exports.createUserModel = createUserModel;
