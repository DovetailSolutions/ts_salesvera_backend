import { Op, fn, col, where, cast, literal } from "sequelize";
import { sequelize } from "../../config/dbConnection"
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
  Quotations,
  Company,
  Branch,
  Shift,
  Department,
  Holiday,
  CompanyLeave,
  CompanyBank,
  Invoices,
  RecordSales,
  Report
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";
import { ReadableStreamDefaultController } from "stream/web";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const R = 6371; // Earth radius in KM

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

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
      user: enrichedUser
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
    const loggedInId = Number(userData.userId);

    // ✅ Step 1: Fetch the logged-in user's own profile
    const item = await User.findByPk(loggedInId);
    if (!item) {
      badRequest(res, "User not found");
      return;
    }
    const profile = item.get({ plain: true }) as any;

    // ✅ Step 2: Walk UP the hierarchy to find the root admin
    // Chain: sale_person → manager → admin
    // We keep going until we find someone with role "admin" or "super_admin"
    let currentId = loggedInId;
    let rootAdminId: number | null = null;
    let parentUser: any = null;       // direct parent of the logged-in user
    let isFirst = true;               // track first level = direct parent

    while (true) {
      // Find who created the current user
      const currentUser = await User.findByPk(currentId, {
        include: [{
          model: User,
          as: "creators",           // 👈 "creators" = who created this user (parent)
          attributes: ["id", "firstName", "lastName", "email", "role"],
          through: { attributes: [] },
        }],
      });

      const plain = currentUser?.get({ plain: true }) as any;
      const creator = plain?.creators?.[0] || null;

      // Save direct parent (first iteration only)
      if (isFirst) {
        parentUser = creator
          ? { id: creator.id, firstName: creator.firstName, lastName: creator.lastName, email: creator.email, role: creator.role }
          : null;
        isFirst = false;
      }

      if (!creator) {
        // No more parents — stop here; current user is the root
        if (plain?.role === "admin" || plain?.role === "super_admin") {
          rootAdminId = currentId;
        }
        break;
      }

      // If the creator is an admin / super_admin → they are the root
      if (creator.role === "admin" || creator.role === "super_admin") {
        rootAdminId = creator.id;
        break;
      }

      // Otherwise go up one more level
      currentId = creator.id;
    }

    // ✅ Step 3: Attach the direct parent to the profile
    profile.parent = parentUser;

    // ✅ Step 4: Fetch the company linked to the root admin
    // sale_person → manager → admin → company (adminId = admin.id)
    if (rootAdminId) {
      const company = await Company.findOne({
        where: { adminId: rootAdminId },
        include: [
          {
            model: CompanyBank,
            as: "companyBanks",
            required: false,
          },
        ],
        // 👈 company where adminId = root admin's ID
      });
      profile.company = company || null;
    } else {
      // If the user IS the admin themselves, find their own company
      if (userData.role === "admin" || userData.role === "super_admin") {
        const company = await Company.findOne({
          where: { adminId: loggedInId },
        });
        profile.company = company || null;
      } else {
        profile.company = null;
      }
    }

    createSuccess(res, "user details", profile);
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
    {
      name: {
        [Op.iLike]: `${search}%`, // ✅ case-insensitive
      },
    },
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
          include: [
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

  console.log("req.body create meeting ");
  const transaction = await sequelize.transaction();

  try {
    const userData = req.userData as JwtPayload;
    const tokenUserId = userData?.userId;

    // const attendance = await Attendance.findOne({
    //   where: {
    //     employee_id: tokenUserId,
    //     status: "out",
    //   },
    // });

    // if (attendance) {
    //   badRequest(res, "You already punched out");
    //   return;
    // }

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
      address,
      gstNumber,
      remarks,
      pincode,
    } = req.body || {};



    console.log("req.body create meeting ", req.body);


    // Trim all string inputs to avoid trailing space errors in enums
    if (typeof customerType === "string") customerType = customerType.trim();
    if (typeof meetingPurpose === "string") meetingPurpose = meetingPurpose.trim();
    if (typeof status === "string") status = status.trim();
    if (typeof companyName === "string") companyName = companyName.trim();
    if (typeof personName === "string") personName = personName.trim();
    if (typeof mobileNumber === "string") mobileNumber = mobileNumber.trim();
    if (typeof companyEmail === "string") companyEmail = companyEmail.trim();
    if (typeof gstNumber === "string") gstNumber = gstNumber.trim();
    if (typeof remarks === "string") remarks = remarks.trim();

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
            email: contactEmail,
            userId: finalUserId,
            state,
            city,
            country,
            address,
            gstNumber,
            remarks,
            pincode,
            // meetingUserId: meetingContactUser?.id,
          },
          { transaction }
        );
      }
    }

    /** --------------------------
     * 2️⃣ Check Active Meeting
     * -------------------------- */



    console.log("finalUserId", finalUserId)
    console.log("meetingContactUser", meetingContactUser)
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
          address,
          gstNumber,
          remarks,
          pincode,
          meetingUserId: meetingContactUser?.id, // Link to Client
        },
        { transaction }
      );

    }
    const parseDateSafely = (dateStr: any) => {
      if (!dateStr || dateStr === "Invalid date" || dateStr === "") return null;
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
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
        pincode,
        scheduledTime: validScheduledTime,
      },
      { transaction }
    );

    /** --------------------------
     * 5️⃣ Save Images
     * -------------------------- */
    const files = req.files as Express.MulterS3.File[]
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

    // ✅ Validations
    if (!meetingId) {
      badRequest(res, "meetingId is required");
      return;
    }
    if (!latitude_out || !longitude_out) {
      badRequest(res, "latitude_out and longitude_out are required");
      return;
    }

    // ✅ Check meeting exists and is active
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

    // ✅ Update remarks if provided
    if (remarks) {
      const company = await MeetingCompany.findByPk(isExist.companyId);
      if (company) await company.update({ remarks });
    }

    // ✅ Mark meeting as ended
    isExist.status = "out";
    isExist.latitude_out = latitude_out;
    isExist.longitude_out = longitude_out;
    isExist.meetingTimeOut = new Date();
    await isExist.save();

    // ✅ Day range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // ✅ Get today's attendance (starting point)
    const attendance = await Attendance.findOne({
      where: {
        employee_id: finalUserId,
        date: { [Op.between]: [startOfDay, endOfDay] },
      },
      attributes: ["id", "latitude_in", "longitude_in"],
    });

    // ✅ Get all OTHER completed meetings today (excluding current)
    const previousMeetings = await Meeting.findAll({
      where: {
        userId: finalUserId,
        status: "out",
        id: { [Op.ne]: isExist.id },
        meetingTimeOut: { [Op.between]: [startOfDay, endOfDay] },
      },
      attributes: ["id", "latitude_out", "longitude_out", "meetingTimeOut", "legDistance"],
      order: [["meetingTimeOut", "ASC"]],
    });

    // ✅ Calculate leg distance (previous point → this meeting)
    let legDistance = 0;

    if (previousMeetings.length === 0) {
      // First meeting of the day → distance from attendance check-in
      if (
        attendance?.latitude_in &&
        attendance?.longitude_in &&
        isExist.latitude_out &&
        isExist.longitude_out
      ) {
        const lat1 = parseFloat(attendance.latitude_in);
        const lon1 = parseFloat(attendance.longitude_in);
        const lat2 = parseFloat(isExist.latitude_out);
        const lon2 = parseFloat(isExist.longitude_out);

        if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
          legDistance = getDistance(lat1, lon1, lat2, lon2);
        }
      }
    } else {
      // Nth meeting → distance from last completed meeting
      const lastMeeting = previousMeetings[previousMeetings.length - 1];

      if (
        lastMeeting.latitude_out &&
        lastMeeting.longitude_out &&
        isExist.latitude_out &&
        isExist.longitude_out
      ) {
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
    await isExist.save();

    createSuccess(res, "Meeting ended successfully", {
      meetingId: isExist.id,
      legDistance: `${isExist.legDistance} km`,   // e.g. "7.00 km"  (M1 → M2)
      totalDistance: `${isExist.totalDistance} km`, // e.g. "12.00 km" (A → M1 → M2)
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};



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

    console.log("finalUserId", finalUserId);

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
          include: [
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

    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    // 1) ✅ Check if already have an active session (status: present)
    const activeSession = await Attendance.findOne({
      where: {
        employee_id: finalUserId,
        status: "present",
      },
    });

    if (activeSession) {
      badRequest(res, "You have already punched-in. Please punch-out first.");
      return;
    }

    // 2) ✅ Check if this is the first punch of the day to determine "late" status
    const existingRecordsForToday = await Attendance.findOne({
      where: {
        employee_id: finalUserId,
        date: today,
      },
    });

    let late = false;
    if (!existingRecordsForToday) {
      const officeTime = new Date(`${today} 09:30:00`);
      const punchInTime = new Date(punch_in);
      if (punchInTime > officeTime) {
        late = true;
      }
    }

    // 3) ✅ Create attendance record
    const punchInTime = new Date(punch_in);
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

    // Find the current active session
    let whereClause: any = {
      employee_id: finalUserId,
      status: "present",
    };

    // Use specific ID if provided, otherwise find latest active
    if (AttendanceId) {
      whereClause.id = AttendanceId;
    }

    const attendance = await Attendance.findOne({
      where: whereClause,
      order: [["id", "DESC"]],
    });

    if (!attendance) {
      badRequest(res, "No active punch-in record found. Please punch-in first.");
      return;
    }

    const punchInTime = new Date(attendance.punch_in as Date);
    const punchOutTime = new Date(punch_out);

    if (punchOutTime < punchInTime) {
      badRequest(res, "Punch-out must be after punch-in");
      return;
    }

    // ✅ Calculate working hours for this session
    const diffMs = punchOutTime.getTime() - punchInTime.getTime();
    const workingHours = diffMs / (1000 * 60 * 60); // ms → hours
    const workingHoursRounded = Number(workingHours.toFixed(2));

    // ✅ Overtime calculation (Standard 8h)
    const officeHours = 8;
    const overtime =
      workingHoursRounded > officeHours
        ? Number((workingHoursRounded - officeHours).toFixed(2))
        : 0;

    // ✅ Update session to closed (status: out)
    attendance.punch_out = punchOutTime;
    attendance.working_hours = workingHoursRounded;
    attendance.overtime = overtime;
    attendance.latitude_out = latitude_out;
    attendance.longitude_out = longitude_out;
    attendance.status = "out";
    await attendance.save();

    createSuccess(res, "Punch-out recorded successfully", attendance);
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
        date: today,
      },
      order: [["id", "DESC"]], // Get latest entry
    });

    if (!record) {
      badRequest(res, "No attendance found for today");
      return;
    }

    createSuccess(res, "Today attendance fetched successfully", record);
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

    const { from_date, to_date, reason, leave_type } = req.body || {};

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

export const UpdatePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      badRequest(res, "Please provide old password and new password");
      return;
    }

    if (oldPassword === newPassword) {
      badRequest(res, "New password must be different from the old password");
      return;
    }

    // ✅ Fetch user
    const user = await Middleware.getById(User, Number(userData.userId));
    if (!user) {
      badRequest(res, "User not found");
      return;
    }

    // ✅ Now TypeScript knows `user` is not null
    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      user.get("password") as string
    );

    if (!isPasswordValid) {
      badRequest(res, "Old password is incorrect");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    await Middleware.Update(User, Number(userData.userId), {
      password: newHashedPassword,
    });

    createSuccess(res, "Password updated successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
    return;
  }
};

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
const generateQuotationNumber = async (): Promise<string> => {
  const count = await Quotations.count();
  const serial = count + 1;
  return String(serial).padStart(10, '0');
};

