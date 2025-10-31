"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attendance = void 0;
const sequelize_1 = require("sequelize");
class Attendance extends sequelize_1.Model {
    static initModel(sequelize) {
        Attendance.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            employee_id: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            date: {
                type: sequelize_1.DataTypes.DATEONLY,
                allowNull: false,
            },
            punch_in: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            punch_out: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            working_hours: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("present", "absent", "leave", "holiday"),
                allowNull: false,
                defaultValue: "present",
            },
            late: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false,
            },
            overtime: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: true,
            },
            latitude_in: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            longitude_in: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            latitude_out: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            longitude_out: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
        }, {
            sequelize,
            tableName: "attendance",
            timestamps: true,
        });
        return Attendance;
    }
}
exports.Attendance = Attendance;
