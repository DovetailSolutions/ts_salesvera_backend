import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// company_vehicle_allowance_rates — effective-dated ₹/km rate history, one
// row per (companyId, effectiveFrom). See migration
// 0023_company_vehicle_allowance_rate_history.ts for why this exists:
// Company.vehicleAllowanceRatePerKm alone can't answer "what rate applied
// on this specific past travel date" once the rate has changed more than
// once. Looked up via companyVehicleAllowanceRate.service.ts's
// findEffectiveRate(companyId, date) — never queried ad hoc elsewhere.
// ============================================================

export interface CompanyVehicleAllowanceRateAttributes {
  id: number;
  companyId: number;
  ratePerKm: number;
  effectiveFrom: string; // DATEONLY — "YYYY-MM-DD"
  createdBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type CompanyVehicleAllowanceRateCreationAttributes = Optional<
  CompanyVehicleAllowanceRateAttributes,
  "id" | "createdBy"
>;

export class CompanyVehicleAllowanceRate
  extends Model<CompanyVehicleAllowanceRateAttributes, CompanyVehicleAllowanceRateCreationAttributes>
  implements CompanyVehicleAllowanceRateAttributes
{
  public id!: number;
  public companyId!: number;
  public ratePerKm!: number;
  public effectiveFrom!: string;
  public createdBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof CompanyVehicleAllowanceRate {
    CompanyVehicleAllowanceRate.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        ratePerKm: {
          type: DataTypes.DOUBLE,
          allowNull: false,
        },
        effectiveFrom: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "company_vehicle_allowance_rates",
        timestamps: true,
        indexes: [
          { fields: ["companyId", "effectiveFrom"], unique: true, name: "idx_cvar_company_effective_unique" },
        ],
      }
    );

    return CompanyVehicleAllowanceRate;
  }
}
