"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepostModel = exports.Repost = void 0;
const sequelize_1 = require("sequelize");
class Repost extends sequelize_1.Model {
}
exports.Repost = Repost;
const RepostModel = (sequelize) => {
    const Repost = sequelize.define("Repost", {
        id: {
            type: sequelize_1.DataTypes.INTEGER, // ✅ fixed (no UNSIGNED)
            autoIncrement: true,
            primaryKey: true,
        },
        date: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        referenceNo: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            field: "reference_no",
        },
        customerName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            field: "customer_name",
        },
        openingAmount: {
            type: sequelize_1.DataTypes.DECIMAL(10, 2), // ✅ fixed
            allowNull: false,
            field: "opening_amount",
        },
        pendingAmount: {
            type: sequelize_1.DataTypes.DECIMAL(10, 2), // ✅ fixed
            allowNull: false,
            field: "pending_amount",
        },
        dueOn: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            field: "due_on",
        },
        overdueDays: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            field: "overdue_days",
        },
        status: {
            type: sequelize_1.DataTypes.ENUM("draft", "imported", "sent", "accepted", "rejected"),
            allowNull: false, // ✅ added
            defaultValue: "draft",
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
        companyId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: "repost",
        freezeTableName: true, // ✅ IMPORTANT
        timestamps: true,
    });
    return Repost;
};
exports.RepostModel = RepostModel;
