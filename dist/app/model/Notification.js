"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const sequelize_1 = require("sequelize");
class Notification extends sequelize_1.Model {
    static initModel(sequelize) {
        Notification.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            receiverId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            senderId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null,
            },
            type: {
                type: sequelize_1.DataTypes.STRING(100),
                allowNull: false,
                defaultValue: "system",
            },
            title: {
                type: sequelize_1.DataTypes.STRING(255),
                allowNull: false,
            },
            body: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false,
            },
            data: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: true,
                defaultValue: null,
            },
            isRead: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false,
            },
        }, {
            sequelize,
            tableName: "notifications",
            modelName: "Notification",
        });
    }
}
exports.Notification = Notification;
