"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeLeaveTypeBalance = void 0;
const sequelize_1 = require("sequelize");
// One row per (employee, company-configured leave type, year) — replaces the
// old EmployeeLeaveBalance model's fixed casual/sick/paid columns with a
// dynamic structure that can represent however many leave types a company
// actually configured at registration (CompanyLeave), including custom ones.
class EmployeeLeaveTypeBalance extends sequelize_1.Model {
    static initModel(sequelize) {
        EmployeeLeaveTypeBalance.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            employeeId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            companyLeaveId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            year: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            allocated: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            used: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            carriedForward: {
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
            tableName: "employee_leave_type_balances",
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ["employeeId", "companyLeaveId", "year"],
                },
            ],
        });
        return EmployeeLeaveTypeBalance;
    }
}
exports.EmployeeLeaveTypeBalance = EmployeeLeaveTypeBalance;
