import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// user_vehicle_allowance_rates — per-user ₹/km override, one row per user
// (unique userId). See migration 0024. Presence of a row IS the override
// (including ratePerKm = 0, e.g. a user who gets no travel allowance) —
// absence means "use the company rate" (company_vehicle_allowance_rates /
// modules/company/company.service.ts's findEffectiveVehicleAllowanceRateForDate,
// which checks this table first).
// ============================================================

export interface UserVehicleAllowanceRateAttributes {
  id: number;
  userId: number;
  companyId?: number | null;
  ratePerKm: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserVehicleAllowanceRateCreationAttributes = Optional<
  UserVehicleAllowanceRateAttributes,
  "id" | "companyId" | "createdBy" | "updatedBy"
>;

export class UserVehicleAllowanceRate
  extends Model<UserVehicleAllowanceRateAttributes, UserVehicleAllowanceRateCreationAttributes>
  implements UserVehicleAllowanceRateAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number | null;
  public ratePerKm!: number;
  public createdBy!: number | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof UserVehicleAllowanceRate {
    UserVehicleAllowanceRate.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        ratePerKm: {
          type: DataTypes.DOUBLE,
          allowNull: false,
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        updatedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "user_vehicle_allowance_rates",
        timestamps: true,
        indexes: [{ unique: true, fields: ["userId"], name: "idx_uvar_user_unique" }],
      }
    );

    return UserVehicleAllowanceRate;
  }
}
