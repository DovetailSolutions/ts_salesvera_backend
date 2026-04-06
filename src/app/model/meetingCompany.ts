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
      companyName: {
        type: DataTypes.STRING,
        field: "company_name",
      },

      meetingUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "meeting_user_id", // 👈 Mapping to the physical DB column
      },

      personName: {
        type: DataTypes.STRING,
        field: "person_name",
      },

      mobileNumber: {
        type: DataTypes.STRING,
        field: "mobile_number",
      },

      companyEmail: {
        type: DataTypes.STRING,
        field: "company_email",
      },

      customerType: {
        type: DataTypes.ENUM("new", "existing", "followup"),
        defaultValue: "new",
        field: "customer_type",
      },

      state: DataTypes.STRING,
      city: DataTypes.STRING,
      country: DataTypes.STRING,
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address: DataTypes.TEXT,
      gstNumber: {
        type: DataTypes.STRING,
        field: "gst_number",
      },

      quotationNumber: {
        type: DataTypes.STRING,
        field: "quotation_number",
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