"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidayModel = exports.Holiday = void 0;
const sequelize_1 = require("sequelize");
class Holiday extends sequelize_1.Model {
}
exports.Holiday = Holiday;
const HolidayModel = (sequelize) => {
    const Holiday = sequelize.define("Holiday", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        holidayName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        holidayDate: {
            type: sequelize_1.DataTypes.DATEONLY, // ✅ correct for date like "2026-03-04"
            allowNull: false,
        },
        holidayType: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        // 🔗 Relation
        branchId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true, // null = All branches
        },
        description: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
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
        companyId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
    }, {
        tableName: "holidays",
        timestamps: true,
    });
    return Holiday;
};
exports.HolidayModel = HolidayModel;
