import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// Web login refresh sessions — one row per issued refresh token (rotated on
// every use, see refreshSession.service.ts). The RAW token is never stored,
// only a SHA-256 hash of it, so a database read alone can't be used to
// impersonate a session. Deliberately a separate table from the legacy
// users.refreshToken column (a single plaintext slot, no revocation
// history, no rotation, no per-device tracking) rather than repurposing it
// — that column keeps being used, unmodified, by the mobile /api/login
// flow this rollout intentionally leaves alone.
// ============================================================

export interface RefreshSessionAttributes {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type RefreshSessionCreationAttributes = Optional<
  RefreshSessionAttributes,
  "id" | "revokedAt" | "deviceId" | "userAgent" | "ipAddress" | "lastUsedAt"
>;

export class RefreshSession
  extends Model<RefreshSessionAttributes, RefreshSessionCreationAttributes>
  implements RefreshSessionAttributes
{
  public id!: number;
  public userId!: number;
  public tokenHash!: string;
  public expiresAt!: Date;
  public revokedAt!: Date | null;
  public deviceId!: string | null;
  public userAgent!: string | null;
  public ipAddress!: string | null;
  public lastUsedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof RefreshSession {
    RefreshSession.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        tokenHash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        revokedAt: { type: DataTypes.DATE, allowNull: true },
        deviceId: { type: DataTypes.STRING, allowNull: true },
        userAgent: { type: DataTypes.TEXT, allowNull: true },
        ipAddress: { type: DataTypes.STRING, allowNull: true },
        lastUsedAt: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        tableName: "refresh_sessions",
        timestamps: true,
        indexes: [
          { fields: ["userId"], name: "idx_refresh_sessions_user" },
          { fields: ["expiresAt"], name: "idx_refresh_sessions_expires" },
        ],
      }
    );

    return RefreshSession;
  }
}
