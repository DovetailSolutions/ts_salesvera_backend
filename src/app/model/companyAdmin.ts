import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface CompanyAdminAttributes {
  id: number;
  companyId: number;
  adminId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CompanyAdminCreationAttributes
  extends Optional<CompanyAdminAttributes, "id"> {}

export class CompanyAdmin
  extends Model<CompanyAdminAttributes, CompanyAdminCreationAttributes>
  implements CompanyAdminAttributes {
  public id!: number;
  public companyId!: number;
  public adminId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const CompanyAdminModel = (sequelize: Sequelize) => {
  CompanyAdmin.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      companyId: { type: DataTypes.INTEGER, allowNull: false },
      adminId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize,
      tableName: "company_admins",
      timestamps: true,
      indexes: [{ unique: true, fields: ["companyId", "adminId"] }],
    }
  );
  return CompanyAdmin;
};
