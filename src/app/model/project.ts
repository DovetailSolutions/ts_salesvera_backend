import { Sequelize, DataTypes, Model } from "sequelize";

export class Project extends Model {}

export const ProjectModel = (sequelize: Sequelize) => {
  Project.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      project_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ongoing", "completed", "upcoming"),
        defaultValue: "ongoing",
      },
      project_details: {
        type: DataTypes.TEXT,
      },
      project_features: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      price_range_from: {
        type: DataTypes.FLOAT,
      },
      price_range_to: {
        type: DataTypes.FLOAT,
      },
      price_per_sqft: {
        type: DataTypes.FLOAT,
      },
      units_size_sqft: {
        type: DataTypes.FLOAT,
      },
      total_units: {
        type: DataTypes.INTEGER,
      },
      location: {
        type: DataTypes.STRING,
      },
      city: {
        type: DataTypes.STRING,
      },
      state: {
        type: DataTypes.STRING,
      },
      country: {
        type: DataTypes.STRING,
      },
      possession_date: {
        type: DataTypes.DATE,
      },
      builder_name: {
        type: DataTypes.STRING,
      },
      project_images: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
    //   modelName: "Project",
      tableName: "projects", // 👈 make sure table name matches this
      timestamps: true,
    }
  );

  return Project;
};
