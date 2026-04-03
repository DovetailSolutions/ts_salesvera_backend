import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface BranchAttributes {
  id: number;

  branchName: string;
  branchCode: string;

  branchCity: string;
  branchState: string;
  branchCountry: string;
  postalCode: string;

  addressLine1: string;
  addressLine2?: string;

  branchEmail: string;
  branchPhone: string;

  latitude: number;
  longitude: number;
  geoRadius: number;

  adminId?: number;
  managerId?: number;
  userId?: number;
  companyId?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

interface BranchCreationAttributes
  extends Optional<
    BranchAttributes,
    "id" | "addressLine2" | "adminId" | "managerId"
  > {}

export class Branch
  extends Model<BranchAttributes, BranchCreationAttributes>
  implements BranchAttributes {
  public id!: number;

  public branchName!: string;
  public branchCode!: string;

  public branchCity!: string;
  public branchState!: string;
  public branchCountry!: string;
  public postalCode!: string;

  public addressLine1!: string;
  public addressLine2?: string;

  public branchEmail!: string;
  public branchPhone!: string;

  public latitude!: number;
  public longitude!: number;
  public geoRadius!: number;

  public adminId?: number;
  public managerId?: number;
  public userId?: number;
  public companyId?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const BranchModel = (sequelize: Sequelize) => {
  const Branch = sequelize.define<Branch>(
    "Branch",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      branchName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      branchCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      branchCity: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      branchState: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      branchCountry: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      postalCode: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      addressLine1: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      addressLine2: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      branchEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },

      branchPhone: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      latitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },

      longitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },

      geoRadius: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },

      adminId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      managerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      companyId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "branches",
      timestamps: true,
    }
  );

  return Branch;
};