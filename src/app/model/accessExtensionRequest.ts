import { Sequelize, DataTypes, Model, Optional } from "sequelize";
import { generateBusinessId } from "../../modules/shared/businessId.service";

// ============================================================
// access_extension_requests — a tenant ("user" role) asking Super Admin for
// more time on their subscription (see app/model/subscription.ts) before or
// after it expires. One row per request; at most one PENDING row per tenant
// at a time (enforced by a partial unique index in migration
// 0029_access_management.ts, not just an application-level check, so a
// duplicate-submit race can't create two).
//
// Deliberately does NOT let the request itself carry a role/limit change —
// scope is "extend the subscription's endDate," matching what the Super
// Admin access-management UI actually exposes today. Raising role limits is
// a separate, existing Super Admin action (PATCH the subscription directly)
// requiring no employee-side request/approval workflow.
// ============================================================

export type AccessExtensionStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface AccessExtensionRequestAttributes {
  id: number;
  publicId: string | null;
  requestedByUserId: number;
  ownerUserId: number;
  subscriptionId: number | null;
  requestedDurationDays: number;
  reason: string;
  status: AccessExtensionStatus;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  previousExpiresAt: Date | null;
  approvedExpiresAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AccessExtensionRequestCreationAttributes = Optional<
  AccessExtensionRequestAttributes,
  | "id" | "publicId" | "subscriptionId" | "status" | "reviewedBy" | "reviewedAt"
  | "reviewComment" | "previousExpiresAt" | "approvedExpiresAt"
>;

export class AccessExtensionRequest
  extends Model<AccessExtensionRequestAttributes, AccessExtensionRequestCreationAttributes>
  implements AccessExtensionRequestAttributes
{
  public id!: number;
  public publicId!: string | null;
  public requestedByUserId!: number;
  public ownerUserId!: number;
  public subscriptionId!: number | null;
  public requestedDurationDays!: number;
  public reason!: string;
  public status!: AccessExtensionStatus;
  public reviewedBy!: number | null;
  public reviewedAt!: Date | null;
  public reviewComment!: string | null;
  public previousExpiresAt!: Date | null;
  public approvedExpiresAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof AccessExtensionRequest {
    AccessExtensionRequest.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        publicId: { type: DataTypes.STRING(20), allowNull: true, unique: true },
        requestedByUserId: { type: DataTypes.INTEGER, allowNull: false },
        ownerUserId: { type: DataTypes.INTEGER, allowNull: false },
        subscriptionId: { type: DataTypes.INTEGER, allowNull: true },
        requestedDurationDays: { type: DataTypes.INTEGER, allowNull: false },
        reason: { type: DataTypes.TEXT, allowNull: false },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
        reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
        reviewedAt: { type: DataTypes.DATE, allowNull: true },
        reviewComment: { type: DataTypes.TEXT, allowNull: true },
        previousExpiresAt: { type: DataTypes.DATE, allowNull: true },
        approvedExpiresAt: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        tableName: "access_extension_requests",
        timestamps: true,
        hooks: {
          beforeCreate: async (row: any) => {
            row.publicId = await generateBusinessId(sequelize, "access_extension_request");
          },
        },
      }
    );

    return AccessExtensionRequest;
  }
}
