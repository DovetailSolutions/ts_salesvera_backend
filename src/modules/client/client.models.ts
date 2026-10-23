import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config/dbConnection";

// ============================================================
// client_assignment_log — append-only history of every change to a client's
// owner (meeting_users.user_id) made through Client Assignment: assign,
// reassign, revoke, and the departure transfer. Created by migration
// 0036_client_assignment_log. Rows are only ever inserted, never updated.
// ============================================================

export type ClientAssignmentAction = "assign" | "reassign" | "revoke" | "transfer";

export class ClientAssignmentLog extends Model {
  public id!: number;
  public companyId!: number;
  public clientId!: number;
  public action!: ClientAssignmentAction;
  public previousUserId!: number | null;
  public newUserId!: number | null;
  public actorId!: number | null;
  public actorRole!: string | null;
  public requestKey!: string | null;
  public reason!: string | null;
  public readonly createdAt!: Date;
}

ClientAssignmentLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    clientId: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(20), allowNull: false },
    previousUserId: { type: DataTypes.INTEGER, allowNull: true },
    newUserId: { type: DataTypes.INTEGER, allowNull: true },
    actorId: { type: DataTypes.INTEGER, allowNull: true },
    actorRole: { type: DataTypes.STRING(20), allowNull: true },
    requestKey: { type: DataTypes.STRING(64), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: "client_assignment_log", modelName: "ClientAssignmentLog", timestamps: true }
);

export const SAFE_USER_ATTRIBUTES = ["id", "firstName", "lastName", "email", "employeeCode", "role", "status"];
