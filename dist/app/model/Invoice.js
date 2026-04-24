"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invoices = void 0;
const sequelize_1 = require("sequelize");
class Invoices extends sequelize_1.Model {
    static initModel(sequelize) {
        Invoices.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            invoiceNumber: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            customerName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            quotationId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null,
            },
            invoice: {
                type: sequelize_1.DataTypes.JSON,
                allowNull: true,
            },
            quotationNumber: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            quotationDate: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            invoiceDate: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("draft", "sent", "accepted", "imported", "rejected", "cancelled", "deleted"),
                defaultValue: "draft",
            },
        }, {
            sequelize,
            tableName: "invoices",
            modelName: "Invoice",
            timestamps: true,
        });
    }
}
exports.Invoices = Invoices;
