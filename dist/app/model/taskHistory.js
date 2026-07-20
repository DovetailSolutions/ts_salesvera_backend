"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskHistory = void 0;
const sequelize_1 = require("sequelize");
class TaskHistory extends sequelize_1.Model {
    static initModel(sequelize) {
        TaskHistory.init({
            id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            taskId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            changedBy: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            field: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
            oldValue: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
            newValue: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
        }, {
            sequelize,
            tableName: "task_history",
            modelName: "TaskHistory",
            timestamps: true,
        });
    }
}
exports.TaskHistory = TaskHistory;
