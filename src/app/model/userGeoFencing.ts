import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// user_geo_fencing — per-user attendance geo-fence configuration.
// One row per user (unique userId). Applies ONLY to that user's own
// attendance punch-in/punch-out — never a general app-access restriction.
//
// The `enabled` flag does double duty by design, mirroring the single
// "Enable Geo-Fencing" toggle in the product spec:
//   - on an admin's own row       -> also the parent/child capability gate
//                                    ("has super_admin allowed this admin
//                                    to configure geo-fencing for their
//                                    manager/sale_person team")
//   - on a manager/sale_person row -> just whether their own punches are
//                                     geo-fence-checked
// Kept as one flag rather than two, to avoid a second, easily-drifting
// permission system living alongside the existing RBAC one.
//
// Hierarchy enforcement (service layer, not DB):
//   super_admin -> admin
//   admin       -> manager, sale_person   (same companyId, and only when
//                                          the admin's OWN row is enabled)
// ============================================================

export interface UserGeoFencingAttributes {
  id: number;
  userId: number;
  companyId?: number | null;
  enabled: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
  radiusUnit: "m" | "km";
  locationName?: string | null;
  landmark?: string | null;
  address?: string | null;
  city?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserGeoFencingCreationAttributes = Optional<
  UserGeoFencingAttributes,
  "id" | "companyId" | "latitude" | "longitude" | "radius" | "createdBy" | "updatedBy"
>;

export class UserGeoFencing
  extends Model<UserGeoFencingAttributes, UserGeoFencingCreationAttributes>
  implements UserGeoFencingAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number | null;
  public enabled!: boolean;
  public latitude!: number | null;
  public longitude!: number | null;
  public radius!: number | null;
  public radiusUnit!: "m" | "km";
  public locationName!: string | null;
  public landmark!: string | null;
  public address!: string | null;
  public city!: string | null;
  public createdBy!: number | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof UserGeoFencing {
    UserGeoFencing.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: "The user whose attendance is geo-fence-checked",
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        latitude: {
          type: DataTypes.DOUBLE,
          allowNull: true,
        },
        longitude: {
          type: DataTypes.DOUBLE,
          allowNull: true,
        },
        radius: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        radiusUnit: {
          type: DataTypes.STRING(4),
          allowNull: false,
          defaultValue: "m",
        },
        locationName: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        landmark: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        address: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        city: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        tableName: "user_geo_fencing",
        timestamps: true,
        indexes: [
          { unique: true, fields: ["userId"], name: "idx_user_geo_fencing_user_unique" },
          { fields: ["companyId"], name: "idx_user_geo_fencing_company" },
        ],
      }
    );

    return UserGeoFencing;
  }
}
