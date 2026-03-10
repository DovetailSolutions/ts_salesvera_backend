"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingImageModel = exports.MeetingImage = void 0;
const sequelize_1 = require("sequelize");
class MeetingImage extends sequelize_1.Model {
}
exports.MeetingImage = MeetingImage;
const MeetingImageModel = (sequelize) => {
    MeetingImage.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        meetingId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        meetingUserId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        image: {
            type: sequelize_1.DataTypes.STRING,
        },
    }, {
        sequelize,
        tableName: "meeting_images",
        timestamps: false,
    });
    return MeetingImage;
};
exports.MeetingImageModel = MeetingImageModel;
