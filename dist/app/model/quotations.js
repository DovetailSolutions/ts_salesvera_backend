"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quotations = void 0;
const sequelize_1 = require("sequelize");
class Quotations extends sequelize_1.Model {
    static initModel(sequelize) {
        Quotations.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            quotationNumber: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            referenceNumber: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            customerName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            quotation: {
                type: sequelize_1.DataTypes.JSON, // 🔥 best for storing object
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("draft", "sent", "accepted", "rejected"),
                defaultValue: "draft",
            },
        }, {
            sequelize,
            tableName: "quotations",
            modelName: "Quotation",
            timestamps: true, // adds createdAt & updatedAt automatically
        });
    }
}
exports.Quotations = Quotations;
