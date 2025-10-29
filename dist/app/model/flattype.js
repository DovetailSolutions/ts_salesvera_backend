"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatTypeModel = exports.FlatType = void 0;
const sequelize_1 = require("sequelize");
class FlatType extends sequelize_1.Model {
}
exports.FlatType = FlatType;
const FlatTypeModel = (sequelize) => {
    const FlatType = sequelize.define("FlatType", {
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
        tableName: "flatType",
        timestamps: true,
    });
    return FlatType;
};
exports.FlatTypeModel = FlatTypeModel;
