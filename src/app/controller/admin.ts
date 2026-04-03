
import { Op, fn, col, cast,literal} from "sequelize";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import ejs from "ejs";
import fs from "fs";
import path from "path";
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
  MeetingCompany,
  MeetingUser,
  Attendance,
  Leave,
  Expense,
  // Quotation,
  SubCategory,
  Quotations,
  Company,
  Branch,Shift,
  Department,
  Holiday
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";
import { S3 } from "@aws-sdk/client-s3";

const UNIQUE_ROLES = ["super_admin"];

const getPagination = (req: Request) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const findUser = async (userId: number) => {
  return User.findOne({
    where: { id: userId },
    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
  });
};

export const Register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      dob,
      role,
      createdBy,
    } = req.body;
    /** ✅ Required field validation */
    const requiredFields: Record<string, any> = {
      email,
      password,
      firstName,
      lastName,
      phone,
      dob,
      role,
    };

    for (const key in requiredFields) {
      if (!requiredFields[key]) {
        badRequest(res, `${key} is required`);
        return;
      }
    }
    /** ✅ Check if user with same email exists */
    const isExist = await Middleware.FindByEmail(User, email);
    if (isExist) {
      badRequest(res, "Email already exists");
      return;
    }

    /** ✅ Check role — admin/super_admin only once in DB */
    if (UNIQUE_ROLES.includes(role)) {
      const existing = await Middleware.findByRole(User, role);
      if (existing) {
        badRequest(
          res,
          `${role} already exists. Only one ${role} can be created.`
        );
        return;
      }
    }

    const obj: any = {
      email,
      password,
      firstName,
      lastName,
      phone,
      dob,
      role,
    };
    const item = await User.create(obj);

    if ((role === "sale_person" || role === "manager" || role === "admin") && createdBy) {
      const ids = Array.isArray(createdBy)
        ? createdBy.map((id: any) => Number(id)).filter((id) => !isNaN(id))
        : [Number(createdBy)].filter((id) => !isNaN(id));

      if (ids.length > 0) {
        // ✅ Connect relations
        await (item as any).setCreators(ids);
      }
    }

    /** ✅ JWT Tokens */
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(item.getDataValue("id")),
      String(item.getDataValue("role"))
    );
    await item.update({ refreshToken });
    createSuccess(res, `${role} registered successfully`, {
      item,
      accessToken,
      // refreshToken,
    });
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
    return;
  }
};




export const Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      badRequest(res, "Email and password are required");
    }

    // Find user
    const user = await Middleware.FindByEmail(User, email);
    if (!user) {
      badRequest(res, "Invalid email or password");
    }

    // Allowed roles
    const allowedRoles = ["admin", "manager", "super_admin"];

    if (!allowedRoles.includes(user.get("role"))) {
      badRequest(res, "Access restricted. Only admin & manager can login.");
    }

    // Validate password
    const hashedPassword = user.get("password");
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordValid) {
      badRequest(res, "Invalid email or password");
    }

    // Create tokens
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(user.get("id")),
      String(user.get("role"))
    );

    // Save refresh token
    await user.update({ refreshToken });

    createSuccess(res, "Login successful", {
      accessToken,
      refreshToken,
      user,
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
    const user = await Middleware.getById(User, Number(userData.userId));
    createSuccess(res, "User profile fetched successfully", user);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
    return;
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

export const MySalePerson = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search = "", managerId } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const userData = req.userData as JwtPayload;
    const managerID = managerId ? Number(managerId) : userData.userId;

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
    const result = await User.findByPk(managerID, {
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

export const assignSalesman = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { managerId, saleId } = req.body || {};

    if (!managerId || !saleId) {
      badRequest(res, "managerId & saleId are required");
      return;
    }
    const manager = await User.findOne({ where: { id: managerId } });
    if (!manager) {
      badRequest(res, "Manager not found");
      return;
    }

    if (manager.role !== "manager") {
      badRequest(res, "User is not a manager");
      return;
    }

    const ids = Array.isArray(saleId) ? saleId.map(Number) : [Number(saleId)];
    await (manager as any).setCreatedUsers(ids);
    createSuccess(res, "Salesman assigned");
    return;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const GetAllUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { page = 1, limit = 10, search = "", role } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const loggedInId = userData?.userId; // 👈 Logged-in user ID

    const where: any = {
      id: { [Op.ne]: loggedInId }, // ✅ Exclude logged-in user
    };

    if (role) where.role = role;

    // Search filter
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }
    type PlainUser = ReturnType<(typeof rows)[number]["get"]> & {
      creator?: any;
    };

    const { rows, count } = await User.findAndCountAll({
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phone",
        "role",
        "createdAt",
      ],
      where,
      offset,
      limit: limitNum,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "creators",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
          through: { attributes: [] },
          required: false,
        },
      ],
    });

    type UserWithCreator = {
      [key: string]: any;
      creator?: any;
    };

    const finalRows: UserWithCreator[] = rows.map((user) => {
      const u = user.get({ plain: true }) as UserWithCreator;

      u.creator = u.creators?.[0] || null;
      delete u.creators;

      return u;
    });

    createSuccess(res, "Users fetched successfully", {
      page: pageNum,
      limit: limitNum,
      total: count,
      finalRows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const AddCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const { category_name } = req.body || {};
    if (!category_name) {
      badRequest(res, "category name is missing");
      return;
    }
    const isCategoryExist = await Middleware.FindByField(
      Category,
      "category_name",
      category_name,
      loggedInId
    );
    if (isCategoryExist) {
      badRequest(res, "Category already exists");
      return;
    }
    const item = await Category.create({
      category_name,
      adminId: loggedInId,
      managerId: loggedInId,
    });
    createSuccess(res, "category create successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
    return;
  }
};
export const getcategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const role = userData?.role;

    let ll = loggedInId; // default (admin or fallback)

    let manager: any = null;

    // 🔹 If logged-in user is MANAGER → fetch admin (creator)
    if (role === "manager") {
      manager = await User.findByPk(loggedInId, {
        attributes: ["id", "role"],
        include: [
          {
            model: User,
            as: "creators",
            attributes: ["id", "role"],
            through: { attributes: [] },
          },
        ],
      });

      const plain = manager?.get({ plain: true }) as any;

      if (plain?.creators?.length > 0) {
        ll = plain.creators[0].id; // parent admin ID
      }
    }
    // 🔹 Continue with your category function
    const data = req.query;
    const item = await Middleware.getCategory(Category, data, "", ll);

    createSuccess(res, "category list", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const categoryDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }
    const category = await Middleware.getById(Category, Number(id));
    if (!category) {
      badRequest(res, "Category not found");
      return;
    }
    createSuccess(res, "Category details fetched successfully", category);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};
export const UpdateCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { category_name } = req.body || {};
    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }

    if (!category_name) {
      badRequest(res, "Category name is missing");
      return;
    }

    // ✅ Check if category with same name already exists
    const isCategoryExist = await Middleware.FindByField(
      Category,
      "category_name",
      category_name,
      ""
    );

    if (isCategoryExist) {
      badRequest(res, "Category already exists");
      return;
    }

    const updatedCategory = await Middleware.UpdateData(
      Category,
      id,
      { category_name } // Pass as object
    );
    if (!updatedCategory) {
      badRequest(res, "Category not found");
      return;
    }
    createSuccess(res, "Category updated successfully", updatedCategory);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};
