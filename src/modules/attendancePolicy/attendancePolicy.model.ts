import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config/dbConnection";

// attendance_policies (migration 0035). Append-only: saving a policy inserts a
// new version row instead of editing one, so the history of which rule
// applied from which date is kept.
export class AttendancePolicy extends Model {
  public id!: number;
  public companyId!: number;
  public shiftId!: number | null;
  public mode!: "strict" | "flexible";
  public effectiveFrom!: string;
  public config!: any;
  public createdBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendancePolicy.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    shiftId: { type: DataTypes.INTEGER, allowNull: true },
    mode: { type: DataTypes.STRING(10), allowNull: false },
    effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
    config: { type: DataTypes.JSONB, allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "attendance_policies", modelName: "AttendancePolicy", timestamps: true }
);
