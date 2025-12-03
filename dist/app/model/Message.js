"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const sequelize_1 = require("sequelize");
class Message extends sequelize_1.Model {
    static initModel(sequelize) {
        Message.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            chatRoomId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            senderId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            message: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            mediaUrl: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            mediaType: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            replyTo: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("seen", "unseen"),
                defaultValue: "unseen",
            },
        }, {
            sequelize,
            tableName: "messages",
            modelName: "Message",
        });
    }
}
exports.Message = Message;