export const DeleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }
    const item = await Middleware.DeleteItembyId(Category, Number(id));
    if (!item) {
      badRequest(res, "Category not found");
      return;
    }
    createSuccess(res, "category delete successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getMeeting = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      userId,
      date,
      empty,
    } = req.query;
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const role = userData?.role;
    let ll = loggedInId;
    let manager: any = null;
    if (role === "manager") {
      manager = await User.findByPk(loggedInId, {
        attributes: ["id", "role"],
        include: [
          {
            model: User,
            as: "creators",
            attributes: ["id", "role"],
            through: { attributes: [] },
          },
        ],
      });

      const plain = manager?.get({ plain: true }) as any;

      if (plain?.creators?.length > 0) {
        ll = plain.creators[0].id; // parent admin ID
      }
    }


    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    // adminId:ll
    const where: any = {};

    if (empty === "true") {
      where.userId = null;
      where.userId = ll; // <-- correctly added to where clause
    }

    if (userId) where.userId = userId;
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { personName: { [Op.iLike]: `%${search}%` } },
      ];
    }

    /** ✅ Filter by Date (UTC) */
    if (date) {
      const inputDate = new Date(String(date));

      const start = new Date(inputDate);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(inputDate);
      end.setUTCHours(23, 59, 59, 999);

      where.meetingTimeIn = {
        [Op.between]: [start, end],
      };
    }

    const { rows, count } = await MeetingUser.findAndCountAll({
      // attributes: [
      //   "id",
      //   "companyName",
      //   "personName",
      //   "mobileNumber",
      //   "companyEmail",
      //   "meetingTimeIn",
      //   "meetingTimeOut",
      //   "meetingPurpose",
      //   "userId",
      // ],
      where,
      offset,
      limit: limitNum,
      order: [["createdAt", "DESC"]],
    });

    if (rows.length == 0) {
      badRequest(res, "Not meeting found");
      return;
    }
    createSuccess(res, "User Meeting fetched successfully", {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum),
      rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

interface MulterS3File extends Express.Multer.File {
  bucket: string;
  key: string;
  location?: string;
  etag?: string;
}

export const BulkUploads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    let loginUser = userData?.userId;
    // Correct check for multer.single()
    if (!req.file) {
      badRequest(res, "CSV file is required");
      return;
    }
    const csvFile = req.file as MulterS3File;

    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const params = {
      Bucket: csvFile.bucket,
      Key: csvFile.key,
    };

    const data = await s3.send(new GetObjectCommand(params));
    if (!data.Body) {
      badRequest(res, "Unable to read CSV from S3");
      return;
    }
    const stream = data.Body as Readable;
    const results: any[] = [];
    stream
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim(),
        })
      )
      .on("data", (row) => {
        results.push({
          name: row.name?.trim() || "",
          email: row.email?.trim() || "",
          mobile: row.mobile?.trim() || "",
          customerType: "existing",
          userId: loginUser,
        });
      })
      .on("end", async () => {
        try {
          const uniqueRows: any[] = [];
          for (const r of results) {
            const exists = await MeetingUser.findOne({
              where: {
                [Op.or]: [{ adminId: loginUser }, { managerId: loginUser }],
                companyName: { [Op.in]: results.map((r) => r.companyName) },
                personName: { [Op.in]: results.map((r) => r.personName) },
                mobileNumber: { [Op.in]: results.map((r) => r.mobileNumber) },
                companyEmail: { [Op.in]: results.map((r) => r.companyEmail) },
              },
            });
            // If NOT found → add to insert list
            if (!exists) {
              uniqueRows.push(r);
            }
          }

          // Insert ONLY new rows
          if (uniqueRows.length > 0) {
            await MeetingUser.bulkCreate(uniqueRows);
          }

          return createSuccess(res, "Bulk upload successful", {
            totalCSV: results.length,
            inserted: uniqueRows.length,
            duplicatesSkipped: results.length - uniqueRows.length,
          });
        } catch (err) {
          badRequest(res, "file upload error" + err);
          return;
        }
      });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const approveLeave = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { employee_id, leaveID, status } = req.body;

    if (!employee_id) badRequest(res, "Employee id is missing");
    if (!leaveID) badRequest(res, "leaveID id is missing");

    const obj: any = {};
    if (status) {
      obj.status = status;
    }

    // Update Status
    await Leave.update(obj, {
      where: { employee_id, id: leaveID },
    });
    if (status === "rejected") {
      await Attendance.update(
        { status: "leaveReject" },
        { where: { employee_id, status: "leave" } }
      );
    }
    if (status === "approved") {
      await Attendance.update(
        { status: "leaveApproved" },
        { where: { employee_id, status: "leave" } }
      );
    }

    // Fetch updated leave after update
    const updatedLeave = await Leave.findOne({
      where: { employee_id, id: leaveID },
      attributes: ["id", "employee_id", "status"], // choose fields you need
    });

    if (!updatedLeave) {
      badRequest(res, "Leave not found");
      return;
    }

    createSuccess(res, "Status updated", updatedLeave);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const test = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { page = 1, limit = 10, search = "", role } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const loggedInId = userData?.userId;
    const mainWhere: any = { id: loggedInId };
    const createdWhere: any = {};

    if (search) {
      createdWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Get total count
    const totalCount = await User.count({
      where: mainWhere,
    });

    const rows = await User.findByPk(loggedInId, {
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phone",
        "role",
        "createdAt",
      ],
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "phone",
            "role",
            "createdAt",
          ],
          through: { attributes: [] },
          where: createdWhere,
          required: false,
          include: [
            {
              model: User,
              as: "createdUsers",
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "createdAt",
              ],
              through: { attributes: [] },
              where: createdWhere,
              required: false,
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    createSuccess(res, "Users fetched successfully", {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      pages: Math.ceil(totalCount / limitNum),
      user: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const UpdateExpense = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { approvedByAdmin, approvedBySuperAdmin, userId, expenseId, role } =
      req.body || {};

    // Validate userId
    if (!userId) {
      badRequest(res, "userId is missing");
      return;
    }
    if (!expenseId) {
      badRequest(res, "expenseId is missing");
      return;
    }

    // Get expense record
    const item = await Expense.findOne({ where: { userId, id: expenseId } });

    if (!item) {
      badRequest(res, "Expense record not found");
      return;
    }

    // ---------- Manager Approval ----------
    if (role === "manager") {
      item.approvedByAdmin = approvedByAdmin;
      await item.save();

      createSuccess(res, "Manager approval updated", { expense: item });
      return;
    }

    // ---------- Admin Approval ----------
    if (role === "admin") {
      // Check if manager approved first
      if (item.approvedByAdmin !== "accepted") {
        badRequest(res, "Manager must approve first before admin approval.");
        return;
      }

      item.approvedBySuperAdmin = approvedBySuperAdmin;
      await item.save();

      createSuccess(res, "Admin approval updated", { expense: item });
      return;
    }

    badRequest(res, "Invalid role provided");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

// export const leaveList = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const { page = 1, limit = 10, search = "", role } = req.query;

//     const pageNum = Number(page);
//     const limitNum = Number(limit);
//     const offset = (pageNum - 1) * limitNum;

//     const loggedInId = userData?.userId;
//     const mainWhere: any = { id: loggedInId };
//     const createdWhere: any = {};

//     if (search) {
//       createdWhere[Op.or] = [
//         { firstName: { [Op.iLike]: `%${search}%` } },
//         { lastName: { [Op.iLike]: `%${search}%` } },
//         { email: { [Op.iLike]: `%${search}%` } },
//         { phone: { [Op.iLike]: `%${search}%` } },
//       ];
//     }

//     // Get total count
//     const totalCount = await User.count({
//       where: mainWhere,
//       // include: [
//       //   {
//       //     model: User,
//       //     as: "createdUsers",
//       //     where: createdWhere,
//       //     required: false,
//       //   },
//       // ],
//     });

//     const rows = await User.findByPk(loggedInId, {
//       attributes: [
//         "id",
//         "firstName",
//         "lastName",
//         "email",
//         "phone",
//         "role",
//         "createdAt",
//       ],
//       include: [
//         {
//           model: User,
//           as: "createdUsers",
//           attributes: ["id", "firstName", "lastName", "email", "phone", "role","createdAt"],
//           through: { attributes: [] },
//           where: createdWhere,
//           required: false,
//           include: [
//             {
//               model: User,
//               as: "createdUsers",
//               attributes: [
//                 "id",
//                 "firstName",
//                 "lastName",
//                 "email",
//                 "phone",
//                 "role",
//                 "createdAt"
//               ],
//               through: { attributes: [] },
//               where: createdWhere,
//               required: false,
//               include: [
//                 {
//                   model: Leave,
//                   as: "Leaves",
//                   required: false,
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//       order: [["createdAt", "DESC"]],
//     });

//     createSuccess(res, "Users fetched successfully", {
//       page: pageNum,
//       limit: limitNum,
//       total: totalCount,
//       pages: Math.ceil(totalCount / limitNum),
//       user: rows,
//     });
//   } catch (error) {
//       const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//     return;
//   }
// };
type UserWithChildren = any & {
  createdUsers?: UserWithChildren[];
};

async function getAllChildUserIds(userId: number): Promise<number[]> {
  const result = new Set<number>();

  async function fetchLevel(id: number) {
    const user = (await User.findByPk(id, {
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    })) as UserWithChildren;

    if (!user?.createdUsers) return;

    for (const child of user.createdUsers) {
      if (!result.has(child.id)) {
        result.add(child.id);
        await fetchLevel(child.id); // recursive call
      }
    }
  }

  await fetchLevel(userId);

  return Array.from(result);
}

export const leaveList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;
    const { status } = req.query;
    const { page, limit, offset } = getPagination(req);
    // <- status comes from query
    const childIds = await getAllChildUserIds(loggedInId);

    const allUserIds = [loggedInId, ...childIds];

    const { rows, count } = await User.findAndCountAll({
      where: {
        id: {
          [Op.in]: allUserIds, // include all child users
          [Op.ne]: loggedInId, // ❌ exclude logged-in user
        },
      },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phone",
        "role",
        "createdAt",
      ],
      include: [
        {
          model: Leave,
          as: "Leaves",
          required: false,
          where: status ? { status } : undefined,
        },
      ],
      // attributes: ["id", "fromDate", "toDate", "status", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      message: "Leaves fetched successfully",
      data: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return;
  }
};

export const GetExpense = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;
    const search = req.query.search
    const { page, limit, offset } = getPagination(req);
    const childIds = await getAllChildUserIds(loggedInId);

    const allUserIds = [loggedInId, ...childIds];

    const { approvedByAdmin, approvedBySuperAdmin } = req.query;

    // 🔥 Build dynamic where condition
    const expenseWhere: any = {
      userId: { [Op.in]: allUserIds },
    };
    let userWhere: any = {};

    if (approvedByAdmin !== undefined) {
      expenseWhere.approvedByAdmin = approvedByAdmin;
    }

    if (approvedBySuperAdmin !== undefined) {
      expenseWhere.approvedBySuperAdmin = approvedBySuperAdmin;
    }

    if (search) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ]
    }

    const { rows, count } = await Expense.findAndCountAll({
      where: expenseWhere, // 👈 final merged condition
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
          required: false,
          where: userWhere,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (rows.length === 0) {
      badRequest(res, "data not found");
    }

    res.status(200).json({
      success: true,
      message: "Expense fetched successfully",
      data: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

// export const getAttendance = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;
//     const loggedInId = userData.userId;
//     const { page, limit, offset } = getPagination(req);

//     const childIds = await getAllChildUserIds(loggedInId);
//     const allUserIds = [loggedInId, ...childIds]; // keep full list

//     const todayStart = new Date();
//     todayStart.setHours(0, 0, 0, 0);

//     const todayEnd = new Date();
//     todayEnd.setHours(23, 59, 59, 999);

//     const leaves = await User.findAll({
//       where: {
//         id: {
//           [Op.in]: allUserIds, // include all child users
//           [Op.ne]: loggedInId, // ❌ exclude logged-in user
//         },
//       },
//       attributes: [
//         "id",
//         "firstName",
//         "lastName",
//         "email",
//         "phone",
//         "role",
//         "createdAt",
//       ],
//       include: [
//         {
//           model: Attendance,
//           as: "Attendances",
//           where: {
//             punch_in: {
//               [Op.between]: [todayStart, todayEnd],
//             },
//           },
//           required: false,
//         },
//       ],
//       order: [["createdAt", "DESC"]],
//     });

//     res.status(200).json({
//       success: true,
//       message: "Attendance fetched successfully",
//       data: leaves,
//       // pagination: {
//       //   totalRecords: count,
//       //   totalPages: Math.ceil(count / limit),
//       //   currentPage: page,
//       //   limit,
//       // },
//     });
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };


export const getAttendance = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;
    const { page, limit, offset } = getPagination(req);

    const childIds = await getAllChildUserIds(loggedInId);
    const allUserIds = [loggedInId, ...childIds];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { rows, count } = await User.findAndCountAll({
      where: {
        id: {
          [Op.in]: allUserIds,
          [Op.ne]: loggedInId, // exclude logged-in user
        },
      },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phone",
        "role",
        "createdAt",
      ],
      include: [
        {
          model: Attendance,
          as: "Attendances",
          where: {
            punch_in: {
              [Op.between]: [todayStart, todayEnd],
            },
          },
          required: false,
        },
      ],
      offset,
      limit,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

const getDateFilter = (query: any) => {
  const { startDate, endDate, lastDays, today } = query;
  const filter: any = {};

  //  between

  if (startDate && endDate) {
    filter[Op.between] = [new Date(startDate), new Date(endDate)];
  }
  // only start date
  if (startDate) {
    filter[Op.gte] = new Date(startDate);
  }

  if (endDate) {
    filter[Op.lte] = new Date(endDate);
  }

  if (lastDays) {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - Number(lastDays));
    filter[Op.between] = [past, now];
  }

  if (today === "true") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    filter[Op.between] = [start, end];
  }
  return filter;
};

const fetchData = async (
  model: any,
  where: any,
  limit: number,
  offset: number,
  dateFilter?: any
) => {
  return await model.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });
};

export const userAttendance = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return badRequest(res, "UserId is required", 400);

    const { page, limit, offset } = getPagination(req);
    const dateFilter = getDateFilter(req.query);

    // const user = await findUser(Number(userId));
    // if (!user) return badRequest(res, "User not found", 404);

    const { rows, count } = await fetchData(
      Attendance,
      { employee_id: Number(userId) },
      limit,
      offset,
      dateFilter
    );

    createSuccess(res, "User attendance fetched successfully", {
      // user,
      attendance: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong"
    );
  }
};

