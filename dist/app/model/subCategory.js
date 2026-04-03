"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategoryModel = exports.SubCategory = void 0;
const sequelize_1 = require("sequelize");
class SubCategory extends sequelize_1.Model {
}
exports.SubCategory = SubCategory;
const SubCategoryModel = (sequelize) => {
    SubCategory.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        sub_category_name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        CategoryId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
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
        amount: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        text: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        hsnCode: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: "sub_categories",
        timestamps: true,
    });
    return SubCategory;
};
exports.SubCategoryModel = SubCategoryModel;
