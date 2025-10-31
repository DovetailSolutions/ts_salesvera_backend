"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceModel = exports.Device = void 0;
const sequelize_1 = require("sequelize");
class Device extends sequelize_1.Model {
}
exports.Device = Device;
const DeviceModel = (sequelize) => {
    Device.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
        },
        deviceToken: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            // unique: true,
        },
        devicemodel: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        devicename: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        deviceType: {
            type: sequelize_1.DataTypes.ENUM("android", "ios", "web"),
            defaultValue: "android",
        },
        isActive: {
            type: sequelize_1.DataTypes.BOOLEAN,
            defaultValue: true,
        },
        deviceId: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: "Device",
        tableName: "devices",
    });
    return Device;
};
exports.DeviceModel = DeviceModel;
