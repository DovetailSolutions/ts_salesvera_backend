"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectModel = exports.Project = void 0;
const sequelize_1 = require("sequelize");
class Project extends sequelize_1.Model {
}
exports.Project = Project;
const ProjectModel = (sequelize) => {
    Project.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
        },
        project_name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: sequelize_1.DataTypes.ENUM("ongoing", "completed", "upcoming"),
            defaultValue: "ongoing",
        },
        project_details: {
            type: sequelize_1.DataTypes.TEXT,
        },
        project_features: {
            type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        },
        price_range_from: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        price_range_to: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        price_per_sqft: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        units_size_sqft: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        total_units: {
            type: sequelize_1.DataTypes.INTEGER,
        },
        location: {
            type: sequelize_1.DataTypes.STRING,
        },
        city: {
            type: sequelize_1.DataTypes.STRING,
        },
        state: {
            type: sequelize_1.DataTypes.STRING,
        },
        country: {
            type: sequelize_1.DataTypes.STRING,
        },
        possession_date: {
            type: sequelize_1.DataTypes.DATE,
        },
        builder_name: {
            type: sequelize_1.DataTypes.STRING,
        },
        project_images: {
            type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        },
        is_active: {
            type: sequelize_1.DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        //   modelName: "Project",
        tableName: "projects", // 👈 make sure table name matches this
        timestamps: true,
    });
    return Project;
};
exports.ProjectModel = ProjectModel;
