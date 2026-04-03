"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModell = exports.Company = void 0;
const sequelize_1 = require("sequelize");
class Company extends sequelize_1.Model {
}
exports.Company = Company;
const CompanyModell = (sequelize) => {
    const Company = sequelize.define("Company", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        companyName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
        legalName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
        registrationNo: { type: sequelize_1.DataTypes.STRING, allowNull: false },
        gst: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        pan: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        industry: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        companySize: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        website: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        companyEmail: { type: sequelize_1.DataTypes.STRING, allowNull: false },
        companyPhone: { type: sequelize_1.DataTypes.STRING, allowNull: false },
        city: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        timezone: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        currency: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        // Bank
        bankAccountHolder: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        bankName: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        bankAccountNumber: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        bankIfsc: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        bankBranchName: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        bankAccountType: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        bankMicr: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        upiId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        // HR Config
        payrollCycle: { type: sequelize_1.DataTypes.STRING, allowNull: true },
        lateMarkAfter: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        autoHalfDayAfter: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        casualHolidaysTotal: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        casualHolidaysPerMonth: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        casualHolidayNotice: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        compOffMinHours: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        compOffExpiryDays: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        casualCarryForwardLimit: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        casualCarryForwardExpiry: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
        userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    }, {
        tableName: "companiess",
        timestamps: true,
    });
    return Company;
};
exports.CompanyModell = CompanyModell;
