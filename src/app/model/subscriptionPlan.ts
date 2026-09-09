import { Sequelize, DataTypes, Model, Optional } from "sequelize";
import { generateBusinessId } from "../../modules/shared/businessId.service";

// ============================================================
// subscription_plans — centrally configured plan catalog (Free Trial /
// Basic / Professional / Enterprise, seeded by migration
// 0021_subscription_billing.ts) that Subscription rows are purchased
// against. See modules/subscription/subscriptionLimit.service.ts for how
// these limits are enforced.
//
// "Unlimited" for any of maxAdmins/maxCompanies/maxManagers/maxSalePersons
// is represented as NULL — never -1, never 0, never a magic string.
// Subscription rows snapshot these limits at purchase/upgrade time (see
// app/model/subscription.ts), so editing a plan's numbers here never
// retroactively changes an already-purchased subscription.
// ============================================================

export interface SubscriptionPlanAttributes {
  id: number;
  businessCode: string | null;
  planCode: string; // stable internal key: TRIAL / BASIC / PROFESSIONAL / ENTERPRISE
  name: string;
  description: string | null;
  price: number | null; // null = "Contact Sales" (custom pricing, e.g. Enterprise)
  currency: string;
  billingInterval: string | null; // 'month' | 'year' | null (trial has none)
  trialDays: number | null;
  maxAdmins: number | null;
  maxCompanies: number | null;
  maxManagers: number | null;
  maxSalePersons: number | null;
  features: Record<string, boolean>;
  isActive: boolean;
  isTrialPlan: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubscriptionPlanCreationAttributes = Optional<
  SubscriptionPlanAttributes,
  | "id"
  | "businessCode"
  | "description"
  | "price"
  | "billingInterval"
  | "trialDays"
  | "maxAdmins"
  | "maxCompanies"
  | "maxManagers"
  | "maxSalePersons"
  | "features"
  | "isActive"
  | "isTrialPlan"
  | "sortOrder"
>;

export class SubscriptionPlan
  extends Model<SubscriptionPlanAttributes, SubscriptionPlanCreationAttributes>
  implements SubscriptionPlanAttributes
{
  public id!: number;
  public businessCode!: string | null;
  public planCode!: string;
  public name!: string;
  public description!: string | null;
  public price!: number | null;
  public currency!: string;
  public billingInterval!: string | null;
  public trialDays!: number | null;
  public maxAdmins!: number | null;
  public maxCompanies!: number | null;
  public maxManagers!: number | null;
  public maxSalePersons!: number | null;
  public features!: Record<string, boolean>;
  public isActive!: boolean;
  public isTrialPlan!: boolean;
  public sortOrder!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof SubscriptionPlan {
    SubscriptionPlan.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        businessCode: { type: DataTypes.STRING(20), allowNull: true, unique: true },
        planCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "INR" },
        billingInterval: { type: DataTypes.STRING(10), allowNull: true },
        trialDays: { type: DataTypes.INTEGER, allowNull: true },
        maxAdmins: { type: DataTypes.INTEGER, allowNull: true },
        maxCompanies: { type: DataTypes.INTEGER, allowNull: true },
        maxManagers: { type: DataTypes.INTEGER, allowNull: true },
        maxSalePersons: { type: DataTypes.INTEGER, allowNull: true },
        features: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        isTrialPlan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        tableName: "subscription_plans",
        timestamps: true,
        hooks: {
          beforeCreate: async (plan: any) => {
            plan.businessCode = await generateBusinessId(sequelize, "subscription_plan");
          },
          beforeUpdate: (plan: any) => {
            if (plan.changed("businessCode")) {
              plan.businessCode = plan.previous("businessCode");
            }
          },
        },
      }
    );

    return SubscriptionPlan;
  }
}
