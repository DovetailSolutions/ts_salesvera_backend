"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseImage = void 0;
const sequelize_1 = require("sequelize");
class ExpenseImage extends sequelize_1.Model {
    static initModel(sequelize) {
        ExpenseImage.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            expenseId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false
            },
            imageUrl: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            }
        }, {
            sequelize,
            tableName: "expense_images",
            timestamps: true
        });
    }
}
exports.ExpenseImage = ExpenseImage;
