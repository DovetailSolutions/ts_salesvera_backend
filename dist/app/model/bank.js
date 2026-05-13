"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyBankModel = exports.CompanyBank = void 0;
const sequelize_1 = require("sequelize");
class CompanyBank extends sequelize_1.Model {
}
exports.CompanyBank = CompanyBank;
const CompanyBankModel = (sequelize) => {
    CompanyBank.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        companyId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        // ✅ NEW FIELD
        branchId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        bankAccountHolder: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        bankName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        bankAccountNumber: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        bankIfsc: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        bankBranchName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        bankAccountType: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        bankMicr: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        upiId: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: "company_banks",
        timestamps: true,
    });
    return CompanyBank;
};
exports.CompanyBankModel = CompanyBankModel;
