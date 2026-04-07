import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface CompanyBankAttributes {
  id: number;
  companyId: number;
  branchId?: number | null; // ✅ optional
  userId: number;

  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranchName?: string | null;
  bankAccountType?: string | null;
  bankMicr?: string | null;
  upiId?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

interface CompanyBankCreationAttributes
  extends Optional<
    CompanyBankAttributes,
    "id" | "branchId" | "bankBranchName" | "bankAccountType" | "bankMicr" | "upiId"
  > {}


export class CompanyBank
  extends Model<CompanyBankAttributes, CompanyBankCreationAttributes>
  implements CompanyBankAttributes
{
  public id!: number;
  public companyId!: number;
  public branchId!: number | null;
  public userId!: number;

  public bankAccountHolder!: string;
  public bankName!: string;
  public bankAccountNumber!: string;
  public bankIfsc!: string;
  public bankBranchName!: string | null;
  public bankAccountType!: string | null;
  public bankMicr!: string | null;
  public upiId!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const CompanyBankModel = (sequelize: Sequelize) => {
  CompanyBank.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      companyId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // ✅ NEW FIELD
      branchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      bankAccountHolder: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bankAccountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bankIfsc: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bankBranchName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankAccountType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankMicr: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      upiId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "company_banks",
      timestamps: true,
    }
  );

  return CompanyBank;
};