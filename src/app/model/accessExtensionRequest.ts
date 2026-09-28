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
// Carries one of two request kinds, discriminated by `requestType`
// (migration 0033_access_limit_requests.ts):
//
//   "duration"       -> requestedDurationDays: give this tenant more time
//                       before the subscription's endDate cuts them off.
//   "employee_limit" -> requestedEmployeeLimit: raise the tenant's
//                       maxEmployees cap so they can hire past it.
//
// Both share one status machine, one Super Admin review queue and one audit
// trail rather than living in two near-identical tables. Exactly one field
// matching the row's requestType is populated — enforced by a CHECK
// constraint in 0033 as well as in accessExtension.service.ts.
// ============================================================

export type AccessExtensionStatus = "pending" | "approved" | "rejected" | "cancelled";

// "duration" is the pre-0033 behaviour and stays the column default, so
// every historical row reads back as the kind of request it actually was.
export type AccessRequestType = "duration" | "employee_limit";

export interface AccessExtensionRequestAttributes {
  id: number;
  publicId: string | null;
  requestedByUserId: number;
  ownerUserId: number;
  subscriptionId: number | null;
  requestType: AccessRequestType;
  requestedDurationDays: number | null;
  currentEmployeeLimit: number | null;
  requestedEmployeeLimit: number | null;
  approvedEmployeeLimit: number | null;
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
  | "requestType" | "requestedDurationDays" | "currentEmployeeLimit"
  | "requestedEmployeeLimit" | "approvedEmployeeLimit"
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
  public requestType!: AccessRequestType;
  public requestedDurationDays!: number | null;
  public currentEmployeeLimit!: number | null;
  public requestedEmployeeLimit!: number | null;
  public approvedEmployeeLimit!: number | null;
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
        requestType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "duration" },
        requestedDurationDays: { type: DataTypes.INTEGER, allowNull: true },
        currentEmployeeLimit: { type: DataTypes.INTEGER, allowNull: true },
        requestedEmployeeLimit: { type: DataTypes.INTEGER, allowNull: true },
        approvedEmployeeLimit: { type: DataTypes.INTEGER, allowNull: true },
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
