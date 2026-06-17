"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionModel = exports.Permission = void 0;
const sequelize_1 = require("sequelize");
class Permission extends sequelize_1.Model {
}
exports.Permission = Permission;
const PermissionModel = (sequelize) => {
    Permission.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        module: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
            comment: "Module name: attendance, expense, chat, leave, meeting, etc.",
        },
        action: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
            comment: "Action name: view, create, update, delete, approve, reject, etc.",
        },
        description: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: "Human-readable description shown on permission management page",
        },
    }, {
        sequelize,
        tableName: "permissions",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["module", "action"],
                name: "idx_permissions_module_action",
            },
            {
                fields: ["module"],
                name: "idx_permissions_module",
            },
        ],
    });
    return Permission;
};
exports.PermissionModel = PermissionModel;
