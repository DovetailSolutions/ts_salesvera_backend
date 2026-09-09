import { Sequelize, DataTypes, Model, Optional } from "sequelize";
import { generateBusinessId } from "../../modules/shared/businessId.service";

// ============================================================
// payments — one row per Razorpay Order checkout attempt (NEW purchase,
// UPGRADE, or RENEWAL). Created with status='CREATED' at checkout time,
// then updated to CAPTURED/FAILED once the payment is verified (either via
// the user-facing verify-payment endpoint or the Razorpay webhook — see
// modules/subscription/subscription.service.ts). Never stores card/UPI
// credentials — only Razorpay's own opaque order/payment ids and
// non-sensitive metadata.
//
// razorpayOrderId is unique and NOT NULL (created up front); razorpayPaymentId
// is unique-when-present (partial index, see migration) and is only filled
// in once Razorpay actually captures/fails the payment — these two unique
// indexes are what make payment verification and the webhook idempotent.
// ============================================================

export type PaymentStatus = "CREATED" | "CAPTURED" | "FAILED" | "REFUNDED";
export type PaymentPurpose = "NEW" | "UPGRADE" | "RENEWAL";

export interface PaymentAttributes {
  id: number;
  businessCode: string | null;
  userId: number;
  subscriptionId: number | null;
  planId: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  method: string | null;
  notes: Record<string, any> | null;
  failureReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PaymentCreationAttributes = Optional<
  PaymentAttributes,
  | "id"
  | "businessCode"
  | "subscriptionId"
  | "status"
  | "purpose"
  | "razorpayPaymentId"
  | "razorpaySignature"
  | "method"
  | "notes"
  | "failureReason"
>;

export class Payment
  extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes
{
  public id!: number;
  public businessCode!: string | null;
  public userId!: number;
  public subscriptionId!: number | null;
  public planId!: number;
  public amount!: number;
  public currency!: string;
  public status!: PaymentStatus;
  public purpose!: PaymentPurpose;
  public razorpayOrderId!: string;
  public razorpayPaymentId!: string | null;
  public razorpaySignature!: string | null;
  public method!: string | null;
  public notes!: Record<string, any> | null;
  public failureReason!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Payment {
    Payment.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        businessCode: { type: DataTypes.STRING(20), allowNull: true, unique: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        subscriptionId: { type: DataTypes.INTEGER, allowNull: true },
        planId: { type: DataTypes.INTEGER, allowNull: false },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "INR" },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "CREATED" },
        purpose: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "NEW" },
        razorpayOrderId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        razorpayPaymentId: { type: DataTypes.STRING(64), allowNull: true, unique: true },
        razorpaySignature: { type: DataTypes.STRING(256), allowNull: true },
        method: { type: DataTypes.STRING(30), allowNull: true },
        notes: { type: DataTypes.JSONB, allowNull: true },
        failureReason: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: "payments",
        timestamps: true,
        indexes: [
          { fields: ["userId"], name: "idx_payments_user" },
          { fields: ["subscriptionId"], name: "idx_payments_subscription" },
        ],
        hooks: {
          beforeCreate: async (payment: any) => {
            payment.businessCode = await generateBusinessId(sequelize, "payment");
          },
          beforeUpdate: (payment: any) => {
            if (payment.changed("businessCode")) {
              payment.businessCode = payment.previous("businessCode");
            }
          },
        },
      }
    );

    return Payment;
  }
}
