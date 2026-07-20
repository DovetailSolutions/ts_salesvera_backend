"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyLeave = void 0;
const sequelize_1 = require("sequelize");
class CompanyLeave extends sequelize_1.Model {
    static initModel(sequelize) {
        CompanyLeave.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            leaveName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            leaveCode: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                unique: true, // good practice
            },
            leavesPerYear: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            carryForward: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            carryForwardLimit: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            managerApproval: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            branchId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("pending", "approved", "rejected"),
                allowNull: false,
                defaultValue: "pending",
            },
        }, {
            sequelize,
            tableName: "company_leaves",
            timestamps: true,
        });
        return CompanyLeave;
    }
}
exports.CompanyLeave = CompanyLeave;
