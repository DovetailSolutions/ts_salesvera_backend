"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyManagerModel = exports.CompanyManager = void 0;
const sequelize_1 = require("sequelize");
class CompanyManager extends sequelize_1.Model {
}
exports.CompanyManager = CompanyManager;
const CompanyManagerModel = (sequelize) => {
    CompanyManager.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        companyId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
        managerId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    }, {
        sequelize,
        tableName: "company_managers",
        timestamps: true,
        indexes: [{ unique: true, fields: ["companyId", "managerId"] }],
    });
    return CompanyManager;
};
exports.CompanyManagerModel = CompanyManagerModel;
