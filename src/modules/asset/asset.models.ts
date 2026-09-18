import { DataTypes, Model } from "sequelize";
import { sequelize, User } from "../../config/dbConnection";

// ============================================================
// Asset Management models. Initialized and associated here, inside the
// module, rather than in config/dbConnection.ts — the module is fully
// self-contained and the shared connection file is left untouched. Tables
// are created by migration 0030_asset_management.ts (the app never runs
// sequelize.sync), so these definitions only describe existing columns.
// ============================================================

export class AssetCategory extends Model {
  public id!: number;
  public companyId!: number | null;
  public name!: string;
  public isActive!: boolean;
  public createdBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AssetCategory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "asset_categories", modelName: "AssetCategory", timestamps: true }
);

export class Asset extends Model {
  public id!: number;
  public assetCode!: string;
  public companyId!: number;
  public categoryId!: number;
  public name!: string;
  public brand!: string | null;
  public model!: string | null;
  public serialNumber!: string | null;
  public purchaseDate!: string | null;
  public purchasePrice!: string | null;
  public status!: string;
  public condition!: string;
  public description!: string | null;
  public createdBy!: number | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Asset.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    assetCode: { type: DataTypes.STRING(20), allowNull: false },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    brand: { type: DataTypes.STRING(100), allowNull: true },
    model: { type: DataTypes.STRING(100), allowNull: true },
    serialNumber: { type: DataTypes.STRING(100), allowNull: true },
    purchaseDate: { type: DataTypes.DATEONLY, allowNull: true },
    purchasePrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "AVAILABLE" },
    condition: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "GOOD" },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "assets", modelName: "Asset", timestamps: true }
);

export class AssetAssignment extends Model {
  public id!: number;
  public assetId!: number;
  public companyId!: number;
  public assignedToId!: number;
  public assignedBy!: number | null;
  public assignedAt!: Date;
  public returnedAt!: Date | null;
  public returnedBy!: number | null;
  public status!: "ACTIVE" | "RETURNED";
  public conditionAtAssignment!: string | null;
  public conditionAtReturn!: string | null;
  public remarks!: string | null;
  public returnRemarks!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AssetAssignment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    assetId: { type: DataTypes.INTEGER, allowNull: false },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    assignedToId: { type: DataTypes.INTEGER, allowNull: false },
    assignedBy: { type: DataTypes.INTEGER, allowNull: true },
    assignedAt: { type: DataTypes.DATE, allowNull: false },
    returnedAt: { type: DataTypes.DATE, allowNull: true },
    returnedBy: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE" },
    conditionAtAssignment: { type: DataTypes.STRING(20), allowNull: true },
    conditionAtReturn: { type: DataTypes.STRING(20), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    returnRemarks: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: "asset_assignments", modelName: "AssetAssignment", timestamps: true }
);

export class AssetAuditLog extends Model {
  public id!: number;
  public companyId!: number;
  public assetId!: number | null;
  public action!: string;
  public actorId!: number | null;
  public actorRole!: string | null;
  public targetUserId!: number | null;
  public detail!: Record<string, any> | null;
  public readonly createdAt!: Date;
}

AssetAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    assetId: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING(30), allowNull: false },
    actorId: { type: DataTypes.INTEGER, allowNull: true },
    actorRole: { type: DataTypes.STRING(20), allowNull: true },
    targetUserId: { type: DataTypes.INTEGER, allowNull: true },
    detail: { type: DataTypes.JSONB, allowNull: true },
  },
  { sequelize, tableName: "asset_audit_log", modelName: "AssetAuditLog", timestamps: true }
);

// ── Associations (asset-side only; nothing is added to existing models'
// behavior beyond these new, differently-aliased links) ──────────────────
Asset.belongsTo(AssetCategory, { foreignKey: "categoryId", as: "category" });
AssetCategory.hasMany(Asset, { foreignKey: "categoryId", as: "assets" });

Asset.hasMany(AssetAssignment, { foreignKey: "assetId", as: "assignments" });
// Filtered association for the one ACTIVE assignment — used by list/detail
// queries so the current holder comes back in the same query (no N+1).
Asset.hasOne(AssetAssignment, { foreignKey: "assetId", as: "activeAssignment", scope: { status: "ACTIVE" } });
AssetAssignment.belongsTo(Asset, { foreignKey: "assetId", as: "asset" });

Asset.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
Asset.belongsTo(User, { foreignKey: "updatedBy", as: "updater" });

AssetAssignment.belongsTo(User, { foreignKey: "assignedToId", as: "assignedTo" });
AssetAssignment.belongsTo(User, { foreignKey: "assignedBy", as: "assigner" });
AssetAssignment.belongsTo(User, { foreignKey: "returnedBy", as: "returner" });

// Only safe, non-sensitive user columns are ever selected through these
// associations (never password/refreshToken/otp).
export const SAFE_USER_ATTRIBUTES = ["id", "firstName", "lastName", "email", "employeeCode", "role"];
