import { Sequelize, DataTypes, Model } from "sequelize";

export class Property extends Model {
  public id!: number;
  public name!: string;
}

export const PropertyModel = (sequelize: Sequelize) => {
  Property.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      listing_type: {
        type: DataTypes.ENUM("free", "paid"),
        defaultValue: "free",
      },
      property_for: {
        type: DataTypes.ENUM("sale", "rent"),
        defaultValue: "sale",
      },
      owner_ship: {
        type: DataTypes.ENUM(
          "freehold",
          "leasehold",
          "power_of_attorney",
          "cooperative_society"
        ),
        defaultValue: "freehold",
      },
      builder_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      property_type: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      amenities_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      title: {
        type: DataTypes.TEXT,
      },
      unique_selling_point: {
        type: DataTypes.TEXT,
      },
      state: {
        type: DataTypes.STRING,
      },
      city: {
        type: DataTypes.STRING,
      },
      country: {
        type: DataTypes.STRING,
      },
      locality: {
        type: DataTypes.STRING,
      },
      address: {
        type: DataTypes.STRING,
      },
      facing: {
        type: DataTypes.ENUM("east", "west", "north", "south"),
        defaultValue: "north",
      },
      bedroom: {
        type: DataTypes.STRING,
      },
      bathroom: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      balconies: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      floor_no: {
        type: DataTypes.INTEGER,
      },
      total_floor: {
        type: DataTypes.INTEGER,
      },
      furnished_status: {
        type: DataTypes.ENUM("furnished", "semifurnished", "unfurnished"),
        defaultValue: "unfurnished",
      },
      price: {
        type: DataTypes.FLOAT,
      },
      price_per_sqft: {
        type: DataTypes.FLOAT,
      },
      price_negotiable: {
        type: DataTypes.ENUM("yes", "no"),
        defaultValue: "yes",
      },
      price_include: {
        type: DataTypes.ENUM("plc", "car_parking", "club_membership"),
        allowNull: true,
      },
      booking_amount: {
        type: DataTypes.FLOAT,
      },
      other_charge: {
        type: DataTypes.FLOAT,
      },
      maintenance_charge: {
        type: DataTypes.FLOAT,
      },
      maintenance_mode: {
        type: DataTypes.ENUM("monthly", "yearly", "quarterly", "one_time"),
        defaultValue: "monthly",
      },
      area: {
        type: DataTypes.STRING,
      },
      corner_plot: {
        type: DataTypes.ENUM("yes", "no"),
        defaultValue: "no",
      },
      length: {
        type: DataTypes.FLOAT,
      },
      breadth: {
        type: DataTypes.FLOAT,
      },
      is_active: {
        type: DataTypes.ENUM("yes", "no"),
        defaultValue: "yes",
      },
      possession_status: {
        type: DataTypes.ENUM("under_construction", "ready_to_move"),
        defaultValue: "under_construction",
      },
      image: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },
    },
    {
      tableName: "property",
      sequelize,
      timestamps: true,
    }
  );

  return Property;
};
