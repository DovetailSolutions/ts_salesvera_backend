"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Leave = void 0;
const sequelize_1 = require("sequelize");
class Leave extends sequelize_1.Model {
    static initModel(sequelize) {
        Leave.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            employee_id: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            from_date: {
                type: sequelize_1.DataTypes.DATEONLY,
                allowNull: false,
            },
            to_date: {
                type: sequelize_1.DataTypes.DATEONLY,
                allowNull: false,
            },
            reason: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("pending", "approved", "rejected"),
                allowNull: false,
                defaultValue: "pending",
            },
        }, {
            sequelize,
            tableName: "leave_requests",
            timestamps: true,
        });
        return Leave;
    }
}
exports.Leave = Leave;
