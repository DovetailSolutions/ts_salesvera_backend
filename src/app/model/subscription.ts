import { Sequelize, DataTypes, Model, Optional } from "sequelize";
import { generateBusinessId } from "../../modules/shared/businessId.service";

// ============================================================
// subscriptions — one row per subscription period for a top-level tenant
// "user" (userId → users.id, role='user'; see app/model/user.ts's
// tenantId). A tenant accumulates historical rows over time (trial, each
// renewal/upgrade) — "only one LIVE row per user" is enforced at the
// service layer (see modules/subscription/subscription.service.ts), not a
// DB constraint, so CANCELLED/EXPIRED history is never lost.
//
// status: TRIALING | ACTIVE | PAST_DUE | CANCELLED | EXPIRED | PAYMENT_FAILED
// (plain STRING, not a Postgres ENUM — same convention as
// AttendanceRegularization.status elsewhere in this codebase).
//
// maxAdmins/maxCompanies/maxManagers/maxSalePersons are SNAPSHOTTED from
// the plan at purchase/upgrade time (NULL = unlimited) — never a live join
// to subscription_plans — so a later plan edit never retroactively changes
// an already-purchased subscription's enforced limits.
// ============================================================

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED"
  | "PAYMENT_FAILED";

export interface SubscriptionAttributes {
  id: number;
  businessCode: string | null;
  userId: number;
  planId: number;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;
  cancelledAt: Date | null;
  maxAdmins: number | null;
  maxCompanies: number | null;
  maxManagers: number | null;
  maxSalePersons: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubscriptionCreationAttributes = Optional<
  SubscriptionAttributes,
  | "id"
  | "businessCode"
  | "status"
  | "startDate"
  | "cancelAtPeriodEnd"
  | "autoRenew"
  | "cancelledAt"
  | "maxAdmins"
  | "maxCompanies"
  | "maxManagers"
  | "maxSalePersons"
>;

export class Subscription
  extends Model<SubscriptionAttributes, SubscriptionCreationAttributes>
  implements SubscriptionAttributes
{
  public id!: number;
  public businessCode!: string | null;
  public userId!: number;
  public planId!: number;
  public status!: SubscriptionStatus;
  public startDate!: Date;
  public endDate!: Date;
  public cancelAtPeriodEnd!: boolean;
  public autoRenew!: boolean;
  public cancelledAt!: Date | null;
  public maxAdmins!: number | null;
  public maxCompanies!: number | null;
  public maxManagers!: number | null;
  public maxSalePersons!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Subscription {
    Subscription.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        businessCode: { type: DataTypes.STRING(20), allowNull: true, unique: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        planId: { type: DataTypes.INTEGER, allowNull: false },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "TRIALING" },
        startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        endDate: { type: DataTypes.DATE, allowNull: false },
        cancelAtPeriodEnd: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        autoRenew: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        cancelledAt: { type: DataTypes.DATE, allowNull: true },
        maxAdmins: { type: DataTypes.INTEGER, allowNull: true },
        maxCompanies: { type: DataTypes.INTEGER, allowNull: true },
        maxManagers: { type: DataTypes.INTEGER, allowNull: true },
        maxSalePersons: { type: DataTypes.INTEGER, allowNull: true },
      },
      {
        sequelize,
        tableName: "subscriptions",
        timestamps: true,
        indexes: [
          { fields: ["userId"], name: "idx_subscriptions_user" },
          { fields: ["status"], name: "idx_subscriptions_status" },
        ],
        hooks: {
          beforeCreate: async (subscription: any) => {
            subscription.businessCode = await generateBusinessId(sequelize, "subscription");
          },
          beforeUpdate: (subscription: any) => {
            if (subscription.changed("businessCode")) {
              subscription.businessCode = subscription.previous("businessCode");
            }
          },
        },
      }
    );

    return Subscription;
  }
}