export const userExpense = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return badRequest(res, "UserId is required", 400);

    const { page, limit, offset } = getPagination(req);
    const dateFilter = getDateFilter(req.query);

    // const user = await findUser(Number(userId));
    // if (!user) return badRequest(res, "User not found", 404);
    const { rows, count } = await fetchData(
      Expense,
      { userId: Number(userId) },
      limit,
      offset,
      dateFilter
    );

    createSuccess(res, "User expense fetched successfully", {
      // user,
      leave: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong"
    );
  }
};

export const userLeave = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return badRequest(res, "UserId is required", 400);
    const { page, limit, offset } = getPagination(req);
    // const dateFilter = getDateFilter(req.query);
    // const user = await findUser(Number(userId));
    // if (!user) return badRequest(res, "User not found", 404);
    const { rows, count } = await fetchData(
      Leave,
      { employee_id: Number(userId) },
      limit,
      offset
      // dateFilter
    );
    createSuccess(res, "User leave fetched successfully", {
      // user,
      leave: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong"
    );
  }
};

export const createClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.userData as JwtPayload;
    const { name, email, mobile, } =
      req.body || {};
    // Required fields check
    if (![name, email, mobile,].every(Boolean)) {
      badRequest(res, "All fields are required");
      return;
    }
    // Check if client already exists by email or mobile
    const isExist = await MeetingUser.findOne({
      where: {
        [Op.or]: [{ email }, { mobile }],
      },
    });

    if (isExist) {
      badRequest(res, "Client already exists");
      return;
    }

    // Create new client information (MeetingUser)
    await MeetingUser.create({
      name,
      email,
      mobile,
      userId
    });

    createSuccess(res, "Client created successfully");
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong"
    );
  }
};

