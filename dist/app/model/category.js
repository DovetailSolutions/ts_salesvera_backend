"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryModel = exports.Category = void 0;
const sequelize_1 = require("sequelize");
class Category extends sequelize_1.Model {
    static initModel(sequelize) {
        Category.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            category_name: {
                type: sequelize_1.DataTypes.STRING,
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
            status: {
                type: sequelize_1.DataTypes.ENUM("draft", "sent", "accepted", "imported", "rejected"),
                defaultValue: "draft",
            },
        }, {
            sequelize,
            tableName: "categories",
            timestamps: true,
        });
    }
}
exports.Category = Category;
const CategoryModel = (sequelize) => {
    Category.initModel(sequelize);
    return Category;
};
exports.CategoryModel = CategoryModel;
