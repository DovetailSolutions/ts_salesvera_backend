"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftModel = exports.Shift = void 0;
const sequelize_1 = require("sequelize");
class Shift extends sequelize_1.Model {
}
exports.Shift = Shift;
const ShiftModel = (sequelize) => {
    const Shift = sequelize.define("Shift", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        shiftName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        shiftCode: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        startTime: {
            type: sequelize_1.DataTypes.TIME, // better than string
            allowNull: false,
        },
        endTime: {
            type: sequelize_1.DataTypes.TIME, // better than string
            allowNull: false,
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
        branchId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
    }, {
        tableName: "shifts",
        timestamps: true,
    });
    return Shift;
};
exports.ShiftModel = ShiftModel;
