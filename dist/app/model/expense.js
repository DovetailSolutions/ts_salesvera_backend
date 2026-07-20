"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const sequelize_1 = require("sequelize");
class Expense extends sequelize_1.Model {
    static initModel(sequelize) {
        Expense.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false
            },
            approvedByAdmin: {
                type: sequelize_1.DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
                defaultValue: "pending"
            },
            approvedBySuperAdmin: {
                type: sequelize_1.DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
                defaultValue: "pending"
            },
            title: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            total_amount: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            date: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            category: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            amount: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            description: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true
            },
            location: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            }
        }, {
            sequelize,
            tableName: "expenses",
            modelName: "Expense",
            timestamps: true
        });
    }
}
exports.Expense = Expense;
