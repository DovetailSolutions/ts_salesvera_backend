"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeLeaveBalance = void 0;
const sequelize_1 = require("sequelize");
class EmployeeLeaveBalance extends sequelize_1.Model {
    static initModel(sequelize) {
        EmployeeLeaveBalance.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            employeeId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            branchId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            year: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            casualLeaveAllocated: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            casualLeaveUsed: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            sickLeaveAllocated: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            sickLeaveUsed: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            paidLeaveAllocated: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            paidLeaveUsed: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            assignedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
        }, {
            sequelize,
            tableName: "employee_leave_balances",
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ["employeeId", "year"],
                },
            ],
        });
        return EmployeeLeaveBalance;
    }
}
exports.EmployeeLeaveBalance = EmployeeLeaveBalance;
