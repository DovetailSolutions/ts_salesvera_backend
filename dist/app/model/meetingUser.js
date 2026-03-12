"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.User = void 0;
const sequelize_1 = require("sequelize");
class User extends sequelize_1.Model {
}
exports.User = User;
const UserModel = (sequelize) => {
    User.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        mobile: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true
        },
        customerType: {
            type: sequelize_1.DataTypes.ENUM("new", "existing", "followup"),
            defaultValue: "new",
        },
        //   role: {
        //     type: DataTypes.ENUM("admin", "manager", "employee"),
        //     defaultValue: "employee",
        //   },
    }, {
        sequelize,
        tableName: "meeting_users",
        timestamps: true,
    });
    return User;
};
exports.UserModel = UserModel;
