"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const sequelize_1 = require("sequelize");
class Expense extends sequelize_1.Model {
    static initModel(sequelize) {
        Expense.init({
            id: {
                type: sequelize_1.DataTypes.BIGINT,
                autoIncrement: true,
                primaryKey: true,
            },
            userId: {
                type: sequelize_1.DataTypes.BIGINT,
                allowNull: false,
            },
            billImage: {
                type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
                allowNull: false,
                defaultValue: [],
            },
            approvedByAdmin: {
                type: sequelize_1.DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
                defaultValue: "pending",
            },
            approvedBySuperAdmin: {
                type: sequelize_1.DataTypes.ENUM("accepted", "rejected", "not_clear", "pending"),
                defaultValue: "pending",
            },
            title: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
        }, {
            sequelize,
            tableName: "expenses",
            modelName: "Expense",
            timestamps: true,
        });
        return Expense;
    }
}
exports.Expense = Expense;
