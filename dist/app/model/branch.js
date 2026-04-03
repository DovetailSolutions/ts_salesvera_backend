"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchModel = exports.Branch = void 0;
const sequelize_1 = require("sequelize");
class Branch extends sequelize_1.Model {
}
exports.Branch = Branch;
const BranchModel = (sequelize) => {
    const Branch = sequelize.define("Branch", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        branchName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        branchCode: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        branchCity: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        branchState: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        branchCountry: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        postalCode: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        addressLine1: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        addressLine2: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        branchEmail: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            validate: {
                isEmail: true,
            },
        },
        branchPhone: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        latitude: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
        },
        longitude: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
        },
        geoRadius: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
        },
        adminId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        managerId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
    }, {
        tableName: "branches",
        timestamps: true,
    });
    return Branch;
};
exports.BranchModel = BranchModel;
