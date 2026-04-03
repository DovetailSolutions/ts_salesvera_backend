"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentModel = exports.Department = void 0;
const sequelize_1 = require("sequelize");
class Department extends sequelize_1.Model {
}
exports.Department = Department;
const DepartmentModel = (sequelize) => {
    const Department = sequelize.define("Department", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        deptName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        deptCode: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        deptHead: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        // 🔗 Relations
        branchId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true, // if "All" case
        },
        shiftId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        maxHeadcount: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
        },
        halfSaturday: {
            type: sequelize_1.DataTypes.BOOLEAN,
            defaultValue: false,
        },
        adminId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        managerId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
    }, {
        tableName: "departments",
        timestamps: true,
    });
    return Department;
};
exports.DepartmentModel = DepartmentModel;
