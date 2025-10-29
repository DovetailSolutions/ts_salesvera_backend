"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyTypeModel = exports.PropertyType = void 0;
const sequelize_1 = require("sequelize");
class PropertyType extends sequelize_1.Model {
}
exports.PropertyType = PropertyType;
const PropertyTypeModel = (sequelize) => {
    PropertyType.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        }
    }, {
        tableName: "property_types", // ✅ Fixed table name
        sequelize, // ✅ Bind model to Sequelize instance
        timestamps: true,
    });
    return PropertyType;
};
exports.PropertyTypeModel = PropertyTypeModel;
