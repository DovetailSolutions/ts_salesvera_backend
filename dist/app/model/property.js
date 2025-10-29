"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyModel = exports.Property = void 0;
const sequelize_1 = require("sequelize");
class Property extends sequelize_1.Model {
}
exports.Property = Property;
const PropertyModel = (sequelize) => {
    Property.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        listing_type: {
            type: sequelize_1.DataTypes.ENUM("free", "paid"),
            defaultValue: "free",
        },
        property_for: {
            type: sequelize_1.DataTypes.ENUM("sale", "rent"),
            defaultValue: "sale",
        },
        owner_ship: {
            type: sequelize_1.DataTypes.ENUM("freehold", "leasehold", "power_of_attorney", "cooperative_society"),
            defaultValue: "freehold",
        },
        builder_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
        project_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
        category_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
        property_type: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
        amenities_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
        },
        title: {
            type: sequelize_1.DataTypes.TEXT,
        },
        unique_selling_point: {
            type: sequelize_1.DataTypes.TEXT,
        },
        state: {
            type: sequelize_1.DataTypes.STRING,
        },
        city: {
            type: sequelize_1.DataTypes.STRING,
        },
        country: {
            type: sequelize_1.DataTypes.STRING,
        },
        locality: {
            type: sequelize_1.DataTypes.STRING,
        },
        address: {
            type: sequelize_1.DataTypes.STRING,
        },
        facing: {
            type: sequelize_1.DataTypes.ENUM("east", "west", "north", "south"),
            defaultValue: "north",
        },
        bedroom: {
            type: sequelize_1.DataTypes.STRING,
        },
        bathroom: {
            type: sequelize_1.DataTypes.INTEGER,
            defaultValue: 1,
        },
        balconies: {
            type: sequelize_1.DataTypes.INTEGER,
            defaultValue: 0,
        },
        floor_no: {
            type: sequelize_1.DataTypes.INTEGER,
        },
        total_floor: {
            type: sequelize_1.DataTypes.INTEGER,
        },
        furnished_status: {
            type: sequelize_1.DataTypes.ENUM("furnished", "semifurnished", "unfurnished"),
            defaultValue: "unfurnished",
        },
        price: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        price_per_sqft: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        price_negotiable: {
            type: sequelize_1.DataTypes.ENUM("yes", "no"),
            defaultValue: "yes",
        },
        price_include: {
            type: sequelize_1.DataTypes.ENUM("plc", "car_parking", "club_membership"),
            allowNull: true,
        },
        booking_amount: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        other_charge: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        maintenance_charge: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        maintenance_mode: {
            type: sequelize_1.DataTypes.ENUM("monthly", "yearly", "quarterly", "one_time"),
            defaultValue: "monthly",
        },
        area: {
            type: sequelize_1.DataTypes.STRING,
        },
        corner_plot: {
            type: sequelize_1.DataTypes.ENUM("yes", "no"),
            defaultValue: "no",
        },
        length: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        breadth: {
            type: sequelize_1.DataTypes.FLOAT,
        },
        is_active: {
            type: sequelize_1.DataTypes.ENUM("yes", "no"),
            defaultValue: "yes",
        },
        possession_status: {
            type: sequelize_1.DataTypes.ENUM("under_construction", "ready_to_move"),
            defaultValue: "under_construction",
        },
        image: {
            type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
            allowNull: true,
        },
    }, {
        tableName: "property",
        sequelize,
        timestamps: true,
    });
    return Property;
};
exports.PropertyModel = PropertyModel;
