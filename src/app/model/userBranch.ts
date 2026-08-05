import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// Many-to-many User ↔ Branch.
//
// User.branchId (a single column) still exists and is deliberately kept as
// the user's PRIMARY branch — it is load-bearing across the app (company
// resolution in userHierarchy, attendance geofencing, and the
// resolveDefaultBranchAndShift fallback), so it must keep working exactly
// as before. This junction sits alongside it and records the FULL set of
// branches a user is allocated to, which only admin/manager ever need more
// than one of. A sale_person works out of a single branch, so for them the
// junction holds exactly one row that mirrors User.branchId.
interface UserBranchAttributes {
  id: number;
  userId: number;
  branchId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserBranchCreationAttributes extends Optional<UserBranchAttributes, "id"> {}

export class UserBranch
  extends Model<UserBranchAttributes, UserBranchCreationAttributes>
  implements UserBranchAttributes {
  public id!: number;
  public userId!: number;
  public branchId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const UserBranchModel = (sequelize: Sequelize) => {
  UserBranch.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      branchId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize,
      tableName: "user_branches",
      timestamps: true,
      indexes: [{ unique: true, fields: ["userId", "branchId"] }],
    }
  );
  return UserBranch;
};
