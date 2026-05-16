import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// Permissions Master Table
// Stores every module+action combination available in the system.
// Pre-seeded at startup — add new entries here when adding modules.
// ============================================================

export interface PermissionAttributes {
  id: number;
  module: string;   // e.g. 'attendance', 'expense', 'chat'
  action: string;   // e.g. 'view', 'create', 'approve'
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type PermissionCreationAttributes = Optional<PermissionAttributes, "id" | "description">;

export class Permission
  extends Model<PermissionAttributes, PermissionCreationAttributes>
  implements PermissionAttributes
{
  public id!: number;
  public module!: string;
  public action!: string;
  public description!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const PermissionModel = (sequelize: Sequelize) => {
  Permission.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      module: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "Module name: attendance, expense, chat, leave, meeting, etc.",
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "Action name: view, create, update, delete, approve, reject, etc.",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Human-readable description shown on permission management page",
      },
    },
    {
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
    }
  );

  return Permission;
};
