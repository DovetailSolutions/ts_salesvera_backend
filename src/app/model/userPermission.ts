import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// UserPermissions Table
// Single source of truth for all user permissions.
// Each row = one permission granted to one user within one company.
//
// Hierarchy enforcement (in controller, not DB):
//   super_admin -> admin
//   admin       -> manager     (same companyId)
//   manager     -> sale_person (same companyId)
//
// grantedBy = userId of the person who assigned this permission
// ============================================================

export interface UserPermissionAttributes {
  id: number;
  userId: number;
  permissionId: number;
  companyId: number;
  grantedBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserPermissionCreationAttributes = Optional<UserPermissionAttributes, "id">;

export class UserPermission
  extends Model<UserPermissionAttributes, UserPermissionCreationAttributes>
  implements UserPermissionAttributes
{
  public id!: number;
  public userId!: number;
  public permissionId!: number;
  public companyId!: number;
  public grantedBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const UserPermissionModel = (sequelize: Sequelize) => {
  UserPermission.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "The user who receives this permission",
      },
      permissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "FK to permissions.id",
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "Company scope — permission only valid within this company",
      },
      grantedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "FK to users.id — the person who assigned this permission",
      },
    },
    {
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
    }
  );

  return UserPermission;
};