const generateDayMap = (totalDays: number) =>
  Object.fromEntries(
    Array.from({ length: totalDays }, (_, i) => [String(i + 1), "-"])
  );

// Build search filter
const buildSearchFilter = (search: string) =>
  search
    ? {
      [Op.or]: [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
      ],
    }
    : {};
// =========================== MAIN FUNCTION ===============================

export const AttendanceBook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.userData as JwtPayload;

    const childIds = await getAllChildUserIds(userId); // assuming this returns array
    if (!childIds.length) badRequest(res, "No child users found");

    // Query Params
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const search = String(req.query.search || "");
    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const totalDays = endDate.getDate();

    // Fetch users + Attendance together (Optimized Query)
    const { rows: users, count: totalCount } = await User.findAndCountAll({
      where: { id: { [Op.in]: childIds }, ...buildSearchFilter(search) },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "role",
        "email",
        "dob",
        "profile",
      ],
      include: [
        {
          model: Attendance,
          as: "Attendances",
          where: { date: { [Op.between]: [startDate, endDate] } },
          required: false,
        },
      ],
      offset,
      limit: limitNum,
      order: [["firstName", "ASC"]],
    });

    // Format response
    const formatted = users.map((u: any) => {
      const days = generateDayMap(totalDays);

      u.Attendances?.forEach((a: any) => {
        const start = new Date(a.date).getDate();
        const end = new Date(a.punch_in).getDate();
        for (let i = start; i <= end; i++) days[String(i)] = a.status ?? "-";
      });

      return {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        dob: u.dob,
        profile: u.profile,
        role: u.role,
        days,
      };
    });
    res.status(200).json({
      success: true,
      message: "Attendance loaded",
      data: { page: pageNum, limit: limitNum, totalCount, users: formatted },
    });
  } catch (error: any) {
    badRequest(res, error.message);
  }
};

export const assignMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, meetingId, scheduledTime } = req.body || {};

    // Validate required fields
    if (!userId || !meetingId || !scheduledTime) {
      badRequest(res, "userId, meetingId and scheduledTime are required");
      return
    }

    // Check meeting exists
    const meeting = await Meeting.findOne({ where: { id: meetingId } });

    if (!meeting) {
      badRequest(res, "Meeting not found");
      return
    }

    // If meeting is already assigned & scheduled time conflicts
    if (meeting.userId) {
      const existingTime = new Date(meeting.scheduledTime);
      const newTime = new Date(scheduledTime);

      if (existingTime.getTime() === newTime.getTime()) {
        badRequest(res, "This meeting is already scheduled at this time");
        return
      }
    }




    // Create new meeting entry (assign to employee)
    await Meeting.create({
      userId,
      meetingUserId: meeting.meetingUserId,
      companyId: meeting.companyId,
      categoryId: meeting.categoryId,
      meetingPurpose: meeting.meetingPurpose,
      scheduledTime,
      status: "scheduled",
    });
    createSuccess(res, "Meeting scheduled successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
    return
  }
};

