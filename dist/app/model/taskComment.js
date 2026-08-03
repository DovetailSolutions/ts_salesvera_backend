"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskComment = void 0;
const sequelize_1 = require("sequelize");
class TaskComment extends sequelize_1.Model {
    static initModel(sequelize) {
        TaskComment.init({
            id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            taskId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            body: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
        }, {
            sequelize,
            tableName: "task_comments",
            modelName: "TaskComment",
            timestamps: true,
        });
    }
}
exports.TaskComment = TaskComment;
