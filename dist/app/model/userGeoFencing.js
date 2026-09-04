"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGeoFencing = void 0;
const sequelize_1 = require("sequelize");
class UserGeoFencing extends sequelize_1.Model {
    static initModel(sequelize) {
        UserGeoFencing.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                comment: "The user whose attendance is geo-fence-checked",
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            enabled: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            latitude: {
                type: sequelize_1.DataTypes.DOUBLE,
                allowNull: true,
            },
            longitude: {
                type: sequelize_1.DataTypes.DOUBLE,
                allowNull: true,
            },
            radius: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: true,
            },
            radiusUnit: {
                type: sequelize_1.DataTypes.STRING(4),
                allowNull: false,
                defaultValue: "m",
            },
            locationName: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            landmark: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            address: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            city: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            createdBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            updatedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
        }, {
            sequelize,
            tableName: "user_geo_fencing",
            timestamps: true,
            indexes: [
                { unique: true, fields: ["userId"], name: "idx_user_geo_fencing_user_unique" },
                { fields: ["companyId"], name: "idx_user_geo_fencing_company" },
            ],
        });
        return UserGeoFencing;
    }
}
exports.UserGeoFencing = UserGeoFencing;
