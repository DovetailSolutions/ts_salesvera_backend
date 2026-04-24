"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordSales = void 0;
const sequelize_1 = require("sequelize");
class RecordSales extends sequelize_1.Model {
    static initModel(sequelize) {
        RecordSales.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            customerName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            productDescription: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false,
            },
            saleAmount: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: false,
            },
            remarks: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            paymentReceived: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
        }, {
            sequelize,
            tableName: "record_sales",
            modelName: "RecordSale",
            timestamps: true,
        });
    }
}
exports.RecordSales = RecordSales;
