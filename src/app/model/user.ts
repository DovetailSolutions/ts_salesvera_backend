import { Sequelize, DataTypes, Model, Optional,  BelongsToManyGetAssociationsMixin,
  BelongsToManySetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
  BelongsToManyRemoveAssociationsMixin, } from "sequelize";
import bcrypt from "bcrypt";

// 1. Define the attributes
interface UserAttributes {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: "user" | "admin" | "super_admin" | "manager" | "sale_person"; // Match ENUM exactly!
  refreshToken?: string;
  dob?: string;
  profile?: string;
 createdBy?: number[];
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
  public removeCreatedUsers!: BelongsToManyRemoveAssociationsMixin<User, number>;
}


// 2. Define creation interface for Sequelize
type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "password"
  | "phone"
  | "refreshToken"
  | "dob"
  | "profile"
  | "createdBy"
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
      // createdBy: {
      //   type:DataTypes.ARRAY(DataTypes.INTEGER),
      //   allowNull: true,
      //   references: {
      //     model: "users", // If FK
      //     key: "id",
      //   },
      // },
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
