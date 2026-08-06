"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactQuery = void 0;
const sequelize_1 = require("sequelize");
class ContactQuery extends sequelize_1.Model {
    static initModel(sequelize) {
        ContactQuery.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            email: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            companyName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            subject: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            message: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false,
            },
            // "new" | "read" | "resolved" — plain string column (not a DB enum) so
            // adding a status later never risks the Postgres enum-migration gap
            // that bit the task-status column.
            status: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                defaultValue: "new",
            },
        }, {
            sequelize,
            tableName: "contact_queries",
            modelName: "ContactQuery",
            timestamps: true,
        });
    }
}
exports.ContactQuery = ContactQuery;
