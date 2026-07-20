"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quotation = void 0;
const sequelize_1 = require("sequelize");
class Quotation extends sequelize_1.Model {
    static initModel(sequelize) {
        Quotation.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            quotationNumber: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true
            },
            clientName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            clientEmail: {
                type: sequelize_1.DataTypes.STRING
            },
            clientPhone: {
                type: sequelize_1.DataTypes.STRING
            },
            totalAmount: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: true
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
                defaultValue: "draft"
            },
            validTill: {
                type: sequelize_1.DataTypes.DATE
            },
            notes: {
                type: sequelize_1.DataTypes.TEXT
            }
        }, {
            sequelize,
            tableName: "quotations",
            modelName: "Quotation",
            timestamps: true
        });
    }
}
exports.Quotation = Quotation;
