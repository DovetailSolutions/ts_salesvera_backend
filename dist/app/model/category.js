"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryModel = exports.Category = void 0;
const sequelize_1 = require("sequelize");
class Category extends sequelize_1.Model {
}
exports.Category = Category;
const CategoryModel = (sequelize) => {
    const Category = sequelize.define("Category", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        category_name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
    }, {
        tableName: "categories",
        timestamps: true,
    });
    return Category;
};
exports.CategoryModel = CategoryModel;
