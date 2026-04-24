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
            field: "user_id",
        },
        companyId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            field: "company_id",
        },
        meetingUserId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: "meeting_user_id",
        },
        categoryId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: "category_id",
        },
        meetingPurpose: {
            type: sequelize_1.DataTypes.ENUM("demo", "support", "collection", "general", "newlead", "other", "feedback"),
            field: "meeting_purpose",
        },
        status: {
            type: sequelize_1.DataTypes.ENUM("pending", "completed", "cancelled", "in", "out", "scheduled"),
            defaultValue: "pending",
        },
        scheduledTime: {
            type: sequelize_1.DataTypes.DATE,
            field: "scheduled_time",
        },
        meetingTimeIn: {
            type: sequelize_1.DataTypes.DATE,
            field: "meeting_time_in",
        },
        meetingTimeOut: {
            type: sequelize_1.DataTypes.DATE,
            field: "meeting_time_out",
        },
        latitude_in: sequelize_1.DataTypes.STRING,
        longitude_in: sequelize_1.DataTypes.STRING,
        latitude_out: sequelize_1.DataTypes.STRING,
        longitude_out: sequelize_1.DataTypes.STRING,
        totalDistance: {
            type: sequelize_1.DataTypes.STRING,
            field: "total_distance",
        },
        legDistance: {
            type: sequelize_1.DataTypes.STRING,
            field: "leg_distance",
        },
        pincode: sequelize_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: "meetings",
        timestamps: true,
    });
    return Meeting;
};
exports.MeetingModel = MeetingModel;
