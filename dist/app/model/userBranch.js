"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBranchModel = exports.UserBranch = void 0;
const sequelize_1 = require("sequelize");
class UserBranch extends sequelize_1.Model {
}
exports.UserBranch = UserBranch;
const UserBranchModel = (sequelize) => {
    UserBranch.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
        branchId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    }, {
        sequelize,
        tableName: "user_branches",
        timestamps: true,
        indexes: [{ unique: true, fields: ["userId", "branchId"] }],
    });
    return UserBranch;
};
exports.UserBranchModel = UserBranchModel;
