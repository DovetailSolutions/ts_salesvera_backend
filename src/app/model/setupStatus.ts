import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// Setup Tracking — override state for the tenant hierarchy's onboarding
// checklist (SUPER ADMIN -> USER -> ADMIN -> COMPANY -> MANAGER/SALE PERSON).
//
// The checklist itself (has an admin? has a company? has a manager? has
// travel/geo-fencing/attendance-security configured?) is fully derivable at
// read time from existing tables (users/companies/company_managers/
// branches/shifts/departments/user_geo_fencing) — see
// modules/setupTracking/setupTracking.service.ts's compute*Checklist
// functions. Storing that here too would create a second source of truth
// that silently drifts from the real data.
//
// What CAN'T be derived is an explicit human decision ("mark complete even
// though optional items are pending", "skip this for now") plus who made it
// and when — that's the only thing persisted here. Effective status is
// always `overrideStatus ?? computedStatus`.
//
// One row per tenant-root user (tenant_setup_status) and one row per
// company (company_setup_status) — a company is the unit most of the
// checklist actually applies to, while the tenant-level row tracks the
// "has this User even got an Admin/Company yet" step that precedes any
// company existing at all.
// ============================================================

export type SetupOverrideStatus = "completed" | "skipped" | "blocked";

interface TenantSetupStatusAttributes {
  id: number;
  userId: number;
  overrideStatus: SetupOverrideStatus | null;
  completedBy: number | null;
  completedAt: Date | null;
  skippedBy: number | null;
  skippedAt: Date | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TenantSetupStatusCreationAttributes = Optional<
  TenantSetupStatusAttributes,
  "id" | "overrideStatus" | "completedBy" | "completedAt" | "skippedBy" | "skippedAt" | "notes"
>;

export class TenantSetupStatus
  extends Model<TenantSetupStatusAttributes, TenantSetupStatusCreationAttributes>
  implements TenantSetupStatusAttributes
{
  public id!: number;
  public userId!: number;
  public overrideStatus!: SetupOverrideStatus | null;
  public completedBy!: number | null;
  public completedAt!: Date | null;
  public skippedBy!: number | null;
  public skippedAt!: Date | null;
  public notes!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof TenantSetupStatus {
    TenantSetupStatus.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        overrideStatus: {
          type: DataTypes.ENUM("completed", "skipped", "blocked"),
          allowNull: true,
          defaultValue: null,
        },
        completedBy: { type: DataTypes.INTEGER, allowNull: true },
        completedAt: { type: DataTypes.DATE, allowNull: true },
        skippedBy: { type: DataTypes.INTEGER, allowNull: true },
        skippedAt: { type: DataTypes.DATE, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: "tenant_setup_status",
        timestamps: true,
        indexes: [{ unique: true, fields: ["userId"], name: "idx_tenant_setup_status_user_unique" }],
      }
    );
    return TenantSetupStatus;
  }
}

interface CompanySetupStatusAttributes {
  id: number;
  companyId: number;
  overrideStatus: SetupOverrideStatus | null;
  completedBy: number | null;
  completedAt: Date | null;
  skippedBy: number | null;
  skippedAt: Date | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type CompanySetupStatusCreationAttributes = Optional<
  CompanySetupStatusAttributes,
  "id" | "overrideStatus" | "completedBy" | "completedAt" | "skippedBy" | "skippedAt" | "notes"
>;

export class CompanySetupStatus
  extends Model<CompanySetupStatusAttributes, CompanySetupStatusCreationAttributes>
  implements CompanySetupStatusAttributes
{
  public id!: number;
  public companyId!: number;
  public overrideStatus!: SetupOverrideStatus | null;
  public completedBy!: number | null;
  public completedAt!: Date | null;
  public skippedBy!: number | null;
  public skippedAt!: Date | null;
  public notes!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof CompanySetupStatus {
    CompanySetupStatus.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        companyId: { type: DataTypes.INTEGER, allowNull: false },
        overrideStatus: {
          type: DataTypes.ENUM("completed", "skipped", "blocked"),
          allowNull: true,
          defaultValue: null,
        },
        completedBy: { type: DataTypes.INTEGER, allowNull: true },
        completedAt: { type: DataTypes.DATE, allowNull: true },
        skippedBy: { type: DataTypes.INTEGER, allowNull: true },
        skippedAt: { type: DataTypes.DATE, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: "company_setup_status",
        timestamps: true,
        indexes: [{ unique: true, fields: ["companyId"], name: "idx_company_setup_status_company_unique" }],
      }
    );
    return CompanySetupStatus;
  }
}
