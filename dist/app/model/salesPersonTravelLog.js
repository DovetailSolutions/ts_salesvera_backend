"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesPersonTravelLog = void 0;
const sequelize_1 = require("sequelize");
class SalesPersonTravelLog extends sequelize_1.Model {
    static initModel(sequelize) {
        SalesPersonTravelLog.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            attendanceId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            fromType: {
                type: sequelize_1.DataTypes.STRING(30),
                allowNull: false,
            },
            fromId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            fromLatitude: {
                type: sequelize_1.DataTypes.STRING(50),
                allowNull: false,
            },
            fromLongitude: {
                type: sequelize_1.DataTypes.STRING(50),
                allowNull: false,
            },
            fromTimestamp: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            toType: {
                type: sequelize_1.DataTypes.STRING(30),
                allowNull: false,
            },
            toId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            toLatitude: {
                type: sequelize_1.DataTypes.STRING(50),
                allowNull: false,
            },
            toLongitude: {
                type: sequelize_1.DataTypes.STRING(50),
                allowNull: false,
            },
            toTimestamp: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            distanceMeters: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: false,
                defaultValue: 0,
            },
            distanceKm: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: false,
                defaultValue: 0,
            },
            travelDuration: {
                type: sequelize_1.DataTypes.STRING(50),
                allowNull: true,
            },
        }, {
            sequelize,
            tableName: "sales_person_travel_logs",
            timestamps: true,
        });
        return SalesPersonTravelLog;
    }
}
exports.SalesPersonTravelLog = SalesPersonTravelLog;
