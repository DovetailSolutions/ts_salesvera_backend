"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingCompanyModel = exports.MeetingCompany = void 0;
const sequelize_1 = require("sequelize");
// import { MeetingCompany } from "../../config/dbConnection";
class MeetingCompany extends sequelize_1.Model {
}
exports.MeetingCompany = MeetingCompany;
const MeetingCompanyModel = (sequelize) => {
    MeetingCompany.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        companyName: {
            type: sequelize_1.DataTypes.STRING,
            field: "company_name",
        },
        meetingUserId: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            field: "meeting_user_id", // 👈 Mapping to the physical DB column
        },
        personName: {
            type: sequelize_1.DataTypes.STRING,
            field: "person_name",
        },
        mobileNumber: {
            type: sequelize_1.DataTypes.STRING,
            field: "mobile_number",
        },
        companyEmail: {
            type: sequelize_1.DataTypes.STRING,
            field: "company_email",
        },
        customerType: {
            type: sequelize_1.DataTypes.ENUM("new", "existing", "followup"),
            defaultValue: "new",
            field: "customer_type",
        },
        state: sequelize_1.DataTypes.STRING,
        city: sequelize_1.DataTypes.STRING,
        country: sequelize_1.DataTypes.STRING,
        remarks: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
        },
        address: sequelize_1.DataTypes.TEXT,
        gstNumber: {
            type: sequelize_1.DataTypes.STRING,
            field: "gst_number",
        },
        quotationNumber: {
            type: sequelize_1.DataTypes.STRING,
            field: "quotation_number",
        },
        pincode: sequelize_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: "meeting_companies",
        timestamps: true,
    });
    return MeetingCompany;
};
exports.MeetingCompanyModel = MeetingCompanyModel;
