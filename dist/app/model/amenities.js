"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmenitiesModel = exports.Amenities = void 0;
const sequelize_1 = require("sequelize");
class Amenities extends sequelize_1.Model {
}
exports.Amenities = Amenities;
const AmenitiesModel = (sequelize) => {
    const Amenities = sequelize.define("Amenities", {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        type: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
    }, {
        tableName: "amenities",
        timestamps: true,
    });
    return Amenities;
};
exports.AmenitiesModel = AmenitiesModel;
