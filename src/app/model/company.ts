import { Sequelize, DataTypes, Model, Optional } from "sequelize";
interface CompanyAttributes {
  id: number;
  companyName: string;
  legalName: string;
  registrationNo: string;
  gst: string;
  pan: string;
  industry: string;
  companySize: string;
  website: string;
  companyEmail: string;
  companyPhone: string;
  city: string;
  timezone: string;
  currency: string;

  // Bank
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranchName: string;
  bankAccountType: string;
  bankMicr: string;
  upiId: string;
  userId: number;

  // HR Config
  payrollCycle: string;
  lateMarkAfter: number;
  autoHalfDayAfter: number;
  casualHolidaysTotal: number;
  casualHolidaysPerMonth: number;
  casualHolidayNotice: number;
  compOffMinHours: number;
  compOffExpiryDays: number;
  casualCarryForwardLimit: number;
  casualCarryForwardExpiry: number;
  adminId: number;
  managerId: number;

  createdAt?: Date;
  updatedAt?: Date;
}

interface CompanyCreationAttributes
  extends Optional<CompanyAttributes, "id"> {}

export class Company
  extends Model<CompanyAttributes, CompanyCreationAttributes>
  implements CompanyAttributes {

  public id!: number;

  public companyName!: string;
  public legalName!: string;
  public registrationNo!: string;
  public gst!: string;
  public pan!: string;
  public industry!: string;
  public companySize!: string;
  public website!: string;
  public companyEmail!: string;
  public companyPhone!: string;
  public city!: string;
  public timezone!: string;
  public currency!: string;

  public bankAccountHolder!: string;
  public bankName!: string;
  public bankAccountNumber!: string;
  public bankIfsc!: string;
  public bankBranchName!: string;
  public bankAccountType!: string;
  public bankMicr!: string;
  public upiId!: string;

  public payrollCycle!: string;
  public lateMarkAfter!: number;
  public autoHalfDayAfter!: number;
  public casualHolidaysTotal!: number;
  public casualHolidaysPerMonth!: number;
  public casualHolidayNotice!: number;
  public compOffMinHours!: number;
  public compOffExpiryDays!: number;
  public casualCarryForwardLimit!: number;
  public casualCarryForwardExpiry!: number;
  public userId!: number;
  public adminId!: number;
  public managerId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const CompanyModell = (sequelize: Sequelize) => {
  const Company = sequelize.define<Company>(
    "Company",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      companyName: { type: DataTypes.STRING, allowNull: false },
      legalName: { type: DataTypes.STRING, allowNull: false },
      registrationNo: { type: DataTypes.STRING, allowNull: false },
      gst: { type: DataTypes.STRING, allowNull: true },
      pan: { type: DataTypes.STRING, allowNull: true },
      industry: { type: DataTypes.STRING, allowNull: true },
      companySize: { type: DataTypes.STRING, allowNull: true },
      website: { type: DataTypes.STRING, allowNull: true },
      companyEmail: { type: DataTypes.STRING, allowNull: false },
      companyPhone: { type: DataTypes.STRING, allowNull: false },
      city: { type: DataTypes.STRING, allowNull: true },
      timezone: { type: DataTypes.STRING, allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true },

      // Bank
      bankAccountHolder: { type: DataTypes.STRING, allowNull: true },
      bankName: { type: DataTypes.STRING, allowNull: true },
      bankAccountNumber: { type: DataTypes.STRING, allowNull: true },
      bankIfsc: { type: DataTypes.STRING, allowNull: true },
      bankBranchName: { type: DataTypes.STRING, allowNull: true },
      bankAccountType: { type: DataTypes.STRING, allowNull: true },
      bankMicr: { type: DataTypes.STRING, allowNull: true },
      upiId: { type: DataTypes.STRING, allowNull: true },

      // HR Config
      payrollCycle: { type: DataTypes.STRING, allowNull: true },
      lateMarkAfter: { type: DataTypes.INTEGER, allowNull: true },
      autoHalfDayAfter: { type: DataTypes.INTEGER, allowNull: true },
      casualHolidaysTotal: { type: DataTypes.INTEGER, allowNull: true },
      casualHolidaysPerMonth: { type: DataTypes.INTEGER, allowNull: true },
      casualHolidayNotice: { type: DataTypes.INTEGER, allowNull: true },
      compOffMinHours: { type: DataTypes.INTEGER, allowNull: true },
      compOffExpiryDays: { type: DataTypes.INTEGER, allowNull: true },
      casualCarryForwardLimit: { type: DataTypes.INTEGER, allowNull: true },
      casualCarryForwardExpiry: { type: DataTypes.INTEGER, allowNull: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      adminId: { type: DataTypes.INTEGER, allowNull: true },
      managerId: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "companies",
      timestamps: true,
    }
  );

  return Company;
};