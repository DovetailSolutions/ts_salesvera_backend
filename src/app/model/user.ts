import {
  Sequelize,
  DataTypes,
  Model,
  Optional,
  BelongsToManyGetAssociationsMixin,
  BelongsToManySetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
  BelongsToManyRemoveAssociationsMixin,
} from "sequelize";
import bcrypt from "bcrypt";
import { generateBusinessId } from "../../modules/shared/businessId.service";

// Only these three roles are in the Business ID rollout's agreed scope —
// user/client/super_admin intentionally get no businessCode (stays null).
const ROLE_BUSINESS_ID_ENTITY_TYPE: Record<string, string> = {
  admin: "admin",
  manager: "manager",
  sale_person: "sale_person",
};

// 1. Define the attributes
interface UserAttributes {
  id?: number;
  // Human-facing employee code ("EMP00001") — a Postgres GENERATED ALWAYS
  // column derived from `id` (see schemaExtensions.ts), never set directly.
  // Used anywhere a person needs to reference/look up an employee by a
  // memorable code instead of the raw internal id (bulk attendance CSV,
  // employee tables, etc.) — internal FKs/joins still use `id`.
  employeeCode?: string;
  // Human-readable Business ID, role-scoped prefix (ADM/MGR/SAL) — only
  // assigned for admin/manager/sale_person (see the beforeCreate hook
  // below and businessId.service.ts). null for user/super_admin/client,
  // which aren't in this rollout's scope. Separate from `id` and from
  // employeeCode (which is unscoped-by-role and derived from `id` itself).
  businessCode?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: "user" | "admin" | "super_admin" | "manager" | "sale_person"; // Match ENUM exactly!
  refreshToken?: string;
  status?: "active" | "deActive" | "delete";
  dob?: string;
  profile?: string;
  createdBy?: number;
  onlineSatus?: "online" | "offline";
  otp?: string | null;
  otpExpiry?: Date | null;
  tallyGuid?: string | null;
  tallyName?: string | null;
  tallyStartDate?: Date | null;
  tenantId?: number | null; // root "user" id that owns this account's company tree
  lastLoginCompanyId?: number | null; // company the user was active in when they last logged out
  branchId?: number | null;
  shiftId?: number | null;
  departmentId?: number | null;
  // Notification mute preferences (Settings module's "My Preferences" tab) —
  // system/other notifications are never individually mutable, so there's
  // no notifySystem/notifyOther.
  notifyChat?: boolean;
  notifyTask?: boolean;
  notifyMeeting?: boolean;
  // Admin-configurable per user (User Management page) — default OFF. Only
  // meaningful for sale_person: gates whether their own GET /api/getprofile
  // includes the company's full branch list. See schemaExtensions.ts's
  // ensureBranchVisibilityToggle.
  canViewAllBranches?: boolean;
  isGeofenceRequired?: boolean;
  // Attendance Security module (modules/attendanceSecurity) — all three
  // default false so no existing user's attendance behavior changes until
  // an admin explicitly opts them in per user or in bulk.
  isAttendancePhotoRequired?: boolean;
  isDeviceSecurityRequired?: boolean;
  isPunchOutGeofenceRequired?: boolean;
}

export class User extends Model<UserAttributes, UserCreationAttributes> {
  public id!: number;

  /** Many-to-many Self Relation Mixins */
  public getCreators!: BelongsToManyGetAssociationsMixin<User>;
  public setCreators!: BelongsToManySetAssociationsMixin<User, number>;
  public addCreator!: BelongsToManyAddAssociationMixin<User, number>;
  public addCreators!: BelongsToManyAddAssociationsMixin<User, number>;
  public removeCreator!: BelongsToManyRemoveAssociationMixin<User, number>;
  public removeCreators!: BelongsToManyRemoveAssociationsMixin<User, number>;


  public getCreatedUsers!: BelongsToManyGetAssociationsMixin<User>;
  public setCreatedUsers!: BelongsToManySetAssociationsMixin<User, number>;
  public addCreatedUser!: BelongsToManyAddAssociationMixin<User, number>;
  public addCreatedUsers!: BelongsToManyAddAssociationsMixin<User, number>;
  public removeCreatedUser!: BelongsToManyRemoveAssociationMixin<User, number>;
  public removeCreatedUsers!: BelongsToManyRemoveAssociationsMixin<
    User,
    number
  >;
}

// 2. Define creation interface for Sequelize
type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "employeeCode"
  | "businessCode"
  | "firstName"
  | "lastName"
  | "email"
  | "password"
  | "phone"
  | "refreshToken"
  | "dob"
  | "status"
  | "profile"
  | "createdBy"
  | "onlineSatus"
  | "tallyGuid"
  | "tallyName"
  | "tallyStartDate"
  | "tenantId"
  | "lastLoginCompanyId"
  | "branchId"
  | "shiftId"
  | "departmentId"
  | "notifyChat"
  | "notifyTask"
  | "notifyMeeting"
  | "canViewAllBranches"
>;

// 3. Define the Model Instance
interface UserInstance
  extends Model<UserAttributes, UserCreationAttributes>,
    UserAttributes {}

// 4. Define the model
export const createUserModel = (sequelize: Sequelize) => {
  const User = sequelize.define<UserInstance>(
    "User",
    {
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active","deActive","delete"),
        allowNull: false,
        defaultValue: "active",
      },
       onlineSatus: {
        type: DataTypes.ENUM("online","offline"),
        allowNull: false,
        defaultValue: "offline",
      },
      role: {
        type: DataTypes.ENUM(
          "user",
          "admin",
          "client",
          "super_admin",
          "manager",
          "sale_person"
        ),
        allowNull: false,
        defaultValue: "user",
      },
      tallyGuid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tallyName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tallyStartDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      refreshToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dob: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otpExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tenantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      lastLoginCompanyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      branchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      shiftId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      departmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      // Generated column (see schemaExtensions.ts's ensureEmployeeCode) —
      // Postgres computes/stores this from `id` on every insert, Sequelize
      // only needs to know it exists to SELECT it back.
      employeeCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      // Role-scoped Business ID (ADM.../MGR.../SAL...) — see the
      // beforeCreate hook below and businessId.service.ts. Backend-assigned
      // only; null for roles outside this rollout's scope (user, client,
      // super_admin).
      businessCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
      },
      // See schemaExtensions.ts's ensureNotificationPreferences.
      notifyChat: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notifyTask: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notifyMeeting: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      isGeofenceRequired: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        isAttendancePhotoRequired: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        isDeviceSecurityRequired: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        isPunchOutGeofenceRequired: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        canViewAllBranches: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      hooks: {
        beforeCreate: async (user: UserInstance) => {
          if (user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
          // Always backend-generated for the roles in scope — a
          // client-supplied businessCode in the create payload is
          // discarded, not just defaulted. Roles outside this rollout's
          // scope (user, client, super_admin) get no Business ID.
          const entityType = ROLE_BUSINESS_ID_ENTITY_TYPE[user.role ?? ""];
          user.businessCode = entityType ? await generateBusinessId(sequelize, entityType) : null;
        },
        beforeUpdate: async (user: UserInstance) => {
          if (user.changed("password") && user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
          // Immutable by default — revert any attempted change from a
          // normal update call (e.g. a role change should not silently
          // re-stamp a different prefix onto an existing businessCode).
          if (user.changed("businessCode")) {
            user.businessCode = user.previous("businessCode") as string | null;
          }
        },
      },
    }
  );
  return User;
};
