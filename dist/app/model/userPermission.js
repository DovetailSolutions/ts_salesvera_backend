"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissionModel = exports.UserPermission = void 0;
const sequelize_1 = require("sequelize");
class UserPermission extends sequelize_1.Model {
}
exports.UserPermission = UserPermission;
const UserPermissionModel = (sequelize) => {
    UserPermission.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            comment: "The user who receives this permission",
        },
        permissionId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            comment: "FK to permissions.id",
        },
        companyId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            comment: "Company scope — permission only valid within this company",
        },
        grantedBy: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            comment: "FK to users.id — the person who assigned this permission",
        },
    }, {
        sequelize,
        tableName: "user_permissions",
        timestamps: true,
        indexes: [
            {
                // Primary lookup: get all permissions for a user in a company
                fields: ["userId", "companyId"],
                name: "idx_user_permissions_user_company",
            },
            {
                // Prevent duplicate permission grants
                unique: true,
                fields: ["userId", "permissionId", "companyId"],
                name: "idx_user_perm_unique",
            },
            {
                // Audit: who granted what
                fields: ["grantedBy"],
                name: "idx_user_permissions_granted_by",
            },
        ],
    });
    return UserPermission;
};
exports.UserPermissionModel = UserPermissionModel;
