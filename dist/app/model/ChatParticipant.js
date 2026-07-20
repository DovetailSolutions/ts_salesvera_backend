"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatParticipant = void 0;
const sequelize_1 = require("sequelize");
class ChatParticipant extends sequelize_1.Model {
    static initModel(sequelize) {
        ChatParticipant.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            chatRoomId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            role: {
                type: sequelize_1.DataTypes.ENUM("member", "admin"),
                defaultValue: "member",
            },
        }, {
            sequelize,
            tableName: "chat_participants",
            modelName: "ChatParticipant",
        });
    }
}
exports.ChatParticipant = ChatParticipant;