export const ownLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    const { page, limit, offset } = getPagination(req);

    const { rows, count } = await Leave.findAndCountAll({
      where: { employee_id: Number(userData?.userId) },
      limit,
      offset,
      order: [["id", "DESC"]],
    });

    if (rows.length === 0) {
      badRequest(res, "No leaves found");
    }
    createSuccess(res, "Leave fetched successfully", {
      leave: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


export const addQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      quotationNumber,
      userId,
      clientName,
      clientEmail,
      clientPhone,
      totalAmount,
      validTill,
      notes
    } = req.body;

    // 1️⃣ Basic Validation
    if (!userId) {
      badRequest(res, "UserId is required");
    }

    if (!clientName) {
      badRequest(res, "Client name is required");
    }

    if (!totalAmount) {
      badRequest(res, "Total amount is required");
    }

    // 2️⃣ Duplicate quotation check
    // if (quotationNumber) {
    //   const existingQuotation = await Quotation.findOne({
    //     where: { quotationNumber }
    //   });

    //   if (existingQuotation) {
    //     badRequest(res, "Quotation number already exists");
    //   }
    // }

    // // 3️⃣ Auto Generate Quotation Number (if not provided)
    // let finalQuotationNumber = quotationNumber;

    // if (!finalQuotationNumber) {
    //   const count = await Quotation.count();
    //   finalQuotationNumber = `QT-${Date.now()}-${count + 1}`;
    // }

    // 4️⃣ Create quotation
    // const quotation = await Quotation.create({
    //   quotationNumber: finalQuotationNumber,
    //   userId,
    //   clientName,
    //   clientEmail,
    //   clientPhone,
    //   totalAmount,
    //   validTill,
    //   notes
    // });

    // 5️⃣ Success response
    // createSuccess(res, "Quotation created successfully", quotation);

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


export const addSubCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    if (!loggedInId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { sub_category_name, amount, tax, CategoryId } = req.body;
    if (!sub_category_name?.trim()) {
      badRequest(res, "Sub category name is required");
      return;
    }
    if (!CategoryId) {
      badRequest(res, "CategoryId is required");
      return;
    }
    const cleanName = sub_category_name.trim();
    const existingSubCategory = await SubCategory.findOne({
      where: {
        sub_category_name: cleanName,
        CategoryId: CategoryId,
      },
    });
    if (existingSubCategory) {
      badRequest(res, "Sub category already exists");
      return;
    }
    const subCategory = await SubCategory.create({
      sub_category_name: cleanName,
      CategoryId,
      adminId: loggedInId,
      managerId: loggedInId,
      amount: amount ?? null,
      text: tax ?? null,
    });
    createSuccess(res, "Sub category created successfully", subCategory);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const updateSubCategory = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;

    if (!loggedInId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { id } = req.params;
    if (!id) {
      badRequest(res, "SubCategory id is required");
      return;
    }

    const { sub_category_name, amount, tax, CategoryId } = req.body;

    // Check if subcategory exists
    const existingSubCategory = await SubCategory.findByPk(id);
    if (!existingSubCategory) {
      badRequest(res, "Sub category not found");
      return;
    }

    const object: any = {};

    if (sub_category_name !== undefined) {
      object.sub_category_name = sub_category_name.trim();
    }

    if (amount !== undefined) {
      object.amount = amount;
    }

    if (tax !== undefined) {
      object.text = tax; // or text (based on your schema)
    }

    if (CategoryId !== undefined) {
      object.CategoryId = CategoryId;
    }

    object.managerId = loggedInId;

    // Duplicate check ONLY if name is being updated
    if (sub_category_name !== undefined) {
      const cleanName = sub_category_name.trim();

      const duplicate = await SubCategory.findOne({
        where: {
          sub_category_name: cleanName,
          CategoryId: CategoryId ?? existingSubCategory.CategoryId,
          id: { [Op.ne]: id },
        },
      });

      if (duplicate) {
        badRequest(res, "Sub category already exists");
        return;
      }
    }

    // Update using instance (better approach)
    await existingSubCategory.update(object);

    createSuccess(
      res,
      "Sub category updated successfully",
      existingSubCategory
    );

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};



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


export const getQuotationPdfList = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    console.log("userData", userData);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { count, rows } = await Quotations.findAndCountAll({
      where: {
        // userId: userData.userId
      },
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "firstName"],
          include: [
            {
              model: User,
              as: "creators",
              attributes: ["id", "firstName"],
              required: true, // ✅ IMPORTANT (INNER JOIN)
              where: {
                id: userData.userId, // ✅ MATCH HERE
              },
              through: {
                attributes: [], // optional (hide pivot)
              },
            },
          ],
        },
      ],
      // include: [
      //   {
      //     model: User,
      //     as: "User",
      //     attributes: ["id", "firstName"],
      //     include: [
      //       {
      //         model: User,
      //         as: "creators",
      //         attributes: ["id", "firstName"],
      //         include:[
      //           {
      //             model: User,
      //             as: "creators",
      //             attributes: ["id", "firstName"],
      //           }
      //         ]
      //       },
      //     ],
      //   },
      // ],
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset
    });
    createSuccess(res, "Quotation list fetched successfully", {
      total: count,
      page: page,
      totalPages: Math.ceil(count / limit),
      data: rows
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
}

export const downloadQuotationPdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ─── Fetch quotation record ────────────────────────────────────────────
    const quotation = await Quotations.findByPk(id);
    if (!quotation) {
      badRequest(res, "Quotation not found");
      return;
    }

    const data: any = quotation.quotation;

    // ─── Shared calculations ───────────────────────────────────────────────
    const subtotal = (data.items ?? []).reduce((sum: number, item: any) => {
      return sum + Number(item.amount || 0);
    }, 0);
    const discount = Number(data.discount || 0);
    const taxableAmount = subtotal - discount;
    const gstAmount = (taxableAmount * Number(data.gstRate || 0)) / 100;
    const finalAmount = taxableAmount + gstAmount;

    // ─── ?mode=details → return JSON details ──────────────────────────────
    if (req.query.mode === "details") {
      createSuccess(res, "Quotation details fetched successfully", {
        id: quotation.id,
        userId: quotation.userId,
        companyId: quotation.companyId,
        status: quotation.status,
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
          const ext = filePath.split(".").pop()?.toLowerCase();
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const buf = fs.readFileSync(filePath);
          return `data:${mime};base64,${buf.toString("base64")}`;
        }
      } catch (_) { }
      return "";
    };

    const logo = toBase64(path.join(__dirname, "../../../uploads/images/logo.jpeg"));
    const signature = toBase64(path.join(__dirname, "../../../uploads/signature.png"));
    const stamp = toBase64(path.join(__dirname, "../../../uploads/stamp.png"));

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

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
}

// export const addQuotationPdf = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;

//     if (!userData || !userData.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }

//     const data = req.body;

//     // ✅ Helper: Convert image → base64
//     const toBase64 = (filePath: string): string => {
//       try {
//         if (fs.existsSync(filePath)) {
//           const ext = filePath.split(".").pop()?.toLowerCase();
//           const mime =
//             ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
//           const buf = fs.readFileSync(filePath);
//           return `data:${mime};base64,${buf.toString("base64")}`;
//         }
//       } catch (_) {}
//       return "";
//     };

//     const logo = toBase64(
//       path.join(__dirname, "../../../uploads/images/logo.jpeg")
//     );
//     const signature = toBase64(
//       path.join(__dirname, "../../../uploads/signature.png")
//     );
//     const stamp = toBase64(
//       path.join(__dirname, "../../../uploads/stamp.png")
//     );

//     // ✅ GST State
//     const ownstate = String(data.ownstate || "").toLowerCase();
//     const clientState = String(data.clientState || "").toLowerCase();

//     // ✅ Calculations
//     const subtotal = data.items.reduce((sum: number, item: any) => {
//       return sum + Number(item.amount || 0);
//     }, 0);

//     const discount = Number(data.discount || 0);
//     const taxableAmount = subtotal - discount;

//     const gstRate = Number(data.gstRate || 0);
//     const totalGST = (taxableAmount * gstRate) / 100;

//     let cgst = 0;
//     let sgst = 0;
//     let igst = 0;

//     // ✅ GST Logic (India)
//     if (ownstate && clientState && ownstate === clientState) {
//       cgst = totalGST / 2;
//       sgst = totalGST / 2;
//     } else {
//       igst = totalGST;
//     }

//     const finalAmount = taxableAmount + totalGST;

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
//       gstRate,
//       cgst,
//       sgst,
//       igst,
//       totalGST,
//       finalAmount
//     });

//     // ✅ Save to DB
//     await Quotations.create({
//       userId: Number(userData?.userId),
//       companyId: data.companyId || 0,
//       quotation: data,
//       status: "draft"
//     });

//     // ✅ Puppeteer
//     const browser = await puppeteer.launch({
//       args: ["--no-sandbox", "--disable-setuid-sandbox"]
//     });

//     const page = await browser.newPage();
//     await page.setContent(html as string, { waitUntil: "load" });

//     const pdfBuffer = await page.pdf({
//       format: "a4",
//       printBackground: true,
//       margin: {
//         top: "20mm",
//         bottom: "20mm",
//         left: "15mm",
//         right: "15mm"
//       }
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



const generateQuotationNumber = async (): Promise<string> => {
  const count = await Quotations.count();
  const serial = count + 1;
  return String(serial).padStart(10, '0');
};

