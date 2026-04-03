"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotationItem = void 0;
const sequelize_1 = require("sequelize");
class QuotationItem extends sequelize_1.Model {
    static initModel(sequelize) {
        QuotationItem.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            quotationId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false
            },
            serviceName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            description: {
                type: sequelize_1.DataTypes.TEXT
            },
            price: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: false
            },
            quantity: {
                type: sequelize_1.DataTypes.INTEGER,
                defaultValue: 1
            }
        }, {
            sequelize,
            tableName: "quotation_items",
            modelName: "QuotationItem",
            timestamps: true
        });
    }
}
exports.QuotationItem = QuotationItem;
