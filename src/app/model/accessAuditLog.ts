import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// access_audit_log — append-only trail of Super-Admin-level access/
// subscription changes (limit edits, expiry edits, suspend/reactivate,
// extension approve/reject). Same shape as setup_audit_log
// (app/model/setupAuditLog.ts: entityType/entityId/action/actor/detail) —
// reused deliberately instead of inventing a second audit-log shape.
// Plain STRING (not a Postgres ENUM) for entityType/action, matching
// Subscription.status's own convention, so new action types never need a
// schema migration to add.
//
// Never stores passwords/refreshTokens/OTPs — previousValue/newValue are
// caller-supplied snapshots of ONLY the access/limit/expiry fields being
// changed (see modules/accessExtension/ and superAdminAccess.service.ts),
// never a raw user/subscription row.
// ============================================================

export type AccessAuditEntityType = "subscription" | "extension_request";

export interface AccessAuditLogAttributes {
  id: number;
  entityType: AccessAuditEntityType;
  entityId: number;
  action: string;
  actorId: number | null;
  actorRole: string | null;
  previousValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  reason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AccessAuditLogCreationAttributes = Optional<
  AccessAuditLogAttributes,
  "id" | "actorId" | "actorRole" | "previousValue" | "newValue" | "reason"
>;

export class AccessAuditLog
  extends Model<AccessAuditLogAttributes, AccessAuditLogCreationAttributes>
  implements AccessAuditLogAttributes
{
  public id!: number;
  public entityType!: AccessAuditEntityType;
  public entityId!: number;
  public action!: string;
  public actorId!: number | null;
  public actorRole!: string | null;
  public previousValue!: Record<string, any> | null;
  public newValue!: Record<string, any> | null;
  public reason!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof AccessAuditLog {
    AccessAuditLog.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        entityType: { type: DataTypes.STRING(30), allowNull: false },
        entityId: { type: DataTypes.INTEGER, allowNull: false },
        action: { type: DataTypes.STRING(40), allowNull: false },
        actorId: { type: DataTypes.INTEGER, allowNull: true },
        actorRole: { type: DataTypes.STRING(20), allowNull: true },
        previousValue: { type: DataTypes.JSONB, allowNull: true },
        newValue: { type: DataTypes.JSONB, allowNull: true },
        reason: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: "access_audit_log",
        timestamps: true,
        indexes: [{ fields: ["entityType", "entityId", "createdAt"], name: "idx_access_audit_entity" }],
      }
    );
    return AccessAuditLog;
  }
}
