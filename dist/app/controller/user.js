"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuotation = exports.getSubCategory = exports.downloadQuotationPdf = exports.getQuotationPdfList = exports.addQuotation = exports.getQuotationPdf = exports.ReFressToken = exports.GetExpense = exports.CreateExpense = exports.LeaveList = exports.requestLeave = exports.AttendanceList = exports.getTodayAttendance = exports.AttendancePunchOut = exports.AttendancePunchIn = exports.getCategory = exports.Logout = exports.scheduled = exports.GetMeetingList = exports.EndMeeting = exports.CreateMeeting = exports.getLastMeeting = exports.MySalePerson = exports.UpdateProfile = exports.GetProfile = exports.Login = exports.Register = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../../config/dbConnection");
const puppeteer_1 = __importDefault(require("puppeteer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
// import logo from "../../../uploads/images/logo.jpeg"
const fs_1 = __importDefault(require("fs"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_2 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const web_1 = require("stream/web");
function getDistance(lat1, lon1, lat2, lon2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in KM
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
const Register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone } = req.body;
        const isExist = yield dbConnection_2.User.findOne({
            where: { phone },
        }); // ✅ pass as an object
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, "Phone number already exists");
        }
        const item = yield dbConnection_2.User.create({
            phone,
            role: "user",
        });
        (0, errorMessage_1.createSuccess)(res, "admin register done", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.Register = Register;
const Login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, deviceToken, devicemodel, devicename, deviceType, deviceId, } = req.body || {};
        if (!email || !password) {
            (0, errorMessage_1.badRequest)(res, "Email and password are required");
            return;
        }
        // ✅ Check if user exists
        const user = yield Middleware.FindByEmail(dbConnection_2.User, email);
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
            return;
        }
        // ✅ Validate password
        const hashedPassword = user.getDataValue("password");
        const isPasswordValid = yield bcrypt_1.default.compare(password, hashedPassword);
        if (!isPasswordValid) {
            (0, errorMessage_1.badRequest)(res, "Invalid email or password");
            web_1.ReadableStreamDefaultController;
        }
        // ✅ Create access & refresh tokens
        const { accessToken, refreshToken } = Middleware.CreateToken(String(user.getDataValue("id")), String(user.getDataValue("role")));
        // ✅ Save refresh token in DB
        yield user.update({ refreshToken });
        if (deviceToken) {
            const existing = yield dbConnection_2.Device.findOne({ where: { deviceToken } });
            if (!existing) {
                yield dbConnection_2.Device.create({
                    userId: user === null || user === void 0 ? void 0 : user.id,
                    deviceToken,
                    deviceType,
                    deviceId,
                    devicemodel,
                    devicename,
                    isActive: true, // ✅ REQUIRED
                });
            }
            else {
                yield existing.update({
                    userId: user.id,
                    deviceType,
                    devicemodel,
                    devicename,
                    deviceId,
                    isActive: true,
                });
            }
        }
        const userData = user.toJSON();
        delete userData.password;
        // delete userData.refreshToken;
        // delete userData.createdAt;
        // delete userData.updatedAt;
        const enrichedUser = Object.assign(Object.assign({}, userData), { city: "Zirakpur", state: "Punjab", country: "India" });
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            accessToken,
            refreshToken,
            user: enrichedUser
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.Login = Login;
const GetProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const item = yield Middleware.getById(dbConnection_2.User, Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "user details", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.GetProfile = GetProfile;
const UpdateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { firstName, lastName } = req.body || {};
        // ✅ Build update object dynamically
        const updates = {};
        if (firstName)
            updates.firstName = firstName;
        if (lastName)
            updates.lastName = lastName;
        // ✅ File upload (Multer-S3 case)
        if (req.file && req.file.location) {
            updates.profile = req.file.location;
        }
        // ✅ No valid field to update
        if (Object.keys(updates).length === 0) {
            (0, errorMessage_1.badRequest)(res, "No valid fields provided to update");
            return;
        }
        // ✅ Run update
        const updatedUser = yield Middleware.Update(dbConnection_2.User, Number(userData.userId), updates);
        if (!updatedUser) {
            (0, errorMessage_1.badRequest)(res, "User not found");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Profile updated successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.UpdateProfile = UpdateProfile;
const MySalePerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const userData = req.userData;
        /** ✅ Search condition */
        const where = {};
        if (search) {
            where[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        /** ✅ Fetch created users */
        const result = yield dbConnection_2.User.findByPk(userData.userId, {
            include: [
                {
                    model: dbConnection_2.User,
                    as: "createdUsers",
                    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
                    through: { attributes: [] },
                    where, // ✅ apply search
                    required: false, // ✅ so user must exist even if none found
                },
            ],
        });
        if (!result) {
            (0, errorMessage_1.badRequest)(res, "User not found");
        }
        /** ✅ Extract created users */
        // let createdUsers = result?.createdUsers || [];
        let createdUsers = (result === null || result === void 0 ? void 0 : result.createdUsers) || [];
        /** ✅ Pagination manually */
        const total = createdUsers.length;
        createdUsers = createdUsers.slice(offset, offset + limitNum);
        (0, errorMessage_1.createSuccess)(res, "My sale persons", {
            page: pageNum,
            limit: limitNum,
            total,
            rows: createdUsers,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.MySalePerson = MySalePerson;
// export const CreateMeeting = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const finalUserId = userData?.userId;
//     const isExist = await Meeting.findOne({
//       where: {
//         userId: finalUserId,
//         status: "in", // You wrote "in" but in schema you used: pending | completed | cancelled
//       },
//     });
//     /** ✅ If active meeting exists → Stop */
//     if (isExist) {
//       badRequest(
//         res,
//         `You already have an active meeting started at ${isExist.meetingTimeIn}`
//       );
//       return;
//     }
//     const {
//       companyName,
//       personName,
//       mobileNumber,
//       customerType,
//       companyEmail,
//       meetingPurpose,
//       categoryId,
//       status,
//       latitude_in,
//       longitude_in,
//       meetingTimeIn,
//       scheduledTime,
//     } = req.body || {};
//     /** ✅ Required fields validation */
//     const requiredFields: Record<string, any> = {
//       companyName,
//       personName,
//       mobileNumber,
//       customerType,
//       meetingPurpose,
//       categoryId,
//       status,
//       // latitude_in,
//       // longitude_in,
//       // meetingTimeIn,
//     };
//     for (const key in requiredFields) {
//       if (!requiredFields[key]) {
//         badRequest(res, `${key} is required`);
//         return;
//       }
//     }
//     /** ✅ userId priority: req.body → token */
//     if (!finalUserId) {
//       badRequest(res, "userId is required");
//       return;
//     }
//     const isExists =  await Meeting.findOne({where:{companyName,personName,mobileNumber,companyEmail}})
//     /** ✅ Prepare payload */
//     const payload: any = {
//       companyName,
//       personName,
//       companyEmail,
//       mobileNumber,
//       customerType,
//       meetingPurpose,
//       categoryId,
//       status,
//       userId: finalUserId,
//     };
//     const files = req.files as Express.MulterS3.File[];
//     if(isExists){
//       payload.customerType = isExists.customerType
//     }
//     if (files?.length > 0) {
//       payload.image = files.map((file) => file.location);
//     }
//     if (meetingTimeIn) {
//       payload.meetingTimeIn = meetingTimeIn;
//     }
//     if (latitude_in) {
//       payload.latitude_in = latitude_in;
//     }
//     if (longitude_in) {
//       payload.longitude_in = longitude_in;
//     }
//     if (scheduledTime) {
//       payload.scheduledTime = scheduledTime;
//     }
//     /** ✅ Save data */
//     const item = await Middleware.CreateData(Meeting, payload);
//     if(isExists){
//       createSuccess(res, "Meeting successfully added/user already exist",item);
//     }else{
//       createSuccess(res, "Meeting successfully added", item);
//     }
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const getLastMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { page = 1, limit = 10, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const whereCondition = {
        // Filter out records so it only shows users that actually had meetings with `finalUserId`
        // We do this dynamically via the nested Include "required" so the global query doesn't fail if the client was met by multiple employees.
        };
        // Client/MeetingUser search logic
        if (search) {
            whereCondition[sequelize_1.Op.or] = [
                { name: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { mobile: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        // company search logic
        const companyWhereCondition = {};
        // if (search) {
        //   companyWhereCondition[Op.or] = [
        //     { companyName: { [Op.iLike]: `%${search}%` } },
        //     { personName: { [Op.iLike]: `%${search}%` } },
        //     { companyEmail: { [Op.iLike]: `%${search}%` } },
        //     { mobileNumber: { [Op.iLike]: `%${search}%` } },
        //   ];
        // }
        // Employee relation tracking
        const meetingWhereCondition = { userId: finalUserId };
        const { rows, count } = yield dbConnection_2.MeetingUser.findAndCountAll({
            where: Object.keys(whereCondition).length ? whereCondition : undefined,
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: dbConnection_2.MeetingCompany, // Include their associated companies
                    required: false,
                    include: [
                        {
                            model: dbConnection_2.Meeting,
                            where: meetingWhereCondition, // Only fetch meetings that belong to the logged-in employee
                            required: true,
                            include: [
                                {
                                    model: dbConnection_2.MeetingImage
                                }
                            ]
                        }
                    ]
                }
            ],
            distinct: true,
        });
        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalRecords: count,
                totalPages: Math.ceil(count / Number(limit)),
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getLastMeeting = getLastMeeting;
const CreateMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const transaction = yield dbConnection_1.sequelize.transaction();
    try {
        const userData = req.userData;
        const tokenUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        let { userName, userMobile, userEmail, companyName, personName, mobileNumber, customerType, companyEmail, meetingPurpose, categoryId, status, latitude_in, longitude_in, meetingTimeIn, scheduledTime, state, city, country, address } = req.body || {};
        // Trim all string inputs to avoid trailing space errors in enums
        if (typeof customerType === "string")
            customerType = customerType.trim();
        if (typeof meetingPurpose === "string")
            meetingPurpose = meetingPurpose.trim();
        if (typeof status === "string")
            status = status.trim();
        if (typeof companyName === "string")
            companyName = companyName.trim();
        if (typeof personName === "string")
            personName = personName.trim();
        if (typeof mobileNumber === "string")
            mobileNumber = mobileNumber.trim();
        if (typeof companyEmail === "string")
            companyEmail = companyEmail.trim();
        /** Required fields */
        const requiredFields = {
            // userMobile,  <-- Usually optional if they are a new lead
            companyName,
            personName,
            mobileNumber,
            meetingPurpose,
            categoryId,
            status,
        };
        for (const key in requiredFields) {
            if (!requiredFields[key]) {
                yield transaction.rollback();
                (0, errorMessage_1.badRequest)(res, `${key} is required`);
                return;
            }
        }
        const finalUserId = tokenUserId;
        /** --------------------------
         * 1️⃣ Check / Store the Person we are meeting (MeetingUser)
         * This acts as an address book for the Employee's external clients
         * -------------------------- */
        let meetingContactUser = null;
        // Use the explicit userMobile if provided, otherwise fallback to the company mobileNumber
        const contactMobile = userMobile || mobileNumber;
        const contactName = userName || personName;
        const contactEmail = userEmail;
        if (contactMobile) {
            meetingContactUser = yield dbConnection_2.MeetingUser.findOne({
                where: Object.assign(Object.assign({ mobile: contactMobile }, (contactEmail && { email: contactEmail })), (contactName && { name: contactName })),
            });
            if (!meetingContactUser) {
                meetingContactUser = yield dbConnection_2.MeetingUser.create({
                    name: contactName,
                    mobile: contactMobile,
                    email: contactEmail,
                    userId: finalUserId
                }, { transaction });
            }
        }
        /** --------------------------
         * 2️⃣ Check Active Meeting
         * -------------------------- */
        const activeMeeting = yield dbConnection_2.Meeting.findOne({
            where: {
                userId: finalUserId,
                status: "in",
            },
        });
        if (activeMeeting) {
            yield transaction.rollback();
            (0, errorMessage_1.badRequest)(res, `You already have an active meeting started at ${activeMeeting.meetingTimeIn}`);
            return;
        }
        /** --------------------------
         * 3️⃣ Find or Create Company
         * -------------------------- */
        let company = yield dbConnection_2.MeetingCompany.findOne({
            where: {
                companyName,
                personName,
                mobileNumber,
                companyEmail,
            },
        });
        if (!company) {
            company = yield dbConnection_2.MeetingCompany.create({
                companyName,
                personName,
                mobileNumber,
                companyEmail,
                customerType,
                state,
                city,
                country,
                address,
                meetingUserId: meetingContactUser === null || meetingContactUser === void 0 ? void 0 : meetingContactUser.id, // Link to Client
            }, { transaction });
        }
        /** --------------------------
         * 4️⃣ Create Meeting
         * -------------------------- */
        // Helper to safely parse dates and avoid "Invalid date" DB crash
        const parseDateSafely = (dateStr) => {
            if (!dateStr || dateStr === "Invalid date")
                return undefined;
            const parsed = new Date(dateStr);
            return isNaN(parsed.getTime()) ? undefined : parsed;
        };
        const validMeetingTimeIn = parseDateSafely(meetingTimeIn);
        const validScheduledTime = parseDateSafely(scheduledTime);
        const meeting = yield dbConnection_2.Meeting.create({
            userId: finalUserId,
            meetingUserId: meetingContactUser === null || meetingContactUser === void 0 ? void 0 : meetingContactUser.id,
            companyId: company.id,
            meetingPurpose,
            categoryId,
            status,
            meetingTimeIn: validMeetingTimeIn,
            latitude_in,
            longitude_in,
            scheduledTime: validScheduledTime,
        }, { transaction });
        /** --------------------------
         * 5️⃣ Save Images
         * -------------------------- */
        const files = req.files;
        if (files === null || files === void 0 ? void 0 : files.length) {
            const images = files.map((file) => ({
                meetingId: meeting.id,
                meetingUserId: meetingContactUser === null || meetingContactUser === void 0 ? void 0 : meetingContactUser.id, // Link to Client
                image: file.location,
            }));
            yield dbConnection_2.MeetingImage.bulkCreate(images, { transaction });
        }
        yield transaction.commit();
        (0, errorMessage_1.createSuccess)(res, "Meeting successfully created", meeting);
    }
    catch (error) {
        yield transaction.rollback();
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.CreateMeeting = CreateMeeting;
const EndMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { meetingId, latitude_out, longitude_out, remarks } = req.body || {};
        // ✅ Validations
        if (!meetingId) {
            (0, errorMessage_1.badRequest)(res, "meetingId is required");
            return;
        }
        if (!latitude_out || !longitude_out) {
            (0, errorMessage_1.badRequest)(res, "latitude_out and longitude_out are required");
            return;
        }
        // ✅ Check meeting exists and is active
        const isExist = yield dbConnection_2.Meeting.findOne({
            where: {
                id: meetingId,
                userId: finalUserId,
                status: "in",
            },
        });
        if (!isExist) {
            (0, errorMessage_1.badRequest)(res, "No active meeting found with this meetingId");
            return;
        }
        // ✅ Update remarks if provided
        if (remarks) {
            const company = yield dbConnection_2.MeetingCompany.findByPk(isExist.companyId);
            if (company)
                yield company.update({ remarks });
        }
        // ✅ Mark meeting as ended
        isExist.status = "out";
        isExist.latitude_out = latitude_out;
        isExist.longitude_out = longitude_out;
        isExist.meetingTimeOut = new Date();
        yield isExist.save();
        // ✅ Day range
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        // ✅ Get today's attendance (starting point)
        const attendance = yield dbConnection_2.Attendance.findOne({
            where: {
                employee_id: finalUserId,
                date: { [sequelize_1.Op.between]: [startOfDay, endOfDay] },
            },
            attributes: ["id", "latitude_in", "longitude_in"],
        });
        // ✅ Get all OTHER completed meetings today (excluding current)
        const previousMeetings = yield dbConnection_2.Meeting.findAll({
            where: {
                userId: finalUserId,
                status: "out",
                id: { [sequelize_1.Op.ne]: isExist.id },
                meetingTimeOut: { [sequelize_1.Op.between]: [startOfDay, endOfDay] },
            },
            attributes: ["id", "latitude_out", "longitude_out", "meetingTimeOut", "legDistance"],
            order: [["meetingTimeOut", "ASC"]],
        });
        // ✅ Calculate leg distance (previous point → this meeting)
        let legDistance = 0;
        if (previousMeetings.length === 0) {
            // First meeting of the day → distance from attendance check-in
            if ((attendance === null || attendance === void 0 ? void 0 : attendance.latitude_in) &&
                (attendance === null || attendance === void 0 ? void 0 : attendance.longitude_in) &&
                isExist.latitude_out &&
                isExist.longitude_out) {
                const lat1 = parseFloat(attendance.latitude_in);
                const lon1 = parseFloat(attendance.longitude_in);
                const lat2 = parseFloat(isExist.latitude_out);
                const lon2 = parseFloat(isExist.longitude_out);
                if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                    legDistance = getDistance(lat1, lon1, lat2, lon2);
                }
            }
        }
        else {
            // Nth meeting → distance from last completed meeting
            const lastMeeting = previousMeetings[previousMeetings.length - 1];
            if (lastMeeting.latitude_out &&
                lastMeeting.longitude_out &&
                isExist.latitude_out &&
                isExist.longitude_out) {
                const lat1 = parseFloat(lastMeeting.latitude_out);
                const lon1 = parseFloat(lastMeeting.longitude_out);
                const lat2 = parseFloat(isExist.latitude_out);
                const lon2 = parseFloat(isExist.longitude_out);
                if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                    legDistance = getDistance(lat1, lon1, lat2, lon2);
                }
            }
        }
        // ✅ Sum all previous leg distances + current leg = total for the day
        const previousTotal = previousMeetings.reduce((sum, m) => {
            const leg = parseFloat(m.legDistance || "0");
            return sum + (isNaN(leg) ? 0 : leg);
        }, 0);
        const totalDistance = previousTotal + legDistance;
        // ✅ Save leg + total on current meeting
        isExist.legDistance = legDistance.toFixed(2).toString();
        isExist.totalDistance = totalDistance.toFixed(2).toString();
        yield isExist.save();
        (0, errorMessage_1.createSuccess)(res, "Meeting ended successfully", {
            meetingId: isExist.id,
            legDistance: `${isExist.legDistance} km`, // e.g. "7.00 km"  (M1 → M2)
            totalDistance: `${isExist.totalDistance} km`, // e.g. "12.00 km" (A → M1 → M2)
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.EndMeeting = EndMeeting;
// export const EndMeeting = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const finalUserId = userData?.userId;
//     const { meetingId, latitude_out, longitude_out, remarks } = req.body || {};
//     if (!meetingId) {
//       badRequest(res, "meetingId is required");
//       return;
//     }
//     if (!latitude_out || !longitude_out) {
//       badRequest(res, "latitude_out and longitude_out are required to end a meeting");
//       return;
//     }
//     /** ✅ Check meeting exist for this user & active */
//     const isExist = await Meeting.findOne({
//       where: {
//         id: meetingId,
//         userId: finalUserId,
//         status: "in",
//       },
//     });
//     if (!isExist) {
//       badRequest(res, "No active meeting found with this meetingId");
//       return;
//     }
//     // Since remarks is on the meeting_companies table (not Meetings), we need to update it there
//     if (remarks) {
//       const company = await MeetingCompany.findByPk(isExist.companyId);
//       if (company) {
//         await company.update({ remarks });
//       }
//     }
//     // /** ✅ Update meeting */
//     isExist.status = "out"; // Use 'out' as per schema instead of 'completed'
//     isExist.latitude_out = latitude_out;
//     isExist.longitude_out = longitude_out;
//     isExist.meetingTimeOut = new Date();
//     await isExist.save();
//     const startOfDay = new Date();
//     startOfDay.setHours(0, 0, 0, 0);
//     const endOfDay = new Date();
//     endOfDay.setHours(23, 59, 59, 999);
//     const attendance = await Attendance.findOne({
//       where: {
//         employee_id: finalUserId,
//         date: {
//           [Op.between]: [startOfDay, endOfDay],
//         },
//       },
//       attributes:["id","latitude_in","longitude_in"]
//     });
//     // console.log("attendance",attendance)
//     const item = await Meeting.findAll({  
//       where: {
//         userId: finalUserId,
//         // status: "in",
//         createdAt: {
//           [Op.between]: [startOfDay, endOfDay],
//         },
//       },
//       attributes:["id","latitude_out","longitude_out"]
//     });
//   if (!item.length) {
//      createSuccess(res, "Meeting ended successfully", []);
//   }
//       let totalDistance = 0;
//     for (let i = 1; i < item.length; i++) {
//       const prev = item[i - 1];
//       const curr = item[i];
//       const lat1 = parseFloat(prev.latitude_out);
//       const lon1 = parseFloat(prev.longitude_out);
//       const lat2 = parseFloat(curr.latitude_out);
//       const lon2 = parseFloat(curr.longitude_out);
//       // skip invalid data
//       if (!lat1 || !lon1 || !lat2 || !lon2) continue;
//       const distance = getDistance(lat1, lon1, lat2, lon2);
//       totalDistance += distance;
//     }
//     isExist.totalDistance = totalDistance.toString();
//     await isExist.save();
//     createSuccess(res, "Meeting ended successfully", item);
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
// export const EndMeeting = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const finalUserId = userData?.userId;
//     const { meetingId, latitude_out, longitude_out, remarks } = req.body || {};
//     if (!meetingId) {
//       badRequest(res, "meetingId is required");
//       return;
//     }
//     if (!latitude_out || !longitude_out) {
//       badRequest(res, "latitude_out and longitude_out are required to end a meeting");
//       return;
//     }
//     /** ✅ Check meeting exist for this user & active */
//     const isExist = await Meeting.findOne({
//       where: {
//         id: meetingId,
//         userId: finalUserId,
//         status: "in",
//       },
//     });
//     if (!isExist) {
//       badRequest(res, "No active meeting found with this meetingId");
//       return;
//     }
//     // Update remarks on meeting_companies table
//     if (remarks) {
//       const company = await MeetingCompany.findByPk(isExist.companyId);
//       if (company) {
//         await company.update({ remarks });
//       }
//     }
//     // ✅ Update current meeting as ended
//     isExist.status = "out";
//     isExist.latitude_out = latitude_out;
//     isExist.longitude_out = longitude_out;
//     isExist.meetingTimeOut = new Date();
//     await isExist.save();
//     // ✅ Day range
//     const startOfDay = new Date();
//     startOfDay.setHours(0, 0, 0, 0);
//     const endOfDay = new Date();
//     endOfDay.setHours(23, 59, 59, 999);
//     // ✅ Fetch today's attendance (starting point)
//     const attendance = await Attendance.findOne({
//       where: {
//         employee_id: finalUserId,
//         date: { [Op.between]: [startOfDay, endOfDay] },
//       },
//       attributes: ["id", "latitude_in", "longitude_in"],
//     });
//     // ✅ Fetch ALL completed meetings today, ordered by time
//     //    Use findAll (not findOne) so we get an array
//     const todayMeetings = await Meeting.findAll({
//       where: {
//         userId: finalUserId,
//         status: "out", // only completed meetings have latitude_out
//         meetingTimeOut: { [Op.between]: [startOfDay, endOfDay] },
//       },
//       attributes: ["id", "latitude_out", "longitude_out", "meetingTimeOut"],
//       order: [["meetingTimeOut", "ASC"]], // sort chronologically
//     });
//     if (!todayMeetings.length) {
//       createSuccess(res, "Meeting ended successfully", []);
//       return; // ✅ was missing return — code would continue after this
//     }
//     let totalDistance = 0;
//     /**
//      * Distance chain:
//      *
//      *  Attendance (check-in location)
//      *       ↓
//      *   Meeting 1 (latitude_out / longitude_out)
//      *       ↓
//      *   Meeting 2 (latitude_out / longitude_out)
//      *       ↓
//      *   Meeting N ...
//      *
//      * If attendance exists → first leg is attendance → meeting1
//      * Otherwise           → first leg is meeting1 → meeting2
//      */
//     if (attendance && attendance.latitude_in && attendance.longitude_in) {
//       // Leg 0: attendance check-in → first meeting end point
//       const lat1 = parseFloat(attendance.latitude_in);
//       const lon1 = parseFloat(attendance.longitude_in);
//       const lat2 = parseFloat(todayMeetings[0].latitude_out);
//       const lon2 = parseFloat(todayMeetings[0].longitude_out);
//       if (lat1 && lon1 && lat2 && lon2) {
//         totalDistance += getDistance(lat1, lon1, lat2, lon2);
//       }
//     }
//     // Legs between consecutive meetings: meeting[i-1] → meeting[i]
//     for (let i = 1; i < todayMeetings.length; i++) {
//       const prev = todayMeetings[i - 1];
//       const curr = todayMeetings[i];
//       const lat1 = parseFloat(prev.latitude_out);
//       const lon1 = parseFloat(prev.longitude_out);
//       const lat2 = parseFloat(curr.latitude_out);
//       const lon2 = parseFloat(curr.longitude_out);
//       if (!lat1 || !lon1 || !lat2 || !lon2) continue; // skip invalid GPS
//       totalDistance += getDistance(lat1, lon1, lat2, lon2);
//     }
//     // ✅ Save total distance on the meeting that was just ended
//     isExist.totalDistance = totalDistance.toFixed(2).toString(); // e.g. "12.34"
//     await isExist.save();
//     createSuccess(res, "Meeting ended successfully", todayMeetings);
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
const GetMeetingList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, search = "", status } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!finalUserId) {
            (0, errorMessage_1.badRequest)(res, "UserId not found");
            return;
        }
        /** ✅ Search condition */
        const where = {
            userId: finalUserId,
        };
        if (search) {
            where[sequelize_1.Op.or] = [
                { companyName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { personName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { mobileNumber: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { remarks: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        if (status) {
            where.status = status;
        }
        /** ✅ Query with pagination + count */
        const { rows, count } = yield dbConnection_2.MeetingUser.findAndCountAll({
            where: where,
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: dbConnection_2.MeetingCompany, // Include their associated companies
                    required: false,
                    include: [
                        {
                            model: dbConnection_2.Meeting,
                            where: where, // Only fetch meetings that belong to the logged-in employee
                            required: true,
                            include: [
                                {
                                    model: dbConnection_2.MeetingImage
                                }
                            ]
                        }
                    ]
                }
            ],
            distinct: true,
        });
        /** ✅ Pagination Info */
        const pageInfo = {
            currentPage: pageNum,
            pageSize: limitNum,
            totalItems: count,
            totalPages: Math.ceil(count / limitNum),
        };
        (0, errorMessage_1.createSuccess)(res, "Meeting list fetched", { pageInfo, data: rows });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.GetMeetingList = GetMeetingList;
const scheduled = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { meetingId, latitude_in, longitude_in } = req.body || {};
        if (!meetingId) {
            (0, errorMessage_1.badRequest)(res, "meetingId is required");
            return;
        }
        if (!latitude_in && longitude_in) {
            (0, errorMessage_1.badRequest)(res, "latitude_in && longitude_in is required");
            return;
        }
        /** ✅ Check meeting exist for this user & active */
        const isExist = yield dbConnection_2.Meeting.findOne({
            where: {
                id: meetingId,
                userId: finalUserId,
                status: "scheduled",
            },
        });
        if (!isExist) {
            (0, errorMessage_1.badRequest)(res, "No scheduled meeting found with this meetingId");
            return;
        }
        /** ✅ Update meeting */
        isExist.status = "in";
        isExist.latitude_in = latitude_in !== null && latitude_in !== void 0 ? latitude_in : null;
        isExist.longitude_in = longitude_in !== null && longitude_in !== void 0 ? longitude_in : null;
        isExist.meetingTimeIn = new Date();
        yield isExist.save();
        (0, errorMessage_1.createSuccess)(res, "Meeting successfully start", isExist);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.scheduled = scheduled;
const Logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { deviceId } = req.body;
        if (!deviceId) {
            (0, errorMessage_1.badRequest)(res, "device token is missing");
        }
        yield dbConnection_2.Device.destroy({ where: { deviceId } });
        (0, errorMessage_1.createSuccess)(res, "logout sussfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.Logout = Logout;
const getCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.query;
        const item = yield Middleware.getAllListCategory(dbConnection_2.Category, data);
        (0, errorMessage_1.createSuccess)(res, "get all category", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.getCategory = getCategory;
const AttendancePunchIn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { punch_in, latitude_in, longitude_in } = req.body || {};
        if (!punch_in) {
            (0, errorMessage_1.badRequest)(res, "Punch-in time is required");
            return;
        }
        // 1) ✅ Check if already punched in today
        const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
        const already = yield dbConnection_2.Attendance.findOne({
            where: {
                employee_id: finalUserId,
                date: today,
            },
        });
        if (already) {
            (0, errorMessage_1.badRequest)(res, "You have already punched-in today");
            return;
        }
        // 2) ✅ Calculate Late
        const officeTime = new Date(`${today} 09:30:00`);
        const punchInTime = new Date(punch_in);
        let late = false;
        if (punchInTime > officeTime) {
            late = true;
        }
        // 3) ✅ Create attendance record
        const obj = {
            employee_id: finalUserId,
            date: today,
            punch_in: punchInTime,
            status: "present",
            late,
            latitude_in,
            longitude_in,
        };
        const item = yield dbConnection_2.Attendance.create(obj);
        (0, errorMessage_1.createSuccess)(res, "Punch-in recorded successfully", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.AttendancePunchIn = AttendancePunchIn;
const AttendancePunchOut = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { punch_out, AttendanceId, latitude_out, longitude_out } = req.body || {};
        if (!punch_out) {
            (0, errorMessage_1.badRequest)(res, "Punch-out time is required");
            return;
        }
        const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
        // ✅ Find today's punch-in record
        const attendance = yield dbConnection_2.Attendance.findOne({
            where: {
                employee_id: finalUserId,
                date: today,
                id: AttendanceId,
            },
        });
        if (!attendance) {
            (0, errorMessage_1.badRequest)(res, "No punch-in record found today");
            return;
        }
        // ✅ Check if already punched-out
        if (attendance.punch_out) {
            (0, errorMessage_1.badRequest)(res, "Already punched-out today");
            return;
        }
        const punchInTime = new Date(attendance.punch_in);
        const punchOutTime = new Date(punch_out);
        if (punchOutTime < punchInTime) {
            (0, errorMessage_1.badRequest)(res, "Punch-out must be after punch-in");
            return;
        }
        // ✅ Calculate working hours
        const diffMs = punchOutTime.getTime() - punchInTime.getTime();
        const workingHours = diffMs / (1000 * 60 * 60); // ms → hours
        const workingHoursRounded = Number(workingHours.toFixed(2));
        // ✅ Overtime (optional)
        const officeHours = 8; // Standard
        const overtime = workingHoursRounded > officeHours
            ? Number((workingHoursRounded - officeHours).toFixed(2))
            : 0;
        // ✅ Update DB
        attendance.punch_out = punchOutTime;
        attendance.working_hours = workingHoursRounded;
        attendance.overtime = overtime;
        attendance.latitude_out = latitude_out;
        attendance.longitude_out = longitude_out;
        yield attendance.save();
        (0, errorMessage_1.createSuccess)(res, "Punch-out completed");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.AttendancePunchOut = AttendancePunchOut;
const getTodayAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        // const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
        const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
        const record = yield dbConnection_2.Attendance.findOne({
            where: {
                employee_id: finalUserId,
                [sequelize_1.Op.and]: (0, sequelize_1.where)((0, sequelize_1.fn)("DATE", (0, sequelize_1.col)("date")), today),
            },
        });
        if (!record) {
            (0, errorMessage_1.badRequest)(res, "No attendance found for today");
            return;
        }
        (0, errorMessage_1.createSuccess)(res, "Today attendance fetched", record);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getTodayAttendance = getTodayAttendance;
const AttendanceList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const data = req.query;
        const item = yield Middleware.withuserlogin(dbConnection_2.Attendance, finalUserId, data);
        (0, errorMessage_1.createSuccess)(res, "bbkbdkfbkd", item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.AttendanceList = AttendanceList;
const requestLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const { from_date, to_date, reason, leave_type } = req.body || {};
        // --------------------
        // ✅ Basic Validation
        // --------------------
        if (!from_date || !to_date || !reason) {
            (0, errorMessage_1.badRequest)(res, "from_date, to_date & reason are required");
            return;
        }
        const from = new Date(from_date);
        const to = new Date(to_date);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            (0, errorMessage_1.badRequest)(res, "Invalid date format");
            return;
        }
        if (to < from) {
            (0, errorMessage_1.badRequest)(res, "to_date must be after from_date");
            return;
        }
        // --------------------
        // ✅ Create Leave Request
        // --------------------
        const leave = yield dbConnection_2.Leave.create({
            employee_id: finalUserId,
            from_date: from,
            to_date: to,
            reason,
            status: "pending",
            leave_type
        });
        // --------------------
        // ✅ Insert Attendance Entry (1 entry per request)
        // --------------------
        if (leave) {
            yield dbConnection_2.Attendance.create({
                employee_id: finalUserId,
                date: from,
                punch_in: to,
                status: "leave",
            });
        }
        (0, errorMessage_1.createSuccess)(res, "Leave requested successfully", leave);
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, (error === null || error === void 0 ? void 0 : error.message) || "Something went wrong");
    }
});
exports.requestLeave = requestLeave;
const LeaveList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const result = yield dbConnection_2.Leave.findAndCountAll({
            where: {
                employee_id: finalUserId,
            },
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        const response = {
            totalRecords: result.count,
            totalPages: Math.ceil(result.count / limit),
            currentPage: page,
            data: result.rows,
        };
        (0, errorMessage_1.createSuccess)(res, "Leave list", response);
    }
    catch (error) {
        (0, errorMessage_1.badRequest)(res, (error === null || error === void 0 ? void 0 : error.message) || "Something went wrong");
    }
});
exports.LeaveList = LeaveList;
// export const CreateExpense = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const finalUserId = userData?.userId;
//     if (!finalUserId) {
//       badRequest(res, "Invalid user");
//       return;
//     }
//     const { title, total_amount, date, category, amount, description, location } = req.body ?? {};
//     // Keep title as required for backward compatibility, or you can adjust this
//     if (!title && !description) {
//       badRequest(res, "Title or Description is required");
//       return;
//     }
//     const payload: any = {
//       userId: finalUserId,
//       title: title || description,
//       total_amount: total_amount || amount,
//       date,
//       category,
//       amount: amount || total_amount,
//       description: description || title,
//       location
//     };
//     // ✅ files from multer (S3 upload)
//     const files = req.files as Express.MulterS3.File[];
//     if (Array.isArray(files) && files.length > 0) {
//       payload.billImage = files.map((file) => file.location);
//     }
//     // ✅ Create entry
//     const created = await Expense.create(payload);
//     createSuccess(res, "Expense added successfully", created);
//   } catch (error) {
//     console.error("Error in CreateExpense:", error);
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//     return;
//   }
// };
const CreateExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const transaction = yield dbConnection_1.sequelize.transaction();
    try {
        const userId = (_a = req.userData) === null || _a === void 0 ? void 0 : _a.userId;
        let expenses = req.body.expenses || req.body;
        if (typeof expenses === "string") {
            expenses = JSON.parse(expenses);
        }
        if (!Array.isArray(expenses)) {
            throw new Error("Expenses must be an array");
        }
        const files = req.files;
        const imageMap = {};
        if (files && files.length > 0) {
            files.forEach((file) => {
                const match = file.fieldname.match(/expenses\[(\d+)\]\[billImage\]/);
                if (match) {
                    const index = Number(match[1]);
                    if (!imageMap[index]) {
                        imageMap[index] = [];
                    }
                    imageMap[index].push(file.originalname);
                }
            });
        }
        const createdExpenses = [];
        for (let i = 0; i < expenses.length; i++) {
            const item = expenses[i];
            const expense = yield dbConnection_2.Expense.create({
                userId,
                title: item.title,
                total_amount: item.total_amount,
                amount: item.amount,
                date: item.date,
                category: item.category,
                description: item.description,
                location: item.location
            }, { transaction });
            const images = imageMap[i] || [];
            if (images.length > 0) {
                const payload = images.map((url) => ({
                    expenseId: expense.id,
                    imageUrl: url
                }));
                yield dbConnection_2.ExpenseImage.bulkCreate(payload, { transaction });
            }
            createdExpenses.push(expense);
        }
        yield transaction.commit();
        res.status(201).json({
            success: true,
            message: "Expenses created successfully",
            data: createdExpenses
        });
    }
    catch (error) {
        yield transaction.rollback();
        console.error("============= CREATE EXPENSE ERROR =============");
        console.error(error);
        console.error("================================================");
        res.status(400).json({
            success: false,
            message: "Failed to create expenses",
            error: error instanceof Error ? error.message : error
        });
    }
});
exports.CreateExpense = CreateExpense;
const GetExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!finalUserId) {
            (0, errorMessage_1.badRequest)(res, "Invalid user");
            return;
        }
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const result = yield dbConnection_2.Expense.findAndCountAll({
            where: {
                userId: finalUserId,
            },
            limit,
            offset,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: dbConnection_2.ExpenseImage,
                    as: "images",
                },
            ],
            distinct: true,
        });
        const response = {
            totalRecords: result.count,
            totalPages: Math.ceil(result.count / limit),
            currentPage: page,
            data: result.rows,
        };
        (0, errorMessage_1.createSuccess)(res, "Expense list", response);
    }
    catch (error) {
        console.error("Error in GetExpense:", error);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.GetExpense = GetExpense;
const ReFressToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const user = yield dbConnection_2.User.findByPk(userData.userId);
        if (!user) {
            (0, errorMessage_1.badRequest)(res, "User not found");
            return;
        }
        const { accessToken, refreshToken } = Middleware.CreateToken(String(user.getDataValue("id")), String(user.getDataValue("role")));
        // update refresh token in DB
        user.setDataValue("refreshToken", refreshToken); // or user.refreshToken = refreshToken;
        yield user.save();
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            token: accessToken,
            refreshToken: refreshToken,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.ReFressToken = ReFressToken;
// export const getQuotation = async (req: Request, res: Response): Promise<void> => {
//   try {
//     // const userData = req.userData as JwtPayload;
//     // if (!userData || !userData.userId) {
//     //   badRequest(res, "Unauthorized request");
//     //   return;
//     // }
//     const { page = 1, limit = 10 } = req.query;
//     const pageNumber = Number(page);
//     const pageSize = Number(limit);
//     const offset = (pageNumber - 1) * pageSize;
//     const { count, rows } = await Quotation.findAndCountAll({
//       where: {
//         // userId: userData.userId
//       },
//       order: [["createdAt", "DESC"]],
//       limit: pageSize,
//       offset: offset
//     });
//     createSuccess(res, "Quotation list fetched successfully", {
//       total: count,
//       page: pageNumber,
//       totalPages: Math.ceil(count / pageSize),
//       data: rows
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage, error);
//   }
// };
// export const getQuotationPdf = async (req: Request, res: Response): Promise<void> => {
//   try {
//       const userData = req.userData as JwtPayload;
//     if (!userData || !userData.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const data = req.body;
//     // ✅ Helper: read local file → base64 data URI (works with Puppeteer setContent)
//     const toBase64 = (filePath: string): string => {
//       try {
//         if (fs.existsSync(filePath)) {
//           const ext = filePath.split(".").pop()?.toLowerCase();
//           const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
//           const buf = fs.readFileSync(filePath);
//           return `data:${mime};base64,${buf.toString("base64")}`;
//         }
//       } catch (_) {}
//       return "";
//     };
//     const logo      = toBase64(path.join(__dirname, "../../../uploads/images/logo.jpeg"));
//     const signature = toBase64(path.join(__dirname, "../../../uploads/signature.png"));
//     const stamp     = toBase64(path.join(__dirname, "../../../uploads/stamp.png"));
//     // ✅ Calculations
//     const subtotal = data.items.reduce((sum: number, item: any) => {
//       return sum + Number(item.amount || 0);
//     }, 0);
//     const discount = Number(data.discount || 0);
//     const taxableAmount = subtotal - discount;
//     const gstAmount = (taxableAmount * Number(data.gstRate || 0)) / 100;
//     const finalAmount = taxableAmount + gstAmount;
//     // ✅ Render EJS
//     const filePath = path.join(__dirname, "../../ejs/preview.ejs");
//     const html = await ejs.renderFile(filePath, {
//       ...data,
//       logo,
//       signature,
//       stamp,
//       subtotal,
//       discount,
//       taxableAmount,
//       gstAmount,
//       finalAmount
//     });
//     // ✅ SAVE TO DB HERE
// await Quotations.create({
//   userId: Number(userData?.userId),
//   companyId: data.companyId || 0,
//   quotation: data,
//   status: "draft"
// });
//     // ✅ Puppeteer
//     const browser = await puppeteer.launch({
//       args: ["--no-sandbox", "--disable-setuid-sandbox"]
//     });
//     const page = await browser.newPage();
//     await page.setContent(html as string, { waitUntil: "load" });
//     const pdfBuffer = await page.pdf({
//       format: "a4",
//       printBackground: true,
//       margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
//     });
//     await browser.close();
//     res.set({
//       "Content-Type": "application/pdf",
//       "Content-Disposition": `attachment; filename=quotation-${data.quotationNumber}.pdf`
//     });
//     res.send(pdfBuffer);
//   } catch (error) {
//     res.status(400).json({ error: "Something went wrong" });
//   }
// };
// export const getQuotationPdfList = async(req:Request,res:Response)=>{
//   try{
//     const userData = req.userData as JwtPayload;
//     if (!userData || !userData.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 10;
//     const offset = (page - 1) * limit;
//     const ownstate = req.query.ownstate;
//     const clientState = req.query.clientState;
//     const { count, rows } = await Quotations.findAndCountAll({
//       where: {
//         userId: userData.userId
//       },
//       order: [["createdAt", "DESC"]],
//       limit: limit,
//       offset: offset
//     });
//     createSuccess(res, "Quotation list fetched successfully", {
//       total: count,
//       page: page,
//       totalPages: Math.ceil(count / limit),
//       data: rows
//     });
//   }catch(error){
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage, error);
//   }
// }
// ✅ Generates a serial 10-digit quotation number (e.g. 0000000001)
const generateQuotationNumber = () => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield dbConnection_2.Quotations.count();
    const serial = count + 1;
    return String(serial).padStart(10, '0');
});
const getQuotationPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        req.body.name;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const data = req.body;
        // ✅ Auto-generate serial 10-digit quotation number
        const quotationNumber = yield generateQuotationNumber();
        // ✅ Helper: Convert image → base64
        const toBase64 = (filePath) => {
            var _a;
            try {
                if (fs_1.default.existsSync(filePath)) {
                    const ext = (_a = filePath.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
                    const buf = fs_1.default.readFileSync(filePath);
                    return `data:${mime};base64,${buf.toString("base64")}`;
                }
            }
            catch (_) { }
            return "";
        };
        const logo = toBase64(path_1.default.join(__dirname, "../../../uploads/images/logo.jpeg"));
        const signature = toBase64(path_1.default.join(__dirname, "../../../uploads/signature.png"));
        const stamp = toBase64(path_1.default.join(__dirname, "../../../uploads/stamp.png"));
        // ✅ GST State
        const ownstate = String(data.ownstate || "").toLowerCase();
        const clientState = String(data.clientState || "").toLowerCase();
        // ✅ Item-level calculations (India GST compliant)
        const isService = String(data.type || '').toLowerCase() === 'service';
        // Step 1: Compute per-item values
        const itemCalcs = data.items.map((item) => {
            const qty = Number(item.quantity || item.qty || 1);
            const rate = Number(item.rate || 0);
            const discPct = Number(item.discount || item.discountPercent || 0);
            const gstPct = Number(item.gst || item.gstPercent || 0);
            // Services → rate is amount for one unit; Items → qty × rate
            const itemTotal = isService ? rate : qty * rate;
            const discAmt = (itemTotal * discPct) / 100;
            const taxable = itemTotal - discAmt;
            const gstAmt = (taxable * gstPct) / 100;
            return { itemTotal, discAmt, taxable, gstAmt };
        });
        // Step 2: Aggregate summary from item-level values
        const subtotal = itemCalcs.reduce((s, i) => s + i.itemTotal, 0);
        const totalDiscount = itemCalcs.reduce((s, i) => s + i.discAmt, 0);
        const taxableAmount = subtotal - totalDiscount;
        const totalGST = itemCalcs.reduce((s, i) => s + i.gstAmt, 0);
        const finalAmount = taxableAmount + totalGST;
        // Step 3: CGST / SGST / IGST split
        const gstRate = Number(data.gstRate || 0);
        let cgst = 0, sgst = 0, igst = 0;
        if (ownstate && clientState && ownstate === clientState) {
            // Intra-state → split equally
            cgst = totalGST / 2;
            sgst = totalGST / 2;
        }
        else {
            // Inter-state → IGST
            igst = totalGST;
        }
        // Alias for EJS template
        const discount = totalDiscount;
        // ✅ Render EJS
        const filePath = path_1.default.join(__dirname, "../../ejs/preview.ejs");
        const html = yield ejs_1.default.renderFile(filePath, Object.assign(Object.assign({}, data), { quotationNumber,
            logo,
            signature,
            stamp,
            subtotal,
            discount,
            taxableAmount,
            gstRate,
            cgst,
            sgst,
            igst,
            totalGST,
            finalAmount }));
        // ✅ Save to DB
        // await Quotations.create({
        //   userId: Number(userData?.userId),
        //   companyId: data.companyId || 0,
        //   quotation: { ...data, quotationNumber },
        //   status: "draft"
        // });
        // ✅ Puppeteer — generate PDF
        const browser = yield puppeteer_1.default.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        const page = yield browser.newPage();
        yield page.setContent(html, { waitUntil: "load" });
        const pdfBuffer = yield page.pdf({
            format: "a4",
            printBackground: true,
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        });
        yield browser.close();
        // ✅ Save PDF to uploads/pdf/
        const pdfFileName = `quotation-${quotationNumber}.pdf`;
        const pdfDir = path_1.default.join(__dirname, "../../../uploads/pdf");
        const pdfFilePath = path_1.default.join(pdfDir, pdfFileName);
        if (!fs_1.default.existsSync(pdfDir))
            fs_1.default.mkdirSync(pdfDir, { recursive: true });
        fs_1.default.writeFileSync(pdfFilePath, pdfBuffer);
        // ✅ Build public download URL
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const pdfUrl = `/uploads/pdf/${pdfFileName}`;
        // ✅ Return JSON with download link
        res.status(200).json({
            success: true,
            message: "Quotation PDF generated successfully",
            data: {
                quotationNumber,
                pdfUrl,
                summary: {
                    subtotal: +subtotal.toFixed(2),
                    discount: +discount.toFixed(2),
                    taxableAmount: +taxableAmount.toFixed(2),
                    cgst: +cgst.toFixed(2),
                    sgst: +sgst.toFixed(2),
                    igst: +igst.toFixed(2),
                    totalGST: +totalGST.toFixed(2),
                    finalAmount: +finalAmount.toFixed(2)
                }
            }
        });
    }
    catch (error) {
        res.status(400).json({ error: "Something went wrong" });
    }
});
exports.getQuotationPdf = getQuotationPdf;
const addQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        // ✅ Auth validation
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const data = req.body;
        // ✅ Required field validation
        if (!data.customerName) {
            (0, errorMessage_1.badRequest)(res, "Customer name is required");
            return;
        }
        if (!data.referenceNumber) {
            (0, errorMessage_1.badRequest)(res, "Reference number is required");
            return;
        }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            (0, errorMessage_1.badRequest)(res, "Items are required");
            return;
        }
        // ✅ Validate each item
        for (const item of data.items) {
            if (!item.itemName || !item.quantity || !item.rate) {
                (0, errorMessage_1.badRequest)(res, "Invalid item data");
                return;
            }
        }
        // ✅ Duplicate check (IMPORTANT)
        const existing = yield dbConnection_2.Quotations.findOne({
            where: {
                userId: Number(userData.userId),
                referenceNumber: data.referenceNumber
            }
        });
        if (existing) {
            (0, errorMessage_1.badRequest)(res, "Quotation already exists with this reference number");
            return;
        }
        const quotationNumber = yield generateQuotationNumber();
        // ✅ Create quotation
        const quotation = yield dbConnection_2.Quotations.create({
            userId: Number(userData.userId),
            quotationNumber: quotationNumber,
            companyId: data.companyId || 0,
            customerName: data.customerName,
            referenceNumber: data.referenceNumber,
            quotation: data,
            status: "draft"
        });
        res.status(201).json({
            success: true,
            message: "Quotation added successfully",
            data: quotation
        });
    }
    catch (error) {
        console.error("Add Quotation Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});
exports.addQuotation = addQuotation;
// export const getQuotationPdfList = async (req: Request, res: Response) => {
//   try {
//     const userData = req.userData as JwtPayload;
//     if (!userData || !userData.userId) {
//       return badRequest(res, "Unauthorized request");
//     }
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 10;
//     const offset = (page - 1) * limit;
//     const ownstate = String(req.query.ownstate || "").toLowerCase();
//     const clientState = String(req.query.clientState || "").toLowerCase();
//     // if (!ownstate || !clientState) {
//     //   return badRequest(res, "ownstate and clientState are required");
//     // }
//     const { count, rows } = await Quotations.findAndCountAll({
//       where: {
//         userId: userData.userId,
//       },
//       order: [["createdAt", "DESC"]],
//       limit,
//       offset,
//     });
//     const updatedRows = rows.map((item: any) => {
//       const data = item.toJSON();
//       const quotation = data.quotation;
//       // ✅ Calculate total amount
//       const totalAmount =
//         quotation?.items?.reduce(
//           (sum: number, i: any) => sum + Number(i.amount || 0),
//           0
//         ) || 0;
//       const gstRate = Number(quotation?.gstRate || 0);
//       const totalGST = (totalAmount * gstRate) / 100;
//       let cgst = 0;
//       let sgst = 0;
//       let igst = 0;
//       // ✅ GST Logic (India)
//       if (ownstate === clientState) {
//         cgst = totalGST / 2;
//         sgst = totalGST / 2;
//       } else {
//         igst = totalGST;
//       }
//       return {
//         ...data,
//         gstDetails: {
//           totalAmount,
//           gstRate,
//           cgst,
//           sgst,
//           igst,
//           totalGST,
//           totalWithGST: totalAmount + totalGST,
//         },
//       };
//     });
//     return createSuccess(res, "Quotation list fetched successfully", {
//       total: count,
//       page,
//       totalPages: Math.ceil(count / limit),
//       data: updatedRows,
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     return badRequest(res, errorMessage, error);
//   }
// };
const getQuotationPdfList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            return (0, errorMessage_1.badRequest)(res, "Unauthorized request");
        }
        // ✅ Pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // ✅ Filters
        const status = String(req.query.status || "").toLowerCase();
        const companyName = String(req.query.companyName || "").toLowerCase();
        const ownstate = String(req.query.ownstate || "").toLowerCase();
        const clientState = String(req.query.clientState || "").toLowerCase();
        // ✅ Validate status
        const allowedStatus = ["draft", "accepted", "rejected"];
        if (status && !allowedStatus.includes(status)) {
            return (0, errorMessage_1.badRequest)(res, "Invalid status value");
        }
        // ✅ Base where condition
        let whereCondition = {
            userId: userData.userId,
        };
        // ✅ Status filter
        if (status) {
            whereCondition.status = status;
        }
        // ✅ Company name filter (PostgreSQL JSON)
        if (companyName) {
            whereCondition[sequelize_1.Op.and] = [
                (0, sequelize_1.literal)(`LOWER("quotation"->'quotation'->>'companyName') = '${companyName.toLowerCase().replace(/'/g, "''")}'`),
            ];
        }
        // ✅ Query
        const { count, rows } = yield dbConnection_2.Quotations.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "ASC"]],
            limit,
            offset,
        });
        const updatedRows = rows.map((item, rowIndex) => {
            const data = item.toJSON();
            const { quotation } = data, rest = __rest(data, ["quotation"]);
            const finalQuotation = (quotation === null || quotation === void 0 ? void 0 : quotation.quotation) || quotation;
            // ✅ Add index inside items
            if ((finalQuotation === null || finalQuotation === void 0 ? void 0 : finalQuotation.items) && Array.isArray(finalQuotation.items)) {
                finalQuotation.items = finalQuotation.items.map((itm, itemIndex) => (Object.assign({ index: itemIndex + 1 }, itm)));
            }
            return Object.assign(Object.assign({}, rest), { rowIndex: offset + rowIndex + 1, quotation: finalQuotation });
        });
        return (0, errorMessage_1.createSuccess)(res, "Quotation list fetched successfully", {
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
            data: updatedRows,
        });
    }
    catch (error) {
        console.error("API Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        return (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.getQuotationPdfList = getQuotationPdfList;
const downloadQuotationPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // ─── Fetch quotation record ────────────────────────────────────────────
        const quotation = yield dbConnection_2.Quotations.findByPk(id);
        if (!quotation) {
            (0, errorMessage_1.badRequest)(res, "Quotation not found");
            return;
        }
        // const data: any = quotation.quotation;
        // // ─── Shared calculations ───────────────────────────────────────────────
        // const subtotal = (data.items ?? []).reduce((sum: number, item: any) => {
        //   return sum + Number(item.amount || 0);
        // }, 0);
        // const discount      = Number(data.discount  || 0);
        // const taxableAmount = subtotal - discount;
        // const gstAmount     = (taxableAmount * Number(data.gstRate || 0)) / 100;
        // const finalAmount   = taxableAmount + gstAmount;
        // // ─── ?mode=details → return JSON details ──────────────────────────────
        // if (req.query.mode === "details") {
        //   createSuccess(res, "Quotation details fetched successfully", {
        //     id:        quotation.id,
        //     userId:    quotation.userId,
        //     companyId: quotation.companyId,
        //     status:    quotation.status,
        //     createdAt: (quotation as any).createdAt,
        //     updatedAt: (quotation as any).updatedAt,
        //     quotation: {
        //       ...data,
        //       subtotal,
        //       discount,
        //       taxableAmount,
        //       gstAmount,
        //       finalAmount
        //     }
        //   });
        //   return;
        // }
        // // ─── Default → generate & stream PDF ──────────────────────────────────
        // const toBase64 = (filePath: string): string => {
        //   try {
        //     if (fs.existsSync(filePath)) {
        //       const ext  = filePath.split(".").pop()?.toLowerCase();
        //       const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
        //       const buf  = fs.readFileSync(filePath);
        //       return `data:${mime};base64,${buf.toString("base64")}`;
        //     }
        //   } catch (_) {}
        //   return "";
        // };
        // const logo      = toBase64(path.join(__dirname, "../../../uploads/images/logo.jpeg"));
        // const signature = toBase64(path.join(__dirname, "../../../uploads/signature.png"));
        // const stamp     = toBase64(path.join(__dirname, "../../../uploads/stamp.png"));
        // const filePath = path.join(__dirname, "../../ejs/preview.ejs");
        // const html = await ejs.renderFile(filePath, {
        //   ...data,
        //   logo,
        //   signature,
        //   stamp,
        //   subtotal,
        //   discount,
        //   taxableAmount,
        //   gstAmount,
        //   finalAmount
        // });
        // const browser = await puppeteer.launch({
        //   args: ["--no-sandbox", "--disable-setuid-sandbox"]
        // });
        // const page = await browser.newPage();
        // await page.setContent(html as string, { waitUntil: "load" });
        // const pdfBuffer = await page.pdf({
        //   format: "a4",
        //   printBackground: true,
        //   margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
        // });
        // await browser.close();
        // res.set({
        //   "Content-Type": "application/pdf",
        //   "Content-Disposition": `attachment; filename=quotation-${data.quotationNumber || id}.pdf`
        // });
        // res.send(pdfBuffer);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.downloadQuotationPdf = downloadQuotationPdf;
const getSubCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Category id is required");
            return;
        }
        const subCategory = yield dbConnection_2.SubCategory.findAll({
            where: {
                CategoryId: id,
            },
        });
        // 🔥 Transform "text" → "tax"
        const formattedData = subCategory.map((item) => {
            const obj = item.toJSON();
            return Object.assign(Object.assign({}, obj), { tax: obj.text, text: undefined });
        });
        (0, errorMessage_1.createSuccess)(res, "Sub category list fetched successfully", formattedData);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.getSubCategory = getSubCategory;
const updateQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        console.log("id", id, "status", status);
        if (!id) {
            (0, errorMessage_1.badRequest)(res, "Quotation id is required");
            return;
        }
        const quotationData = yield dbConnection_2.Quotations.findByPk(id);
        if (!quotationData) {
            (0, errorMessage_1.badRequest)(res, "Quotation not found");
            return;
        }
        quotationData.status = status;
        yield quotationData.save();
        (0, errorMessage_1.createSuccess)(res, "Quotation updated successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage, error);
    }
});
exports.updateQuotation = updateQuotation;