export const getQuotationPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    req.body.name




    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const data = req.body;

    // ✅ Auto-generate serial 10-digit quotation number
    const quotationNumber = await generateQuotationNumber();

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
      } catch (_) { }
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

    // ✅ Item-level calculations (India GST compliant)
    const isService = String(data.type || '').toLowerCase() === 'service';

    // Step 1: Compute per-item values
    const itemCalcs = data.items.map((item: any) => {
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
    const subtotal = itemCalcs.reduce((s: number, i: any) => s + i.itemTotal, 0);
    const totalDiscount = itemCalcs.reduce((s: number, i: any) => s + i.discAmt, 0);
    const taxableAmount = subtotal - totalDiscount;
    const totalGST = itemCalcs.reduce((s: number, i: any) => s + i.gstAmt, 0);
    const finalAmount = taxableAmount + totalGST;

    // Step 3: CGST / SGST / IGST split
    const gstRate = Number(data.gstRate || 0);
    let cgst = 0, sgst = 0, igst = 0;

    if (ownstate && clientState && ownstate === clientState) {
      // Intra-state → split equally
      cgst = totalGST / 2;
      sgst = totalGST / 2;
    } else {
      // Inter-state → IGST
      igst = totalGST;
    }

    // Alias for EJS template
    const discount = totalDiscount;

    // ✅ Render EJS
    const filePath = path.join(__dirname, "../../ejs/preview.ejs");

    const html = await ejs.renderFile(filePath, {
      ...data,
      quotationNumber,
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
    // await Quotations.create({
    //   userId: Number(userData?.userId),
    //   companyId: data.companyId || 0,
    //   quotation: { ...data, quotationNumber },
    //   status: "draft"
    // });

    // ✅ Puppeteer — generate PDF
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

    // ✅ Save PDF to uploads/pdf/
    const pdfFileName = `quotation-${quotationNumber}.pdf`;
    const pdfDir = path.join(__dirname, "../../../uploads/pdf");
    const pdfFilePath = path.join(pdfDir, pdfFileName);

    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    fs.writeFileSync(pdfFilePath, pdfBuffer);

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

  } catch (error) {
    res.status(400).json({ error: "Something went wrong" });
  }
};

export const addQuotation = async (req: Request, res: Response): Promise<void> => {
  try {

    const userData = req.userData as JwtPayload;

    // ✅ Auth validation
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return
    }


    const data = req.body;

    // ✅ Required field validation
    if (!data.customerName) {
      badRequest(res, "Customer name is required");
      return
    }

    // if (!data.referenceNumber) {
    //   badRequest(res, "Reference number is required");
    //   return
    // }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      badRequest(res, "Items are required");
      return
    }

    // ✅ Validate each item
    for (const item of data.items) {
      if (!item.itemName || !item.quantity || !item.rate) {
        badRequest(res, "Invalid item data");
        return
      }
    }

    // ✅ Duplicate check (IMPORTANT)
    // const existing = await Quotations.findOne({
    //   where: {
    //     userId: Number(userData.userId),
    //     referenceNumber: data.referenceNumber
    //   }
    // });

    // if (existing) {
    //   badRequest(res, "Quotation already exists with this reference number");
    //   return
    // }

    const quotationNumber = await generateQuotationNumber();

    // ✅ Create quotation
    const quotation = await Quotations.create({
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

  } catch (error) {
   const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
   
  }
};






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



export const getQuotationPdfList = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
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
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    // ✅ Validate status
    const allowedStatus = ["draft", "accepted", "rejected"];
    if (status && !allowedStatus.includes(status)) {
      return badRequest(res, "Invalid status value");
    }

    // ✅ Base where condition
    let whereCondition: any = {
      userId: userData.userId,
    };

    // ✅ Status filter
    if (status) {
      whereCondition.status = status;
    }

    // ✅ Company name filter (PostgreSQL JSON)
    if (companyName) {
      whereCondition[Op.and] = [
        literal(
          `LOWER("quotation"->'quotation'->>'companyName') = '${companyName.toLowerCase().replace(/'/g, "''")}'`
        ),
      ];
    }

     if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [
          new Date(startDate + "T00:00:00.000Z"),
          new Date(endDate + "T23:59:59.999Z"),
        ],
      };
    } else if (startDate) {
      whereCondition.createdAt = {
        [Op.gte]: new Date(startDate + "T00:00:00.000Z"),
      };
    } else if (endDate) {
      whereCondition.createdAt = {
        [Op.lte]: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    // ✅ Query
    const { count, rows } = await Quotations.findAndCountAll({
      where: whereCondition,
      order: [["createdAt", "ASC"]],
      limit,
      offset,
    });

    const updatedRows = rows.map((item: any, rowIndex: number) => {
      const data = item.toJSON();
      const { quotation, ...rest } = data;

      const finalQuotation = quotation?.quotation || quotation;

      // ✅ Add index inside items
      if (finalQuotation?.items && Array.isArray(finalQuotation.items)) {
        finalQuotation.items = finalQuotation.items.map(
          (itm: any, itemIndex: number) => ({
            index: itemIndex + 1, // item index
            ...itm,
          })
        );
      }

      return {
        ...rest,
        rowIndex: offset + rowIndex + 1, // pagination-aware index
        quotation: finalQuotation,
      };
    });

    return createSuccess(res, "Quotation list fetched successfully", {
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: updatedRows,
    });

  } catch (error) {
    console.error("API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";

    return badRequest(res, errorMessage);
  }
};



export const downloadQuotationPdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ─── Fetch quotation record ────────────────────────────────────────────
    const quotation = await Quotations.findByPk(id);
    if (!quotation) {
      badRequest(res, "Quotation not found");
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



  } catch (error) {
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



export const updateQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    console.log("id", id, "status", status);
    if (!id) {
      badRequest(res, "Quotation id is required");
      return;
    }
    const quotationData = await Quotations.findByPk(id);
    if (!quotationData) {
      badRequest(res, "Quotation not found");
      return;
    }
    quotationData.status = status;
    await quotationData.save();
    createSuccess(res, "Quotation updated successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
}


export const getCompany = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "10",
      search = "",
      companyName,
      city,
      state,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Math.min(Number(limit), 50); // safety limit
    const offset = (pageNumber - 1) * pageSize;

    // ✅ Dynamic where condition
    const whereCondition: any = {};

    // 🔍 Global search
    if (search) {
      whereCondition[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { state: { [Op.like]: `%${search}%` } },
      ];
    }

    // 🎯 Filters
    if (companyName) {
      whereCondition.companyName = {
        [Op.like]: `%${companyName}%`,
      };
    }

    if (city) {
      whereCondition.city = {
        [Op.like]: `%${city}%`,
      };
    }

    if (state) {
      whereCondition.state = {
        [Op.like]: `%${state}%`,
      };
    }

    // ✅ Query with count
    const { rows, count } = await Company.findAndCountAll({
      where: whereCondition,
      limit: pageSize,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ Response
    createSuccess(res, "Company list fetched successfully", {
      total: count,
      currentPage: pageNumber,
      totalPages: Math.ceil(count / pageSize),
      data: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getCompanyDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      badRequest(res, "Company id is required");
      return;
    }

    const company = await Company.findByPk(id, {
      include: [
        {
          model: Branch,
          as: "branches"
        },
        {
          model: Department,
          as: "departments"
        },
        {
          model: Holiday,
          as: "holidays"
        },
        {
          model: Shift,
          as: "shifts"
        },
        {
          model: CompanyLeave,
          as: "companyLeaves"
        }
      ]
    });
    if (!company) {
      badRequest(res, "Company not found");
      return;
    }
    createSuccess(
      res,
      "Company details fetched successfully",
      company
    );

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const addInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const data = req.body;

    // if (!data.tallyInvoiceNumber) {
    //   badRequest(res, "Invoice number (tallyInvoiceNumber) is required");
    //   return;
    // }

    

    if (!data.customerName) {
      badRequest(res, "Customer name is required");
      return;
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      badRequest(res, "Items are required");
      return;
    }

    // ✅ Validate each item
    for (const item of data.items) {
      if (!item.itemName || !item.quantity || !item.rate) {
        badRequest(res, "Invalid item data: itemName, quantity, and rate are required");
        return;
      }
    }
     let invoice = await generateQuotationNumber();
    // ✅ Extract fields for explicit columns and group the rest into 'invoice' JSON
    const {
      invoiceNumber = invoice,
      tallyInvoiceNumber = "web",
      customerName,
      quotationId,
      status,
      QuotationNumber,
      QuotationDate,
      date,
      ...restData
    } = data;

    // ✅ Prepare DB object
    const invoicePayload: any = {
      userId: userData.userId,
      companyId: userData.companyId || 0,
      invoiceNumber: invoiceNumber,
      customerName: customerName,
      quotationId: quotationId || null,
      status: status || "draft",
      quotationNumber: QuotationNumber || null,
      quotationDate: QuotationDate ? new Date(QuotationDate) : null,
      invoiceDate: date ? new Date(date) : null,
      invoice: restData, // remaining JSON properties stored here
    };

    // ✅ Create invoice
    const invoiceData = await Invoices.create(invoicePayload);

    createSuccess(res, "Invoice added successfully", invoiceData);

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { page = "1", limit = "10", search = "",status, companyName, city, state,startDate,  // ✅ new
      endDate  } = req.query;

    const pageNumber = Number(page);
    const pageSize = Math.min(Number(limit), 50); // safety limit
    const offset = (pageNumber - 1) * pageSize;

    // ✅ Dynamic where condition
    const whereCondition: any = {
      userId: userData.userId,
    };

    // 🔍 Global search
    if (search) {
      whereCondition[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { state: { [Op.like]: `%${search}%` } },
      ];
    } 

   if(status){
    whereCondition.status = status;
   }

   if(!status){
    whereCondition.status ={
      [Op.in]: ["draft","imported"]
    }
   }
    // 🎯 Filters
    if (companyName) {
      whereCondition.companyName = {
        [Op.like]: `%${companyName}%`,
      };
    }


    if (city) {
      whereCondition.city = {
        [Op.like]: `%${city}%`,
      };
    }

    if (state) {
      whereCondition.state = {
        [Op.like]: `%${state}%`,
      };
    }

      if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [
          new Date(startDate as string),
          new Date(endDate as string),
        ],
      };
    } else if (startDate) {
      whereCondition.createdAt = {
        [Op.gte]: new Date(startDate as string),
      };
    } else if (endDate) {
      whereCondition.createdAt = {
        [Op.lte]: new Date(endDate as string),
      };
    }

    const invoiceData = await Invoices.findAll({
      where: whereCondition,
      limit: pageSize,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });
    createSuccess(res, "Invoice list fetched successfully", invoiceData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}



// export const quotationToInvoice = async(req:Request,res:Response):Promise<void>=>{
//   try{
//     const userData = req.userData as JwtPayload;
//     if(!userData || !userData.userId){
//       badRequest(res, "Unauthorized request");
//       return;
//     }
//     const {id} = req.params;
//     if(!id){
//       badRequest(res, "Quotation id is required");
//       return;
//     }
//     const quotationData = await Quotations.findByPk(id);
//     if(!quotationData){
//       badRequest(res, "Quotation not found");
//       return;
//     }
//     const invoicePayload: any = {
//       userId: userData.userId,
//       companyId: userData.companyId || 0,
//       invoiceNumber: quotationData.quotationNumber,
//       customerName: quotationData.customerName,
//       status: quotationData.status,
//       quotationNumber: quotationData.quotationNumber,
//       quotationDate: quotationData.quotationDate,
//       dueDate: quotationData.dueDate,
//       invoice: quotationData.invoice,
//     };
//     const invoiceData = await Invoices.create(invoicePayload);
//     createSuccess(res, "Invoice added successfully", invoiceData);
//   }catch(error){
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// }


export const recordSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const data = req.body;
    if (!data.customerName) {
      badRequest(res, "Customer name is required");
      return;
    }
    if (!data.productDescription) {
      badRequest(res, "Product description is required");
      return;
    }
    if (!data.saleAmount) {
      badRequest(res, "Sale amount is required");
      return;
    }
    const recordSalePayload: any = {
      userId: userData.userId,
      companyId: data.companyId || 0,
      customerName: data.customerName,
      productDescription: data.productDescription,
      saleAmount: data.saleAmount,
      remarks: data.remarks,
      paymentReceived: data.paymentReceived,
    };
    const recordSaleData = await RecordSales.create(recordSalePayload);
    createSuccess(res, "Record sale added successfully", recordSaleData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}

export const getRecordSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const recordSaleData = await RecordSales.findAll({
      where: {
        userId: userData.userId,
      }
    });
    createSuccess(res, "Record sale list fetched successfully", recordSaleData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}

export const getRecordSaleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { id } = req.params;
    if (!id) {
      badRequest(res, "Record sale id is required");
      return;
    }
    const recordSaleData = await RecordSales.findByPk(id);
    if (!recordSaleData) {
      badRequest(res, "Record sale not found");
      return;
    }
    createSuccess(res, "Record sale fetched successfully", recordSaleData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}

export const updateRecordSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { id } = req.params;
    if (!id) {
      badRequest(res, "Record sale id is required");
      return;
    }
    const recordSaleData = await RecordSales.findByPk(id);
    if (!recordSaleData) {
      badRequest(res, "Record sale not found");
      return;
    }
    const data = req.body;
    if (!data.customerName) {
      badRequest(res, "Customer name is required");
      return;
    }
    if (!data.productDescription) {
      badRequest(res, "Product description is required");
      return;
    }
    if (!data.saleAmount) {
      badRequest(res, "Sale amount is required");
      return;
    }
    const recordSalePayload: any = {
      userId: userData.userId,
      companyId: userData.companyId || 0,
      customerName: data.customerName,
      productDescription: data.productDescription,
      saleAmount: data.saleAmount,
      remarks: data.remarks,
      paymentReceived: data.paymentReceived,
    };
    const updateResult = await RecordSales.update(recordSalePayload, { where: { id } });
    createSuccess(res, "Record sale updated successfully", updateResult);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}

export const deleteRecordSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { id } = req.params;
    if (!id) {
      badRequest(res, "Record sale id is required");
      return;
    }
    const recordSaleData = await RecordSales.findByPk(id);
    if (!recordSaleData) {
      badRequest(res, "Record sale not found");
      return;
    }
    const deleteResult = await RecordSales.destroy({ where: { id } });
    createSuccess(res, "Record sale deleted successfully", deleteResult);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}




export const getTallyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData?.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const {
      page = "1",
      limit = "10",
      search = "",
      status,
      customerName,
      referenceNo,
      date,
      startDate,
      endDate,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Number(limit) || 10, 50);
    const offset = (pageNumber - 1) * pageSize;

    // ==============================
    // 🔼 STEP 1: FIND PARENT & ROOT
    // ==============================
    let currentId = userData.userId;
    let rootAdmin: any = null;
    let parentUser: any = null;
    let isFirstStep = true;

    while (true) {
      const userWithCreators = await User.findByPk(currentId, {
        include: [
          {
            model: User,
            as: "creators",
            attributes: ["id", "firstName", "lastName", "email", "role"],
            through: { attributes: [] },
          },
        ],
      }) as any;

      if (!userWithCreators) break;

      const plainUser = userWithCreators.get({ plain: true });
      const creator = plainUser.creators?.[0] || null;

      if (isFirstStep) {
        parentUser = creator
          ? {
              id: creator.id,
              firstName: creator.firstName,
              lastName: creator.lastName,
              email: creator.email,
              role: creator.role,
            }
          : null;
        isFirstStep = false;
      }

      if (!creator) {
        if (["admin", "super_admin"].includes(plainUser.role)) {
          rootAdmin = {
            id: plainUser.id,
            firstName: plainUser.firstName,
            lastName: plainUser.lastName,
            email: plainUser.email,
            role: plainUser.role,
          };
        }
        break;
      }

      if (["admin", "super_admin"].includes(creator.role)) {
        rootAdmin = {
          id: creator.id,
          firstName: creator.firstName,
          lastName: creator.lastName,
          email: creator.email,
          role: creator.role,
        };
        break;
      }

      currentId = creator.id;
    }

    // ==============================
    // 🔽 STEP 2: TEAM USERS
    // ==============================
    let teamUserIds: number[] = [userData.userId];
    let currentParentIds: number[] = [userData.userId];

    while (currentParentIds.length > 0) {
      const subUsers = await User.findAll({
        where: { id: { [Op.in]: currentParentIds } },
        include: [
          {
            model: User,
            as: "createdUsers",
            attributes: ["id"],
          },
        ],
      });

      let nextLevel: number[] = [];

      subUsers.forEach((u: any) => {
        (u.createdUsers || []).forEach((child: any) => {
          if (!teamUserIds.includes(child.id)) {
            teamUserIds.push(child.id);
            nextLevel.push(child.id);
          }
        });
      });

      currentParentIds = nextLevel;
    }

    // ==============================
    // ✅ STEP 3: FILTERS (FIXED)
    // ==============================
    const andConditions: any[] = [
      { userId: rootAdmin ? rootAdmin.id : { [Op.in]: teamUserIds } },
    ];

    // 🔍 Search
    if (search) {
      andConditions.push({
        [Op.or]: [
          { customerName: { [Op.like]: `%${search}%` } },
          { referenceNo: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    // 🎯 Status
    if (status) {
      const statusArray = Array.isArray(status)
        ? status.map((s) => String(s))
        : typeof status === "string"
        ? status.split(",").map((s) => s.trim())
        : [String(status)];

      andConditions.push({
        status: { [Op.in]: statusArray },
      });
    }

    // 🎯 Specific Filters
    if (customerName) {
      andConditions.push({
        customerName: { [Op.like]: `%${customerName}%` },
      });
    }

    if (referenceNo) {
      andConditions.push({
        referenceNo: { [Op.like]: `%${referenceNo}%` },
      });
    }

    if (date) {
      andConditions.push({
        date: { [Op.like]: `%${date}%` },
      });
    }

    // 📅 Date filter
    if (startDate && endDate) {
      andConditions.push({
        createdAt: {
          [Op.between]: [
            new Date(startDate as string),
            new Date(endDate as string),
          ],
        },
      });
    } else if (startDate) {
      andConditions.push({
        createdAt: {
          [Op.gte]: new Date(startDate as string),
        },
      });
    } else if (endDate) {
      andConditions.push({
        createdAt: {
          [Op.lte]: new Date(endDate as string),
        },
      });
    }

    const whereCondition = {
      [Op.and]: andConditions,
    };

    // ==============================
    // ✅ STEP 4: QUERY
    // ==============================
    const { count, rows } = await Report.findAndCountAll({
      where: whereCondition,
      limit: pageSize,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ==============================
    // ✅ RESPONSE
    // ==============================
    createSuccess(res, "Reports fetched successfully", {
      totalItems: count,
      currentPage: pageNumber,
      totalPages: Math.ceil(count / pageSize),
      // parent: parentUser,
      // rootAdmin: rootAdmin,
      data: rows,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};
