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

// 1. Define the attributes
interface UserAttributes {
  id?: number;
  // Human-facing employee code ("EMP00001") — a Postgres GENERATED ALWAYS
  // column derived from `id` (see schemaExtensions.ts), never set directly.
  // Used anywhere a person needs to reference/look up an employee by a
  // memorable code instead of the raw internal id (bulk attendance CSV,
  // employee tables, etc.) — internal FKs/joins still use `id`.
  employeeCode?: string;
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
        },
        beforeUpdate: async (user: UserInstance) => {
          if (user.changed("password") && user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
      },
    }
  );
  return User;
};
