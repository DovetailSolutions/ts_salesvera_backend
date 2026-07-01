import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface CompanyManagerAttributes {
  id: number;
  companyId: number;
  managerId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CompanyManagerCreationAttributes
  extends Optional<CompanyManagerAttributes, "id"> {}

export class CompanyManager
  extends Model<CompanyManagerAttributes, CompanyManagerCreationAttributes>
  implements CompanyManagerAttributes {
  public id!: number;
  public companyId!: number;
  public managerId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const CompanyManagerModel = (sequelize: Sequelize) => {
  CompanyManager.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      companyId: { type: DataTypes.INTEGER, allowNull: false },
      managerId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize,
      tableName: "company_managers",
      timestamps: true,
      indexes: [{ unique: true, fields: ["companyId", "managerId"] }],
    }
  );
  return CompanyManager;
};
