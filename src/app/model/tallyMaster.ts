import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export interface TallyMasterAttributes {
  id: number;
  userId: number;
  companyGuid: string;
  masterType: string;
  tallyGuid: string;
  name: string;
  parent?: string | null;
  alterId?: number | null;
  attributes?: Record<string, any> | null;
  status?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TallyMasterCreationAttributes
  extends Optional<
    TallyMasterAttributes,
    "id" | "parent" | "alterId" | "attributes" | "status" | "createdAt" | "updatedAt"
  > {}

export class TallyMaster
  extends Model<TallyMasterAttributes, TallyMasterCreationAttributes>
  implements TallyMasterAttributes
{
  public id!: number;
  public userId!: number;
  public companyGuid!: string;
  public masterType!: string;
  public tallyGuid!: string;
  public name!: string;
  public parent?: string | null;
  public alterId?: number | null;
  public attributes?: Record<string, any> | null;
  public status?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    TallyMaster.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: "user_id",
        },
        companyGuid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          field: "company_guid",
        },
        masterType: {
          type: DataTypes.STRING(100),
          allowNull: false,
          field: "master_type",
        },
        tallyGuid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          field: "tally_guid",
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        parent: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        alterId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: "alter_id",
        },
        attributes: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING(50),
          allowNull: true,
          defaultValue: "active",
        },
      },
      {
        sequelize,
        tableName: "tally_masters",
        modelName: "TallyMaster",
        timestamps: true,
        indexes: [
          {
            unique: true,
            name: "idx_tally_masters_unique_user_company_type_guid",
            fields: ["user_id", "company_guid", "master_type", "tally_guid"],
          },
        ],
      }
    );
  }
}
