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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReFressToken = exports.CreateExpense = exports.requestLeave = exports.AttendanceList = exports.getTodayAttendance = exports.AttendancePunchOut = exports.AttendancePunchIn = exports.getCategory = exports.Logout = exports.scheduled = exports.GetMeetingList = exports.EndMeeting = exports.CreateMeeting = exports.MySalePerson = exports.UpdateProfile = exports.GetProfile = exports.Login = exports.Register = void 0;
const sequelize_1 = require("sequelize");
const bcrypt_1 = __importDefault(require("bcrypt"));
const errorMessage_1 = require("../middlewear/errorMessage");
const dbConnection_1 = require("../../config/dbConnection");
const Middleware = __importStar(require("../middlewear/comman"));
const web_1 = require("stream/web");
const Register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone } = req.body;
        const isExist = yield dbConnection_1.User.findOne({
            where: { phone },
        }); // ✅ pass as an object
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, "Phone number already exists");
        }
        const item = yield dbConnection_1.User.create({
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
        console.log(">>>>>>>>>>>>>>>>>>>req.body", req.body);
        if (!email || !password) {
            (0, errorMessage_1.badRequest)(res, "Email and password are required");
            return;
        }
        // ✅ Check if user exists
        const user = yield Middleware.FindByEmail(dbConnection_1.User, email);
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
            const existing = yield dbConnection_1.Device.findOne({ where: { deviceToken } });
            if (!existing) {
                yield dbConnection_1.Device.create({
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
        // ✅ Respond to client
        (0, errorMessage_1.createSuccess)(res, "Login successful", {
            accessToken,
            refreshToken,
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
        const item = yield Middleware.getById(dbConnection_1.User, Number(userData.userId));
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
        const updatedUser = yield Middleware.Update(dbConnection_1.User, Number(userData.userId), updates);
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
        const result = yield dbConnection_1.User.findByPk(userData.userId, {
            include: [
                {
                    model: dbConnection_1.User,
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
const CreateMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        const isExist = yield dbConnection_1.Meeting.findOne({
            where: {
                userId: finalUserId,
                status: "in", // You wrote "in" but in schema you used: pending | completed | cancelled
            },
        });
        /** ✅ If active meeting exists → Stop */
        if (isExist) {
            (0, errorMessage_1.badRequest)(res, `You already have an active meeting started at ${isExist.meetingTimeIn}`);
            return;
        }
        const { companyName, personName, mobileNumber, customerType, meetingPurpose, categoryId, status, latitude_in, longitude_in, meetingTimeIn, scheduledTime, } = req.body || {};
        /** ✅ Required fields validation */
        const requiredFields = {
            companyName,
            personName,
            mobileNumber,
            customerType,
            meetingPurpose,
            categoryId,
            status,
            // latitude_in,
            // longitude_in,
            // meetingTimeIn,
        };
        for (const key in requiredFields) {
            if (!requiredFields[key]) {
                (0, errorMessage_1.badRequest)(res, `${key} is required`);
                return;
            }
        }
        /** ✅ userId priority: req.body → token */
        if (!finalUserId) {
            (0, errorMessage_1.badRequest)(res, "userId is required");
            return;
        }
        /** ✅ Prepare payload */
        const payload = {
            companyName,
            personName,
            mobileNumber,
            customerType,
            meetingPurpose,
            categoryId,
            status,
            userId: finalUserId,
        };
        const files = req.files;
        if ((files === null || files === void 0 ? void 0 : files.length) > 0) {
            payload.image = files.map((file) => file.location);
        }
        if (meetingTimeIn) {
            payload.meetingTimeIn = meetingTimeIn;
        }
        if (latitude_in) {
            payload.latitude_in = latitude_in;
        }
        if (longitude_in) {
            payload.longitude_in = longitude_in;
        }
        if (scheduledTime) {
            payload.scheduledTime = scheduledTime;
        }
        /** ✅ Save data */
        const item = yield Middleware.CreateData(dbConnection_1.Meeting, payload);
        (0, errorMessage_1.createSuccess)(res, "Meeting successfully added", item);
    }
    catch (error) {
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
        if (!meetingId) {
            (0, errorMessage_1.badRequest)(res, "meetingId is required");
            return;
        }
        /** ✅ Check meeting exist for this user & active */
        const isExist = yield dbConnection_1.Meeting.findOne({
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
        /** ✅ Update meeting */
        isExist.status = "completed";
        isExist.latitude_out = latitude_out !== null && latitude_out !== void 0 ? latitude_out : null;
        isExist.longitude_out = longitude_out !== null && longitude_out !== void 0 ? longitude_out : null;
        isExist.meetingTimeOut = new Date();
        if (remarks)
            isExist.remarks = remarks;
        yield isExist.save();
        (0, errorMessage_1.createSuccess)(res, "Meeting ended successfully", isExist);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.EndMeeting = EndMeeting;
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
        const { rows, count } = yield dbConnection_1.Meeting.findAndCountAll({
            where,
            limit: limitNum,
            offset,
            order: [["createdAt", "DESC"]],
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
        const isExist = yield dbConnection_1.Meeting.findOne({
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
        yield dbConnection_1.Device.destroy({ where: { deviceId } });
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
        const item = yield Middleware.getAllList(dbConnection_1.Category, data);
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
        const already = yield dbConnection_1.Attendance.findOne({
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
        const item = yield dbConnection_1.Attendance.create(obj);
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
        const attendance = yield dbConnection_1.Attendance.findOne({
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
        const record = yield dbConnection_1.Attendance.findOne({
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
        const item = yield Middleware.withuserlogin(dbConnection_1.Attendance, finalUserId, data);
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
        const { from_date, to_date, reason } = req.body || {};
        // ✅ Validate inputs
        if (!from_date || !to_date || !reason) {
            (0, errorMessage_1.badRequest)(res, "from_date, to_date & reason are required");
            return;
        }
        const from = new Date(from_date);
        const to = new Date(to_date);
        // ✅ from_date <= to_date
        if (to < from) {
            (0, errorMessage_1.badRequest)(res, "to_date must be after from_date");
            return;
        }
        // ✅ Create leave request
        const leave = yield dbConnection_1.Leave.create({
            employee_id: finalUserId,
            from_date: from,
            to_date: to,
            reason,
            status: "pending",
        });
        (0, errorMessage_1.createSuccess)(res, "Leave requested successfully", leave);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.requestLeave = requestLeave;
const CreateExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userData = req.userData;
        const finalUserId = userData === null || userData === void 0 ? void 0 : userData.userId;
        if (!finalUserId) {
            (0, errorMessage_1.badRequest)(res, "Invalid user");
            return;
        }
        const { title } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        if (!title || title.trim() === "") {
            (0, errorMessage_1.badRequest)(res, "Title is required");
            return;
        }
        const payload = {
            userId: finalUserId,
            title,
        };
        // ✅ files from multer (S3 upload)
        const files = req.files;
        if (Array.isArray(files) && files.length > 0) {
            payload.billImage = files.map((file) => file.location);
        }
        // ✅ Create entry
        const created = yield dbConnection_1.Expense.create(payload);
        (0, errorMessage_1.createSuccess)(res, "Expense added successfully", created);
    }
    catch (error) {
        console.error("Error in CreateExpense:", error);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
        return;
    }
});
exports.CreateExpense = CreateExpense;
const ReFressToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const user = yield dbConnection_1.User.findByPk(userData.userId);
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
