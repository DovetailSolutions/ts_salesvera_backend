"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModel = exports.Company = void 0;
const sequelize_1 = require("sequelize");
class Company extends sequelize_1.Model {
}
exports.Company = Company;
const CompanyModel = (sequelize) => {
    Company.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        companyName: sequelize_1.DataTypes.STRING,
        meetingUserId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        personName: sequelize_1.DataTypes.STRING,
        mobileNumber: sequelize_1.DataTypes.STRING,
        companyEmail: sequelize_1.DataTypes.STRING,
        customerType: {
            type: sequelize_1.DataTypes.ENUM("new", "existing", "followup"),
            defaultValue: "new",
        },
        remarks: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: "companies",
        timestamps: true,
    });
    return Company;
};
exports.CompanyModel = CompanyModel;
