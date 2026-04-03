"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingModel = exports.Meeting = void 0;
const sequelize_1 = require("sequelize");
class Meeting extends sequelize_1.Model {
}
exports.Meeting = Meeting;
const MeetingModel = (sequelize) => {
    Meeting.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        companyId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        meetingUserId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        categoryId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        meetingPurpose: {
            type: sequelize_1.DataTypes.ENUM("demo", "support", "collection", "general", "newlead", "other", "feedback"),
        },
        status: {
            type: sequelize_1.DataTypes.ENUM("pending", "completed", "cancelled", "in", "out", "scheduled"),
            defaultValue: "pending",
        },
        scheduledTime: sequelize_1.DataTypes.DATE,
        meetingTimeIn: sequelize_1.DataTypes.DATE,
        meetingTimeOut: sequelize_1.DataTypes.DATE,
        latitude_in: sequelize_1.DataTypes.STRING,
        longitude_in: sequelize_1.DataTypes.STRING,
        latitude_out: sequelize_1.DataTypes.STRING,
        longitude_out: sequelize_1.DataTypes.STRING,
        totalDistance: sequelize_1.DataTypes.STRING,
        legDistance: sequelize_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: "meetings",
        timestamps: true,
    });
    return Meeting;
};
exports.MeetingModel = MeetingModel;
