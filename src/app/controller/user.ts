import { Op, fn, col, where } from "sequelize";
import {sequelize} from "../../config/dbConnection"
import PDFDocument from "pdfkit";
import puppeteer from "puppeteer";
import ejs from "ejs";
import path from "path";
// import logo from "../../../uploads/images/logo.jpeg"
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
  Expense,
  MeetingImage,
  MeetingCompany,
  SubCategory,
  MeetingUser,
  ExpenseImage,
  Quotation,Quotations
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
    const userData = user.toJSON();
    delete userData.password;
    // delete userData.refreshToken;
    // delete userData.createdAt;
    // delete userData.updatedAt;

    const enrichedUser = {
  ...userData,
  city: "Zirakpur",
  state: "Punjab",
  country: "India"
};
    createSuccess(res, "Login successful", {
      accessToken,
      refreshToken,
      user:enrichedUser
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

export const getLastMeeting = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    const { page = 1, limit = 10, search } = req.query as any;

    const offset = (Number(page) - 1) * Number(limit);

    const whereCondition: any = {
      // Filter out records so it only shows users that actually had meetings with `finalUserId`
      // We do this dynamically via the nested Include "required" so the global query doesn't fail if the client was met by multiple employees.
    };

    // Client/MeetingUser search logic
    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { mobile: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // company search logic
    const companyWhereCondition: any = {};
    // if (search) {
    //   companyWhereCondition[Op.or] = [
    //     { companyName: { [Op.iLike]: `%${search}%` } },
    //     { personName: { [Op.iLike]: `%${search}%` } },
    //     { companyEmail: { [Op.iLike]: `%${search}%` } },
    //     { mobileNumber: { [Op.iLike]: `%${search}%` } },
    //   ];
    // }

    // Employee relation tracking
    const meetingWhereCondition: any = { userId: finalUserId };

    const { rows, count } = await MeetingUser.findAndCountAll({
      where: Object.keys(whereCondition).length ? whereCondition : undefined,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: MeetingCompany, // Include their associated companies
          required: false, 
          include:[
            {
              model: Meeting,
              where: meetingWhereCondition, // Only fetch meetings that belong to the logged-in employee
              required: true,
              include: [
                {
                  model: MeetingImage 
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
  const transaction = await sequelize.transaction();

  try {
    const userData = req.userData as JwtPayload;
    const tokenUserId = userData?.userId;

    let {
      userName,
      userMobile,
      userEmail,
      companyName,
      personName,
      mobileNumber,
      customerType,
      companyEmail,
      meetingPurpose,
      categoryId,
      status,
      latitude_in,
      longitude_in,
      meetingTimeIn,
      scheduledTime,
      state,
      city,
      country,
    } = req.body || {};

    // Trim all string inputs to avoid trailing space errors in enums
    if (typeof customerType === "string") customerType = customerType.trim();
    if (typeof meetingPurpose === "string") meetingPurpose = meetingPurpose.trim();
    if (typeof status === "string") status = status.trim();
    if (typeof companyName === "string") companyName = companyName.trim();
    if (typeof personName === "string") personName = personName.trim();
    if (typeof mobileNumber === "string") mobileNumber = mobileNumber.trim();
    if (typeof companyEmail === "string") companyEmail = companyEmail.trim();

    /** Required fields */
    const requiredFields: Record<string, any> = {
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
        await transaction.rollback();
        badRequest(res, `${key} is required`);
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
      meetingContactUser = await MeetingUser.findOne({
        where: { 
          mobile: contactMobile,
          ...(contactEmail && { email: contactEmail }),
          ...(contactName && { name: contactName })
        },
      });

      if (!meetingContactUser) {
        meetingContactUser = await MeetingUser.create(
          {
            name: contactName,
            mobile: contactMobile,
            email:contactEmail,
            userId: finalUserId
          },
          { transaction }
        );
      }
    }

    /** --------------------------
     * 2️⃣ Check Active Meeting
     * -------------------------- */
    const activeMeeting = await Meeting.findOne({
      where: {
        userId: finalUserId,
        status: "in",
      },
    });

    if (activeMeeting) {
      await transaction.rollback();
      badRequest(
        res,
        `You already have an active meeting started at ${activeMeeting.meetingTimeIn}`
      );
      return;
    }

    /** --------------------------
     * 3️⃣ Find or Create Company
     * -------------------------- */
    let company = await MeetingCompany.findOne({
      where: {
        companyName,
        personName,
        mobileNumber,
        companyEmail,
      },
    });

    if (!company) {
      company = await MeetingCompany.create(
        {
          companyName,
          personName,
          mobileNumber,
          companyEmail,
          customerType,
          state,
          city,
          country,
          meetingUserId: meetingContactUser?.id, // Link to Client
        },
        { transaction }
      );
    }

    /** --------------------------
     * 4️⃣ Create Meeting
     * -------------------------- */
    // Helper to safely parse dates and avoid "Invalid date" DB crash
    const parseDateSafely = (dateStr: any) => {
      if (!dateStr || dateStr === "Invalid date") return undefined;
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const validMeetingTimeIn = parseDateSafely(meetingTimeIn);
    const validScheduledTime = parseDateSafely(scheduledTime);

    const meeting = await Meeting.create(
      {
        userId: finalUserId,
        meetingUserId: meetingContactUser?.id,
        companyId: company.id,
        meetingPurpose,
        categoryId,
        status,
        meetingTimeIn: validMeetingTimeIn,
        latitude_in,
        longitude_in,
        scheduledTime: validScheduledTime,
      },
      { transaction }
    );

    /** --------------------------
     * 5️⃣ Save Images
     * -------------------------- */
    const files = req.files as Express.MulterS3.File[];

    if (files?.length) {
      const images = files.map((file) => ({
        meetingId: meeting.id,
        meetingUserId: meetingContactUser?.id,  // Link to Client
        image: file.location,
      }));

      await MeetingImage.bulkCreate(images, { transaction });
    }

    await transaction.commit();

    createSuccess(res, "Meeting successfully created", meeting);
  } catch (error) {
    await transaction.rollback();

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

    if (!latitude_out || !longitude_out) {
      badRequest(res, "latitude_out and longitude_out are required to end a meeting");
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

    // Since remarks is on the meeting_companies table (not Meetings), we need to update it there
    if (remarks) {
      const company = await MeetingCompany.findByPk(isExist.companyId);
      if (company) {
        await company.update({ remarks });
      }
    }

    /** ✅ Update meeting */
    isExist.status = "out"; // Use 'out' as per schema instead of 'completed'
    isExist.latitude_out = latitude_out;
    isExist.longitude_out = longitude_out;
    isExist.meetingTimeOut = new Date();
    
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
      const { rows, count } = await MeetingUser.findAndCountAll({
      where: where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: MeetingCompany, // Include their associated companies
          required: false, 
          include:[
            {
              model: Meeting,
              where: where, // Only fetch meetings that belong to the logged-in employee
              required: true,
              include: [
                {
                  model: MeetingImage 
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
    const item = await Middleware.getAllListCategory(Category, data);
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

    const { from_date, to_date, reason,leave_type } = req.body || {};

    // --------------------
    // ✅ Basic Validation
    // --------------------
    if (!from_date || !to_date || !reason) {
       badRequest(res, "from_date, to_date & reason are required");
       return
    }

    const from = new Date(from_date);
    const to = new Date(to_date);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        badRequest(res, "Invalid date format");
        return
    }

    if (to < from) {
       badRequest(res, "to_date must be after from_date");
       return
    }

    // --------------------
    // ✅ Create Leave Request
    // --------------------
    const leave = await Leave.create({
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
      await Attendance.create({
        employee_id: finalUserId,
        date: from,
        punch_in: to,
        status: "leave",
      });
    }
    createSuccess(res, "Leave requested successfully", leave);
  } catch (error: any) {
     badRequest(res, error?.message || "Something went wrong");
  }
};


export const LeaveList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const offset = (page - 1) * limit;

    const result = await Leave.findAndCountAll({
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

    createSuccess(res, "Leave list", response);

  } catch (error: any) {
    badRequest(res, error?.message || "Something went wrong");
  }
};


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

export const CreateExpense = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = (req as any).userData?.userId;

    let expenses: any = req.body.expenses || req.body;

    if (typeof expenses === "string") {
      expenses = JSON.parse(expenses);
    }

    if (!Array.isArray(expenses)) {
      throw new Error("Expenses must be an array");
    }

    const files = req.files as Express.Multer.File[];

    const imageMap: Record<number, string[]> = {};

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

      const expense = await Expense.create(
        {
          userId,
          title: item.title,
          total_amount: item.total_amount,
          amount: item.amount,
          date: item.date,
          category: item.category,
          description: item.description,
          location: item.location
        },
        { transaction }
      );

      const images = imageMap[i] || [];

      if (images.length > 0) {
        const payload = images.map((url) => ({
          expenseId: expense.id,
          imageUrl: url
        }));

        await ExpenseImage.bulkCreate(payload, { transaction });
      }

      createdExpenses.push(expense);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Expenses created successfully",
      data: createdExpenses
    });

  } catch (error) {

    await transaction.rollback();

    console.error("============= CREATE EXPENSE ERROR =============");
    console.error(error);
    console.error("================================================");

    res.status(400).json({
      success: false,
      message: "Failed to create expenses",
      error: error instanceof Error ? error.message : error
    });
  }
};




export const GetExpense = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;

    if (!finalUserId) {
      badRequest(res, "Invalid user");
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await Expense.findAndCountAll({
      where: {
        userId: finalUserId,
      },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: ExpenseImage,
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

    createSuccess(res, "Expense list", response);
  } catch (error) {
    console.error("Error in GetExpense:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
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

export const getQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    // const userData = req.userData as JwtPayload;

    // if (!userData || !userData.userId) {
    //   badRequest(res, "Unauthorized request");
    //   return;
    // }

    const { page = 1, limit = 10 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;
    const { count, rows } = await Quotation.findAndCountAll({
      where: {
        // userId: userData.userId
      },
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset: offset
    });

    createSuccess(res, "Quotation list fetched successfully", {
      total: count,
      page: pageNumber,
      totalPages: Math.ceil(count / pageSize),
      data: rows
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";

    badRequest(res, errorMessage, error);
  }
};

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

export const getQuotationPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const data = req.body;

    // ✅ Helper: Convert image → base64
    const toBase64 = (filePath: string): string => {
      try {
        if (fs.existsSync(filePath)) {
          const ext = filePath.split(".").pop()?.toLowerCase();
          const mime =
            ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const buf = fs.readFileSync(filePath);
          return `data:${mime};base64,${buf.toString("base64")}`;
        }
      } catch (_) {}
      return "";
    };

    const logo = toBase64(
      path.join(__dirname, "../../../uploads/images/logo.jpeg")
    );
    const signature = toBase64(
      path.join(__dirname, "../../../uploads/signature.png")
    );
    const stamp = toBase64(
      path.join(__dirname, "../../../uploads/stamp.png")
    );

    // ✅ GST State
    const ownstate = String(data.ownstate || "").toLowerCase();
    const clientState = String(data.clientState || "").toLowerCase();

    // ✅ Calculations
    const subtotal = data.items.reduce((sum: number, item: any) => {
      return sum + Number(item.amount || 0);
    }, 0);

    const discount = Number(data.discount || 0);
    const taxableAmount = subtotal - discount;

    const gstRate = Number(data.gstRate || 0);
    const totalGST = (taxableAmount * gstRate) / 100;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    // ✅ GST Logic (India)
    if (ownstate && clientState && ownstate === clientState) {
      cgst = totalGST / 2;
      sgst = totalGST / 2;
    } else {
      igst = totalGST;
    }

    const finalAmount = taxableAmount + totalGST;

    // ✅ Render EJS
    const filePath = path.join(__dirname, "../../ejs/preview.ejs");

    const html = await ejs.renderFile(filePath, {
      ...data,
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
      finalAmount
    });

    // ✅ Save to DB
    await Quotations.create({
      userId: Number(userData?.userId),
      companyId: data.companyId || 0,
      quotation: data,
      status: "draft"
    });

    // ✅ Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html as string, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm"
      }
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=quotation-${data.quotationNumber}.pdf`
    });

    res.send(pdfBuffer);

  } catch (error) {
    res.status(400).json({ error: "Something went wrong" });
  }
};

export const getQuotationPdfList = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const ownstate = String(req.query.ownstate || "").toLowerCase();
    const clientState = String(req.query.clientState || "").toLowerCase();

    if (!ownstate || !clientState) {
      return badRequest(res, "ownstate and clientState are required");
    }

    const { count, rows } = await Quotations.findAndCountAll({
      where: {
        userId: userData.userId,
      },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const updatedRows = rows.map((item: any) => {
      const data = item.toJSON();
      const quotation = data.quotation;

      // ✅ Calculate total amount
      const totalAmount =
        quotation?.items?.reduce(
          (sum: number, i: any) => sum + Number(i.amount || 0),
          0
        ) || 0;

      const gstRate = Number(quotation?.gstRate || 0);
      const totalGST = (totalAmount * gstRate) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      // ✅ GST Logic (India)
      if (ownstate === clientState) {
        cgst = totalGST / 2;
        sgst = totalGST / 2;
      } else {
        igst = totalGST;
      }

      return {
        ...data,
        gstDetails: {
          totalAmount,
          gstRate,
          cgst,
          sgst,
          igst,
          totalGST,
          totalWithGST: totalAmount + totalGST,
        },
      };
    });

    return createSuccess(res, "Quotation list fetched successfully", {
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: updatedRows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const downloadQuotationPdf = async(req:Request,res:Response)=>{
  try{
    const { id } = req.params;

    // ─── Fetch quotation record ────────────────────────────────────────────
    const quotation = await Quotations.findByPk(id);
    if(!quotation){
      badRequest(res, "Quotation not found");
      return;
    }

    const data: any = quotation.quotation;

    // ─── Shared calculations ───────────────────────────────────────────────
    const subtotal = (data.items ?? []).reduce((sum: number, item: any) => {
      return sum + Number(item.amount || 0);
    }, 0);
    const discount      = Number(data.discount  || 0);
    const taxableAmount = subtotal - discount;
    const gstAmount     = (taxableAmount * Number(data.gstRate || 0)) / 100;
    const finalAmount   = taxableAmount + gstAmount;

    // ─── ?mode=details → return JSON details ──────────────────────────────
    if (req.query.mode === "details") {
      createSuccess(res, "Quotation details fetched successfully", {
        id:        quotation.id,
        userId:    quotation.userId,
        companyId: quotation.companyId,
        status:    quotation.status,
        createdAt: (quotation as any).createdAt,
        updatedAt: (quotation as any).updatedAt,
        quotation: {
          ...data,
          subtotal,
          discount,
          taxableAmount,
          gstAmount,
          finalAmount
        }
      });
      return;
    }

    // ─── Default → generate & stream PDF ──────────────────────────────────
    const toBase64 = (filePath: string): string => {
      try {
        if (fs.existsSync(filePath)) {
          const ext  = filePath.split(".").pop()?.toLowerCase();
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const buf  = fs.readFileSync(filePath);
          return `data:${mime};base64,${buf.toString("base64")}`;
        }
      } catch (_) {}
      return "";
    };

    const logo      = toBase64(path.join(__dirname, "../../../uploads/images/logo.jpeg"));
    const signature = toBase64(path.join(__dirname, "../../../uploads/signature.png"));
    const stamp     = toBase64(path.join(__dirname, "../../../uploads/stamp.png"));

    const filePath = path.join(__dirname, "../../ejs/preview.ejs");
    const html = await ejs.renderFile(filePath, {
      ...data,
      logo,
      signature,
      stamp,
      subtotal,
      discount,
      taxableAmount,
      gstAmount,
      finalAmount
    });

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(html as string, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
    });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=quotation-${data.quotationNumber || id}.pdf`
    });
    res.send(pdfBuffer);

  }catch(error){
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
}


export const getSubCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      badRequest(res, "Category id is required");
      return;
    }

    const subCategory = await SubCategory.findAll({
      where: {
        CategoryId: id,
      },
    });

    // 🔥 Transform "text" → "tax"
    const formattedData = subCategory.map((item: any) => {
      const obj = item.toJSON();

      return {
        ...obj,
        tax: obj.text,   // rename
        text: undefined, // remove old field
      };
    });

    createSuccess(
      res,
      "Sub category list fetched successfully",
      formattedData
    );

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};
