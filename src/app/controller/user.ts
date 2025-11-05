import {
  Op,
  fn,
  col,
  where,
} from "sequelize";

import fs from "fs";
import pdfParse from "pdf-parse";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response } from "express-serve-static-core";
import {
  createSuccess,
  getSuccess,
  badRequest,
} from "../middlewear/errorMessage";
import {
  User,
  Category,
  Meeting,
  Device,
  Attendance,
  Leave,
  Expense
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";
import { ReadableStreamDefaultController } from "stream/web";

export const Register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;

    const isExist = await User.findOne({
      where: { phone },
    }); // ✅ pass as an object

    if (isExist) {
      badRequest(res, "Phone number already exists");
    }
    const item = await User.create({
      phone,
      role: "user",
    });
    createSuccess(res, "admin register done", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      deviceToken,
      devicemodel,
      devicename,
      deviceType,
      deviceId,
    } = req.body || {};
    console.log(">>>>>>>>>>>>>>>>>>>req.body", req.body);

    if (!email || !password) {
      badRequest(res, "Email and password are required");
      return;
    }

    // ✅ Check if user exists
    const user = await Middleware.FindByEmail(User, email);
    if (!user) {
      badRequest(res, "Invalid email or password");
      return;
    }

    // ✅ Validate password
    const hashedPassword = user.getDataValue("password");
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordValid) {
      badRequest(res, "Invalid email or password");
      ReadableStreamDefaultController;
    }

    // ✅ Create access & refresh tokens
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(user.getDataValue("id")),
      String(user.getDataValue("role"))
    );

    // ✅ Save refresh token in DB
    await user.update({ refreshToken });

    if (deviceToken) {
      const existing = await Device.findOne({ where: { deviceToken } });
      if (!existing) {
        await Device.create({
          userId: user?.id,
          deviceToken,
          deviceType,
          deviceId,
          devicemodel,
          devicename,
          isActive: true, // ✅ REQUIRED
        });
      } else {
        await existing.update({
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
    createSuccess(res, "Login successful", {
      accessToken,
      refreshToken,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const GetProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const item = await Middleware.getById(User, Number(userData.userId));
    createSuccess(res, "user details", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const UpdateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    const { firstName, lastName } = req.body || {};

    // ✅ Build update object dynamically
    const updates: any = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;

    // ✅ File upload (Multer-S3 case)
    if (req.file && (req.file as any).location) {
      updates.profile = (req.file as any).location;
    }
    // ✅ No valid field to update
    if (Object.keys(updates).length === 0) {
      badRequest(res, "No valid fields provided to update");
      return;
    }
    // ✅ Run update
    const updatedUser = await Middleware.Update(
      User,
      Number(userData.userId),
      updates
    );

    if (!updatedUser) {
      badRequest(res, "User not found");
      return;
    }

    createSuccess(res, "Profile updated successfully");
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const MySalePerson = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const userData = req.userData as JwtPayload;

    /** ✅ Search condition */
    const where: any = {};

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    /** ✅ Fetch created users */
    const result = await User.findByPk(userData.userId, {
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
          through: { attributes: [] },
          where, // ✅ apply search
          required: false, // ✅ so user must exist even if none found
        },
      ],
    });

    if (!result) {
      badRequest(res, "User not found");
    }

    /** ✅ Extract created users */
    // let createdUsers = result?.createdUsers || [];
    let createdUsers = (result as any)?.createdUsers || [];

    /** ✅ Pagination manually */
    const total = createdUsers.length;
    createdUsers = createdUsers.slice(offset, offset + limitNum);

    createSuccess(res, "My sale persons", {
      page: pageNum,
      limit: limitNum,
      total,
      rows: createdUsers,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const CreateMeeting = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;
    const isExist = await Meeting.findOne({
      where: {
        userId: finalUserId,
        status: "in", // You wrote "in" but in schema you used: pending | completed | cancelled
      },
    });

    /** ✅ If active meeting exists → Stop */
    if (isExist) {
      badRequest(
        res,
        `You already have an active meeting started at ${isExist.meetingTimeIn}`
      );
      return;
    }
    const {
      companyName,
      personName,
      mobileNumber,
      customerType,
      meetingPurpose,
      categoryId,
      status,
      latitude_in,
      longitude_in,
      meetingTimeIn,
      scheduledTime,
    } = req.body || {};

    /** ✅ Required fields validation */
    const requiredFields: Record<string, any> = {
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
        badRequest(res, `${key} is required`);
        return;
      }
    }

    /** ✅ userId priority: req.body → token */

    if (!finalUserId) {
      badRequest(res, "userId is required");
      return;
    }

    /** ✅ Prepare payload */
    const payload: any = {
      companyName,
      personName,
      mobileNumber,
      customerType,
      meetingPurpose,
      categoryId,
      status,
      userId: finalUserId,
    };

    const files = req.files as Express.MulterS3.File[];

    if (files?.length > 0) {
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
    const item = await Middleware.CreateData(Meeting, payload);
    createSuccess(res, "Meeting successfully added", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const EndMeeting = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;
    const { meetingId, latitude_out, longitude_out, remarks } = req.body || {};
    if (!meetingId) {
      badRequest(res, "meetingId is required");
      return;
    }
    /** ✅ Check meeting exist for this user & active */
    const isExist = await Meeting.findOne({
      where: {
        id: meetingId,
        userId: finalUserId,
        status: "in",
      },
    });
    if (!isExist) {
      badRequest(res, "No active meeting found with this meetingId");
      return;
    }
    /** ✅ Update meeting */
    isExist.status = "completed";
    isExist.latitude_out = latitude_out ?? null;
    isExist.longitude_out = longitude_out ?? null;
    isExist.meetingTimeOut = new Date();
    if (remarks) isExist.remarks = remarks;
    await isExist.save();
    createSuccess(res, "Meeting ended successfully", isExist);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const GetMeetingList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    if (!finalUserId) {
      badRequest(res, "UserId not found");
      return;
    }

    /** ✅ Search condition */
    const where: any = {
      userId: finalUserId,
    };

    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { personName: { [Op.iLike]: `%${search}%` } },
        { mobileNumber: { [Op.iLike]: `%${search}%` } },
        { remarks: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (status) {
      where.status = status;
    }

    /** ✅ Query with pagination + count */
    const { rows, count } = await Meeting.findAndCountAll({
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

    createSuccess(res, "Meeting list fetched", { pageInfo, data: rows });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const scheduled = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;
    const { meetingId, latitude_in, longitude_in } = req.body || {};
    if (!meetingId) {
      badRequest(res, "meetingId is required");
      return;
    }

    if (!latitude_in && longitude_in) {
      badRequest(res, "latitude_in && longitude_in is required");
      return;
    }
    /** ✅ Check meeting exist for this user & active */
    const isExist = await Meeting.findOne({
      where: {
        id: meetingId,
        userId: finalUserId,
        status: "scheduled",
      },
    });
    if (!isExist) {
      badRequest(res, "No scheduled meeting found with this meetingId");
      return;
    }
    /** ✅ Update meeting */
    isExist.status = "in";
    isExist.latitude_in = latitude_in ?? null;
    isExist.longitude_in = longitude_in ?? null;
    isExist.meetingTimeIn = new Date();
    await isExist.save();
    createSuccess(res, "Meeting successfully start", isExist);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const Logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      badRequest(res, "device token is missing");
    }
    await Device.destroy({ where: { deviceId } });
    createSuccess(res, "logout sussfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const getCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.query;
    const item = await Middleware.getAllList(Category, data);
    createSuccess(res, "get all category", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const AttendancePunchIn = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    const { punch_in, latitude_in, longitude_in } = req.body || {};

    if (!punch_in) {
      badRequest(res, "Punch-in time is required");
      return;
    }

    // 1) ✅ Check if already punched in today
    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    const already = await Attendance.findOne({
      where: {
        employee_id: finalUserId,
        date: today,
      },
    });

    if (already) {
      badRequest(res, "You have already punched-in today");
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
    const obj: any = {
      employee_id: finalUserId,
      date: today,
      punch_in: punchInTime,
      status: "present",
      late,
      latitude_in,
      longitude_in,
    };

    const item = await Attendance.create(obj);

    createSuccess(res, "Punch-in recorded successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const AttendancePunchOut = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;
    const { punch_out, AttendanceId, latitude_out, longitude_out } =
      req.body || {};

    if (!punch_out) {
      badRequest(res, "Punch-out time is required");
      return;
    }

    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    // ✅ Find today's punch-in record
    const attendance = await Attendance.findOne({
      where: {
        employee_id: finalUserId,
        date: today,
        id: AttendanceId,
      },
    });

    if (!attendance) {
      badRequest(res, "No punch-in record found today");
      return;
    }

    // ✅ Check if already punched-out
    if (attendance.punch_out) {
      badRequest(res, "Already punched-out today");
      return;
    }

    const punchInTime = new Date(attendance.punch_in as Date);
    const punchOutTime = new Date(punch_out);

    if (punchOutTime < punchInTime) {
      badRequest(res, "Punch-out must be after punch-in");
      return;
    }
    // ✅ Calculate working hours
    const diffMs = punchOutTime.getTime() - punchInTime.getTime();
    const workingHours = diffMs / (1000 * 60 * 60); // ms → hours
    const workingHoursRounded = Number(workingHours.toFixed(2));

    // ✅ Overtime (optional)
    const officeHours = 8; // Standard
    const overtime =
      workingHoursRounded > officeHours
        ? Number((workingHoursRounded - officeHours).toFixed(2))
        : 0;

    // ✅ Update DB
    attendance.punch_out = punchOutTime;
    attendance.working_hours = workingHoursRounded;
    attendance.overtime = overtime;
    attendance.latitude_out = latitude_out;
    attendance.longitude_out = longitude_out;
    await attendance.save();

    createSuccess(res, "Punch-out completed");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const getTodayAttendance = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    // const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    const record = await Attendance.findOne({
      where: {
        employee_id: finalUserId,
        [Op.and]: where(fn("DATE", col("date")), today),
      },
    });

    if (!record) {
      badRequest(res, "No attendance found for today");
      return;
    }

    createSuccess(res, "Today attendance fetched", record);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const AttendanceList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;
    const data = req.query;

    const item = await Middleware.withuserlogin(Attendance, finalUserId, data);
    createSuccess(res, "bbkbdkfbkd", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const requestLeave = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    const { from_date, to_date, reason } = req.body || {};

    // ✅ Validate inputs
    if (!from_date || !to_date || !reason) {
      badRequest(res, "from_date, to_date & reason are required");
      return;
    }

    const from = new Date(from_date);
    const to = new Date(to_date);

    // ✅ from_date <= to_date
    if (to < from) {
      badRequest(res, "to_date must be after from_date");
      return;
    }

    // ✅ Create leave request
    const leave = await Leave.create({
      employee_id: finalUserId,
      from_date: from,
      to_date: to,
      reason,
      status: "pending",
    });

    createSuccess(res, "Leave requested successfully", leave);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};


export const CreateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    if (!finalUserId) {
       badRequest(res, "Invalid user");
       return
    }

    const { title } = req.body ?? {};

    if (!title || title.trim() === "") {
       badRequest(res, "Title is required");
       return
    }

    const payload: any = {
      userId: finalUserId,
      title,
    };

    // ✅ files from multer (S3 upload)
    const files = req.files as Express.MulterS3.File[];
    if (Array.isArray(files) && files.length > 0) {
      payload.billImage = files.map((file) => file.location);
    }

    // ✅ Create entry
    const created = await Expense.create(payload);

     createSuccess(res, "Expense added successfully", created);
  } catch (error) {
    console.error("Error in CreateExpense:", error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return
  }
};


export const ReFressToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const user = await User.findByPk(userData.userId);
    if (!user) {
      badRequest(res, "User not found");
      return;
    }

    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(user.getDataValue("id")),
      String(user.getDataValue("role"))
    );

    // update refresh token in DB
    user.setDataValue("refreshToken", refreshToken); // or user.refreshToken = refreshToken;
    await user.save();

    createSuccess(res, "Login successful", {
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};











