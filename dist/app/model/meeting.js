"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingTypeModel = exports.Meeting = void 0;
const sequelize_1 = require("sequelize");
class Meeting extends sequelize_1.Model {
}
exports.Meeting = Meeting;
const MeetingTypeModel = (sequelize) => {
    Meeting.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        image: {
            type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
            allowNull: true,
        },
        companyName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        personName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        mobileNumber: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        companyEmail: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        customerType: {
            type: sequelize_1.DataTypes.ENUM("new", "existing", "followup"),
            defaultValue: "new",
        },
        meetingPurpose: {
            type: sequelize_1.DataTypes.ENUM("demo", "support", "collection", "general", "newlead", "other", "feedback"),
            allowNull: true,
        },
        categoryId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        remarks: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
        },
        status: {
            type: sequelize_1.DataTypes.ENUM("pending", "completed", "cancelled", "in", "out", "scheduled"),
            defaultValue: "pending",
        },
        scheduledTime: {
            type: sequelize_1.DataTypes.DATE,
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
        meetingTimeIn: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        meetingTimeOut: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
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
    }, {
        tableName: "meeting",
        sequelize,
        timestamps: true,
    });
    return Meeting;
};
exports.MeetingTypeModel = MeetingTypeModel;