export const addQuotationPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

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

    // ✅ Item-level calculations (India GST compliant)
    const isService = String(data.type || '').toLowerCase() === 'service';

    // Step 1: Compute per-item values
    const itemCalcs = data.items.map((item: any) => {
      const qty        = Number(item.quantity || item.qty || 1);
      const rate       = Number(item.rate || 0);
      const discPct    = Number(item.discount || item.discountPercent || 0);
      const gstPct     = Number(item.gst || item.gstPercent || 0);
      // Services → rate is amount for one unit; Items → qty × rate
      const itemTotal  = isService ? rate : qty * rate;
      const discAmt    = (itemTotal * discPct) / 100;
      const taxable    = itemTotal - discAmt;
      const gstAmt     = (taxable * gstPct) / 100;
      return { itemTotal, discAmt, taxable, gstAmt };
    });

    // Step 2: Aggregate summary from item-level values
    const subtotal      = itemCalcs.reduce((s: number, i: any) => s + i.itemTotal, 0);
    const totalDiscount = itemCalcs.reduce((s: number, i: any) => s + i.discAmt, 0);
    const taxableAmount = subtotal - totalDiscount;
    const totalGST      = itemCalcs.reduce((s: number, i: any) => s + i.gstAmt, 0);
    const finalAmount   = taxableAmount + totalGST;

    // Step 3: CGST / SGST / IGST split
    const gstRate  = Number(data.gstRate || 0);
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
    const pdfDir      = path.join(__dirname, "../../../uploads/pdf");
    const pdfFilePath = path.join(pdfDir, pdfFileName);

    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    // ✅ Build public download URL
    const baseUrl   = `${req.protocol}://${req.get("host")}`;
    const pdfUrl    = `/uploads/pdf/${pdfFileName}`;

    // ✅ Return JSON with download link
    res.status(200).json({
      success: true,
      message: "Quotation PDF generated successfully",
      data: {
        quotationNumber,
        pdfUrl,
        summary: {
          subtotal:      +subtotal.toFixed(2),
          discount:      +discount.toFixed(2),
          taxableAmount: +taxableAmount.toFixed(2),
          cgst:          +cgst.toFixed(2),
          sgst:          +sgst.toFixed(2),
          igst:          +igst.toFixed(2),
          totalGST:      +totalGST.toFixed(2),
          finalAmount:   +finalAmount.toFixed(2)
        }
      }
    });

  } catch (error) {
    res.status(400).json({ error: "Something went wrong" });
  }
};


export const getMeetingDistance = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    // Pagination params
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const userId = Number(req.query.userId)
    const offset = (page - 1) * limit;

    // Date filters
    const { startDate, endDate } = req.query;

    const whereCondition: any = {
      userId: userId,
    };

    // Apply date filter if provided
    if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [
          new Date(startDate as string),
          new Date(endDate as string),
        ],
      };
    }

    const { count, rows } = await Meeting.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    createSuccess(res, "Meeting distances fetched successfully", {
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      meetings: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getFuelExpense = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const userId = Number(req.query.userId);
    const { startDate, endDate } = req.query;

    const whereCondition: any = {
      userId: userId,
    };

    if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [
          new Date(startDate as string),
          new Date(endDate as string),
        ],
      };
    }

    const data = await Meeting.findAll({
  where: whereCondition,
  attributes: [
    [fn("DATE", col("createdAt")), "date"],
    [fn("COUNT", col("id")), "totalRecords"],
    [
      fn(
        "COALESCE",
        fn("SUM", cast(col("legDistance"), "DOUBLE PRECISION")),
        0
      ),
      "totalDistance",
    ],
  ],
  group: [fn("DATE", col("createdAt"))],
  order: [[fn("DATE", col("createdAt")), "DESC"]],
});

    createSuccess(res, "Grouped fuel expense by date", data);

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};



