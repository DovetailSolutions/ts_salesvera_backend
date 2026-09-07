import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// Append-only audit trail for the Setup Tracking feature — every
// created/skipped/completed/reopened event on a tenant or a company's
// onboarding, who did it, and with what detail. See setupStatus.ts for why
// this is separate from the checklist itself (which is computed live).
// ============================================================

export type SetupEntityType = "tenant" | "company";
export type SetupAuditAction = "created" | "skipped" | "completed" | "reopened" | "item_added";

interface SetupAuditLogAttributes {
  id: number;
  entityType: SetupEntityType;
  entityId: number;
  action: SetupAuditAction;
  actorId: number | null;
  actorRole: string | null;
  detail: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type SetupAuditLogCreationAttributes = Optional<SetupAuditLogAttributes, "id" | "actorId" | "actorRole" | "detail">;

export class SetupAuditLog
  extends Model<SetupAuditLogAttributes, SetupAuditLogCreationAttributes>
  implements SetupAuditLogAttributes
{
  public id!: number;
  public entityType!: SetupEntityType;
  public entityId!: number;
  public action!: SetupAuditAction;
  public actorId!: number | null;
  public actorRole!: string | null;
  public detail!: Record<string, any> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof SetupAuditLog {
    SetupAuditLog.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        entityType: { type: DataTypes.ENUM("tenant", "company"), allowNull: false },
        entityId: { type: DataTypes.INTEGER, allowNull: false },
        action: {
          type: DataTypes.ENUM("created", "skipped", "completed", "reopened", "item_added"),
          allowNull: false,
        },
        actorId: { type: DataTypes.INTEGER, allowNull: true },
        actorRole: { type: DataTypes.STRING(20), allowNull: true },
        detail: { type: DataTypes.JSONB, allowNull: true },
      },
      {
        sequelize,
        tableName: "setup_audit_log",
        timestamps: true,
        indexes: [
          { fields: ["entityType", "entityId", "createdAt"], name: "idx_setup_audit_entity" },
        ],
      }
    );
    return SetupAuditLog;
  }
}
