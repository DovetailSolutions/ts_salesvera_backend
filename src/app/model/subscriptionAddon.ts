import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// subscription_addons — paid add-ons bought on top of a plan (today only
// TALLY). Keyed by the tenant owner like subscriptions.userId. Rows are
// never deleted: cancelling flips status, so the table doubles as the
// add-on history. One ACTIVE row per tenant + add-on (partial unique index,
// migration 0050).
// ============================================================

export type AddonStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";

export interface SubscriptionAddonAttributes {
  id: number;
  userId: number;
  addonCode: string;
  status: AddonStatus;
  startDate: Date;
  endDate: Date | null;
  grantedBy: number | null;
  cancelledAt: Date | null;
  cancelledBy: number | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubscriptionAddonCreationAttributes = Optional<
  SubscriptionAddonAttributes,
  "id" | "status" | "startDate" | "endDate" | "grantedBy" | "cancelledAt" | "cancelledBy" | "notes"
>;

export class SubscriptionAddon
  extends Model<SubscriptionAddonAttributes, SubscriptionAddonCreationAttributes>
  implements SubscriptionAddonAttributes
{
  public id!: number;
  public userId!: number;
  public addonCode!: string;
  public status!: AddonStatus;
  public startDate!: Date;
  public endDate!: Date | null;
  public grantedBy!: number | null;
  public cancelledAt!: Date | null;
  public cancelledBy!: number | null;
  public notes!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof SubscriptionAddon {
    SubscriptionAddon.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        addonCode: { type: DataTypes.STRING(30), allowNull: false },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ACTIVE" },
        startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        endDate: { type: DataTypes.DATE, allowNull: true },
        grantedBy: { type: DataTypes.INTEGER, allowNull: true },
        cancelledAt: { type: DataTypes.DATE, allowNull: true },
        cancelledBy: { type: DataTypes.INTEGER, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
      },
      { sequelize, tableName: "subscription_addons", timestamps: true }
    );
    return SubscriptionAddon;
  }
}