export const addCompany = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const {
      companyName,
      legalName,
      registrationNo,
      gst,
      pan,
      industry,
      companySize,
      website,
      companyEmail,
      companyPhone,
      city,
      timezone,
      currency,

      // Bank
      bankAccountHolder,
      bankName,
      bankAccountNumber,
      bankIfsc,
      bankBranchName,
      bankAccountType,
      bankMicr,
      upiId,

      // HR Config
      payrollCycle,
      lateMarkAfter,
      autoHalfDayAfter,
      casualHolidaysTotal,
      casualHolidaysPerMonth,
      casualHolidayNotice,
      compOffMinHours,
      compOffExpiryDays,
      casualCarryForwardLimit,
      casualCarryForwardExpiry,
    } = req.body;

    // ================= VALIDATION =================

    if (!companyName || companyName.trim().length < 2) {
       badRequest(res, "Company name is required (min 2 chars)");
       return
    }

    if (!legalName) {
       badRequest(res, "Legal name is required");
       return
    }

    if (!registrationNo) {
       badRequest(res, "Registration number is required");
       return
    }

    if (!companyEmail || !/^\S+@\S+\.\S+$/.test(companyEmail)) {
       badRequest(res, "Valid company email is required");
       return
    }

    if (!companyPhone || companyPhone.length < 8) {
       badRequest(res, "Valid company phone is required");
       return
    }

    if (gst && gst.length !== 15) {
       badRequest(res, "GST must be 15 characters");
       return
    }

    if (pan && pan.length !== 10) {
       badRequest(res, "PAN must be 10 characters");
       return
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
         badRequest(res, "Website must be a valid URL");
         return
    }

    if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
       badRequest(res, "Invalid IFSC code");
       return
    }

    if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId)) {
       badRequest(res, "Invalid UPI ID");
       return
    }

    // HR numeric validations
    const numericFields = [
      { field: lateMarkAfter, name: "lateMarkAfter" },
      { field: autoHalfDayAfter, name: "autoHalfDayAfter" },
      { field: casualHolidaysTotal, name: "casualHolidaysTotal" },
      { field: casualHolidaysPerMonth, name: "casualHolidaysPerMonth" },
      { field: casualHolidayNotice, name: "casualHolidayNotice" },
      { field: compOffMinHours, name: "compOffMinHours" },
      { field: compOffExpiryDays, name: "compOffExpiryDays" },
      { field: casualCarryForwardLimit, name: "casualCarryForwardLimit" },
      { field: casualCarryForwardExpiry, name: "casualCarryForwardExpiry" },
    ];

    for (const item of numericFields) {
      if (item.field && isNaN(Number(item.field))) {
         badRequest(res, `${item.name} must be a number`);
         return
      }
    }

    // ================= CREATE =================

    const company = await Company.create({
      companyName,
      legalName,
      registrationNo,
      gst,
      pan,
      industry,
      companySize,
      website,
      companyEmail,
      companyPhone,
      city,
      timezone,
      currency,

      bankAccountHolder,
      bankName,
      bankAccountNumber,
      bankIfsc,
      bankBranchName,
      bankAccountType,
      bankMicr,
      upiId,

      payrollCycle,
      lateMarkAfter,
      autoHalfDayAfter,
      casualHolidaysTotal,
      casualHolidaysPerMonth,
      casualHolidayNotice,
      compOffMinHours,
      compOffExpiryDays,
      casualCarryForwardLimit,
      casualCarryForwardExpiry,
      userId: userData.userId,
    });

    createSuccess(res, "Company added successfully", company);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getCompany = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ✅ Search
    const search = (req.query.search as string) || "";

    let whereCondition: any = {
      userId: userData.userId,
    };

    if (search) {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          { companyName: { [Op.like]: `%${search}%` } },
          { legalName: { [Op.like]: `%${search}%` } },
          { companyEmail: { [Op.like]: `%${search}%` } },
          { companyPhone: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // ✅ Query
    const { count, rows } = await Company.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ Response
    createSuccess(res, "Company fetched successfully", {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getCompanyById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if(!req.params.id){
      return badRequest(res, "Company id is required");
    }

    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Company id must be a number");
    }

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const company = await Company.findOne({
      where: { id: req.params.id, userId: userData.userId },
    });

    if (!company) {
      return badRequest(res, "Company not found");
    }

    createSuccess(res, "Company fetched successfully", company);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const addBranch = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const {
      branchName,
      branchCode,
      branchCity,
      branchState,
      branchCountry,
      postalCode,
      addressLine1,
      addressLine2,
      branchEmail,
      branchPhone,
      latitude,
      longitude,
      geoRadius,
      adminId,
      managerId,
    } = req.body;

    // ================= VALIDATIONS =================

    if (!branchName || branchName.trim().length < 2) {
      return badRequest(res, "Branch name is required (min 2 chars)");
    }

    if (!branchCode || branchCode.trim().length < 2) {
      return badRequest(res, "Branch code is required");
    }

    if (!branchCity) {
      return badRequest(res, "Branch city is required");
    }

    if (!branchState) {
      return badRequest(res, "Branch state is required");
    }

    if (!branchCountry) {
      return badRequest(res, "Branch country is required");
    }

    if (!postalCode || postalCode.length < 4) {
      return badRequest(res, "Valid postal code is required");
    }

    if (!addressLine1) {
      return badRequest(res, "Address Line 1 is required");
    }

    if (!branchEmail || !/^\S+@\S+\.\S+$/.test(branchEmail)) {
      return badRequest(res, "Valid branch email is required");
    }

    if (!branchPhone || branchPhone.length < 8) {
      return badRequest(res, "Valid branch phone is required");
    }

    // Latitude: -90 to 90
    if (
      latitude === undefined ||
      isNaN(Number(latitude)) ||
      Number(latitude) < -90 ||
      Number(latitude) > 90
    ) {
      return badRequest(res, "Latitude must be between -90 and 90");
    }

    // Longitude: -180 to 180
    if (
      longitude === undefined ||
      isNaN(Number(longitude)) ||
      Number(longitude) < -180 ||
      Number(longitude) > 180
    ) {
      return badRequest(res, "Longitude must be between -180 and 180");
    }

    if (
      geoRadius === undefined ||
      isNaN(Number(geoRadius)) ||
      Number(geoRadius) <= 0
    ) {
      return badRequest(res, "Geo radius must be a positive number");
    }

    if (adminId && isNaN(Number(adminId))) {
      return badRequest(res, "adminId must be a number");
    }

    if (managerId && isNaN(Number(managerId))) {
      return badRequest(res, "managerId must be a number");
    }

    // ================= DUPLICATE CHECK =================

    const existingBranch = await Branch.findOne({
      where: { branchCode },
    });

    if (existingBranch) {
      return badRequest(res, "Branch already exists with this code");
    }

    // ================= CREATE =================

    const branch = await Branch.create({
      branchName,
      branchCode,
      branchCity,
      branchState,
      branchCountry,
      postalCode,
      addressLine1,
      addressLine2: addressLine2 || null,
      branchEmail,
      branchPhone,
      latitude: Number(latitude),
      longitude: Number(longitude),
      geoRadius: Number(geoRadius),
      adminId: adminId || null,
      managerId: managerId || null,
      userId: userData.userId,
    });

    createSuccess(res, "Branch added successfully", branch);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};



export const getBranch = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ✅ Search
    const search = (req.query.search as string) || "";

    let whereCondition: any = {
      userId: userData.userId,
    };

    if (search) {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          { branchName: { [Op.like]: `%${search}%` } },
          { branchCode: { [Op.like]: `%${search}%` } },
          { branchCity: { [Op.like]: `%${search}%` } },
          { branchState: { [Op.like]: `%${search}%` } },
          { branchCountry: { [Op.like]: `%${search}%` } },
          { postalCode: { [Op.like]: `%${search}%` } },
          { addressLine1: { [Op.like]: `%${search}%` } },
          { addressLine2: { [Op.like]: `%${search}%` } },
          { branchEmail: { [Op.like]: `%${search}%` } },
          { branchPhone: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // ✅ Query
    const { count, rows } = await Branch.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ Response
    createSuccess(res, "Branch fetched successfully", {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getBranchById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if(!req.params.id){
      return badRequest(res, "Branch id is required");
    }

    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Branch id must be a number");
    }

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const branch = await Branch.findOne({
      where: { id: req.params.id, userId: userData.userId },
    });

    if (!branch) {
      return badRequest(res, "Branch not found");
    }

    createSuccess(res, "Branch fetched successfully", branch);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const addShift = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const {
      shiftName,
      shiftCode,
      startTime,
      endTime,
      breakMinutes,
      workingHours,
      lateMarkAfter,
      halfDayAfter,
      branchId,
      companyId,
    } = req.body;

    // ================= VALIDATION =================

    if (!shiftName || shiftName.trim().length < 2) {
      return badRequest(res, "Shift name is required");
    }

    if (!shiftCode || shiftCode.trim().length < 2) {
      return badRequest(res, "Shift code is required");
    }

    if (!startTime || !endTime) {
      return badRequest(res, "Start time and end time are required");
    }

    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return badRequest(res, "Time must be in HH:mm format");
    }

    if (breakMinutes && isNaN(Number(breakMinutes))) {
      return badRequest(res, "Break minutes must be number");
    }

    if (workingHours && isNaN(Number(workingHours))) {
      return badRequest(res, "Working hours must be number");
    }

    if (lateMarkAfter && isNaN(Number(lateMarkAfter))) {
      return badRequest(res, "lateMarkAfter must be number");
    }

    if (halfDayAfter && isNaN(Number(halfDayAfter))) {
      return badRequest(res, "halfDayAfter must be number");
    }

    if (!branchId || isNaN(Number(branchId))) {
      return badRequest(res, "Valid branchId is required");
    }

    if (!companyId || isNaN(Number(companyId))) {
      return badRequest(res, "Valid companyId is required");
    }

    // ================= DUPLICATE =================

    const existing = await Shift.findOne({
      where: { shiftCode },
    });

    if (existing) {
      return badRequest(res, "Shift already exists with this code");
    }

    // ================= CREATE =================

    const shift = await Shift.create({
      shiftName,
      shiftCode,
      startTime,
      endTime,
      // breakMinutes: breakMinutes || 0,
      // workingHours: workingHours || 8,
      // lateMarkAfter: lateMarkAfter || 0,
      // halfDayAfter: halfDayAfter || 0,
      // branchId,
      // companyId,
      userId: userData.userId,
    });

    createSuccess(res, "Shift added successfully", shift);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getShift = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    // ✅ Search
    const search = (req.query.search as string) || "";

    // ✅ Filters (optional but useful)
    const branchId = req.query.branchId;
    const companyId = req.query.companyId;

    let whereCondition: any = {
      userId: userData.userId,
    };

    // 🔍 Search condition
    if (search) {
      whereCondition[Op.or] = [
        { shiftName: { [Op.like]: `%${search}%` } },
        { shiftCode: { [Op.like]: `%${search}%` } },
      ];
    }

    // 🎯 Optional filters
    if (branchId) {
      whereCondition.branchId = branchId;
    }

    if (companyId) {
      whereCondition.companyId = companyId;
    }

    // ✅ Query
    const { count, rows } = await Shift.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ Response
    createSuccess(res, "Shifts fetched successfully", {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getShiftById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    if(!req.params.id){
      return badRequest(res, "Shift id is required");
    }

    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Shift id must be a number");
    }

    const shift = await Shift.findOne({
      where: { id: req.params.id, userId: userData.userId },
    });

    if (!shift) {
      return badRequest(res, "Shift not found");
    }

    createSuccess(res, "Shift fetched successfully", shift);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const addDepartment = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const {
      deptName,
      deptCode,
      deptHead,
      branchId,
      shiftId,
      maxHeadcount,
      halfSaturday,
      adminId,
      managerId,
    } = req.body;

    // ================= VALIDATION =================

    if (!deptName || deptName.trim().length < 2) {
      return badRequest(res, "Department name is required");
    }

    if (!deptCode || deptCode.trim().length < 2) {
      return badRequest(res, "Department code is required");
    }

    if (!deptHead || deptHead.trim().length < 2) {
      return badRequest(res, "Department head is required");
    }

    if (!branchId || isNaN(Number(branchId))) {
      return badRequest(res, "Valid branchId is required");
    }

    if (!shiftId || isNaN(Number(shiftId))) {
      return badRequest(res, "Valid shiftId is required");
    }

    if (!maxHeadcount || isNaN(Number(maxHeadcount))) {
      return badRequest(res, "Valid maxHeadcount is required");
    }

    // if (!adminId || isNaN(Number(adminId))) {
    //   return badRequest(res, "Valid adminId is required");
    // }

    // if (!managerId || isNaN(Number(managerId))) {
    //   return badRequest(res, "Valid managerId is required");
    // }

    // ================= DUPLICATE =================

    const existing = await Department.findOne({
      where: { deptCode },
    });

    if (existing) {
      return badRequest(res, "Department already exists with this code");
    }

    // ================= CREATE =================

    const department = await Department.create({
      deptName,
      deptCode,
      deptHead,
      branchId,
      shiftId,
      maxHeadcount,
      halfSaturday,
      adminId,
      managerId,
      userId: userData.userId,
    });

    createSuccess(res, "Department added successfully", department);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getDepartment = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    // ✅ Search
    const search = (req.query.search as string) || "";

    // ✅ Filters (optional but useful)
    const branchId = req.query.branchId;
    const companyId = req.query.companyId;

    let whereCondition: any = {
      userId: userData.userId,
    };

    // 🔍 Search condition
    if (search) {
      whereCondition[Op.or] = [
        { deptName: { [Op.like]: `%${search}%` } },
        { deptCode: { [Op.like]: `%${search}%` } },
      ];
    }

    // 🎯 Optional filters
    if (branchId) {
      whereCondition.branchId = branchId;
    }

    if (companyId) {
      whereCondition.companyId = companyId;
    }

    // ✅ Query
    const { count, rows } = await Department.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ Response
    createSuccess(res, "Departments fetched successfully", {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getDepartmentById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    if(!req.params.id){
      return badRequest(res, "Department id is required");
    }

    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Department id must be a number");
    }

    const department = await Department.findOne({
      where: { id: req.params.id, userId: userData.userId },
    });

    if (!department) {
      return badRequest(res, "Department not found");
    }

    createSuccess(res, "Department fetched successfully", department);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const addHoliday = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const {
      holidayName,
      holidayDate,
      holidayType,
      branchId,
      description,
      adminId,
      managerId,
    } = req.body;

    // ================= VALIDATION =================

    if (!holidayName || holidayName.trim().length < 2) {
      return badRequest(res, "Holiday name is required");
    }

    if (!holidayDate || holidayDate.trim().length < 2) {
      return badRequest(res, "Holiday date is required");
    }

    if (!holidayType || holidayType.trim().length < 2) {
      return badRequest(res, "Holiday type is required");
    }

    if (!branchId || isNaN(Number(branchId))) {
      return badRequest(res, "Valid branchId is required");
    }

    if (!adminId || isNaN(Number(adminId))) {
      return badRequest(res, "Valid adminId is required");
    }

    if (!managerId || isNaN(Number(managerId))) {
      return badRequest(res, "Valid managerId is required");
    }

    // ================= DUPLICATE =================

    const existing = await Holiday.findOne({
      where: { holidayDate },
    });

    if (existing) {
      return badRequest(res, "Holiday already exists with this date");
    }

    // ================= CREATE =================

    const holiday = await Holiday.create({
      holidayName,
      holidayDate,
      holidayType,
      branchId,
      description,
      adminId,
      managerId,
      userId: userData.userId,
    });

    createSuccess(res, "Holiday added successfully", holiday);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getHoliday = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    // ✅ Search
    const search = (req.query.search as string) || "";

    // ✅ Filters (optional but useful)
    const branchId = req.query.branchId;
    const companyId = req.query.companyId;

    let whereCondition: any = {
      userId: userData.userId,
    };

    // 🔍 Search condition
    if (search) {
      whereCondition[Op.or] = [
        { holidayName: { [Op.like]: `%${search}%` } },
        { holidayType: { [Op.like]: `%${search}%` } },
      ];
    }

    // 🎯 Optional filters
    if (branchId) {
      whereCondition.branchId = branchId;
    }

    if (companyId) {
      whereCondition.companyId = companyId;
    }

    // ✅ Query
    const { count, rows } = await Holiday.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ Response
    createSuccess(res, "Holidays fetched successfully", {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getHolidayById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    if(!req.params.id){
      return badRequest(res, "Holiday id is required");
    }

    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Holiday id must be a number");
    }

    const holiday = await Holiday.findOne({
      where: { id: req.params.id, userId: userData.userId },
    });

    if (!holiday) {
      return badRequest(res, "Holiday not found");
    }

    createSuccess(res, "Holiday fetched successfully", holiday);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};



export const addQuotation2 = async (req: Request, res: Response): Promise<void> => {
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

    if (!data.referenceNumber) {
       badRequest(res, "Reference number is required");
       return
    }

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
    const existing = await Quotations.findOne({
      where: {
        userId: Number(userData.userId),
        referenceNumber: data.referenceNumber
      }
    });

    if (existing) {
       badRequest(res, "Quotation already exists with this reference number");
       return
    }

    const quotationNumber = await generateQuotationNumber();

    // ✅ Create quotation
    const quotation = await Quotations.create({
      userId: Number(userData.userId),
      quotationNumber: quotationNumber,
      companyId: data.companyId || 0,
      customerName: data.customerName,
      referenceNumber: data.referenceNumber,
      quotation: data,
      status: data.status || "draft"
    });

    res.status(201).json({
      success: true,
      message: "Quotation added successfully",
      data: quotation
    });

  } catch (error) {
    console.error("Add Quotation Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



export const getQuotationPdfList2 = async (req: Request, res: Response) => {
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


export const updateQuotation = async(req:Request,res:Response):Promise<void>=>{
  try{
    const {id} = req.params;
    const {status} = req.body||{};

    console.log("id",id,"status",status);
    if(!id){
      badRequest(res, "Quotation id is required");
      return;
    }
    const quotationData = await Quotations.findByPk(id);
    if(!quotationData){
      badRequest(res, "Quotation not found");
      return;
    }
    quotationData.status = status;
    await quotationData.save();
    createSuccess(res, "Quotation updated successfully");
  }catch(error){
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
}