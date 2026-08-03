"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyAdminModel = exports.CompanyAdmin = void 0;
const sequelize_1 = require("sequelize");
class CompanyAdmin extends sequelize_1.Model {
}
exports.CompanyAdmin = CompanyAdmin;
const CompanyAdminModel = (sequelize) => {
    CompanyAdmin.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        companyId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
        adminId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    }, {
        sequelize,
        tableName: "company_admins",
        timestamps: true,
        indexes: [{ unique: true, fields: ["companyId", "adminId"] }],
    });
    return CompanyAdmin;
};
exports.CompanyAdminModel = CompanyAdminModel;
