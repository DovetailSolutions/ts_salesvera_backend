"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoom = void 0;
// models/ChatRoom.ts
const sequelize_1 = require("sequelize");
class ChatRoom extends sequelize_1.Model {
    static initModel(sequelize) {
        ChatRoom.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            roomId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            type: {
                type: sequelize_1.DataTypes.ENUM("private", "group"),
                allowNull: false,
            },
        }, {
            sequelize,
            tableName: "chat_rooms",
            modelName: "ChatRoom",
        });
    }
}
exports.ChatRoom = ChatRoom;
