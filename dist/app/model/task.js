"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
const sequelize_1 = require("sequelize");
class Task extends sequelize_1.Model {
    static initModel(sequelize) {
        Task.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            title: {
                type: sequelize_1.DataTypes.STRING(255),
                allowNull: false,
            },
            description: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("todo", "in_progress", "completed", "cancelled"),
                allowNull: false,
                defaultValue: "todo",
            },
            priority: {
                type: sequelize_1.DataTypes.ENUM("low", "medium", "high", "urgent"),
                allowNull: false,
                defaultValue: "medium",
            },
            dueDate: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            assignedTo: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            assignedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            tags: {
                type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
                allowNull: true,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
        }, {
            sequelize,
            tableName: "tasks",
            modelName: "Task",
            timestamps: true,
        });
    }
}
exports.Task = Task;
