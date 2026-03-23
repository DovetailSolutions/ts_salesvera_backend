import { Sequelize, DataTypes, Model } from "sequelize";
export class Company extends Model {
  public id!: number;
  public companyName!: string;
  public meetingUserId!: number;
  public personName!: string;
  public mobileNumber!: string;
  public companyEmail!: string;
  public customerType!: "new" | "existing" | "followup";
  public remarks!: string;
}

export const CompanyModel = (sequelize: Sequelize) => {
  Company.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      companyName: DataTypes.STRING,
      meetingUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      personName: DataTypes.STRING,
      mobileNumber: DataTypes.STRING,
      companyEmail: DataTypes.STRING,
      customerType: {
        type: DataTypes.ENUM("new", "existing", "followup"),
        defaultValue: "new",
      },
      state: DataTypes.STRING,
      city: DataTypes.STRING,
      country: DataTypes.STRING,
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "companies",
      timestamps: true,
    }
  );

  return Company;
};