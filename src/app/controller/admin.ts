import {
  Model,
  FindOptions,
  Op,
  WhereOptions,
  Sequelize,
  CreationAttributes,
  Includeable,
  fn,
  col,
  literal,
  NUMBER,
} from "sequelize";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import fs from "fs";
import pdfParse from "pdf-parse";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
// import cron from "node-cron";
// import { S3 } from "aws-sdk";
import { Request, Response } from "express-serve-static-core";
// import csv from "csv-parser";
// import fs from "fs";
import {
  createSuccess,
  getSuccess,
  badRequest,
} from "../middlewear/errorMessage";
import { User, Category, Meeting } from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";
import { S3 } from "@aws-sdk/client-s3";

const UNIQUE_ROLES = ["admin", "super_admin"];

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

    if (role === "sale_person") {
      const ids = Array.isArray(createdBy)
        ? createdBy.map(Number)
        : [Number(createdBy)];

      // ✅ Connect relations
      await (item as any).setCreators(ids);
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

    // ✅ Validate input
    if (!email || !password) {
      badRequest(res, "Email and password are required");
      return;
    }

    // ✅ Check if user exists
    const user = await Middleware.FindByEmail(User, email);
    if (!user) {
      badRequest(res, "Invalid email or password");
    }

    // ✅ Validate password
    const hashedPassword = user.getDataValue("password");
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordValid) {
      badRequest(res, "Invalid email or password");
    }

    // ✅ Create tokens
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(user.getDataValue("id")),
      String(user.getDataValue("role"))
    );

    // ✅ Update refresh token in DB
    await user.update({ refreshToken, user });

    // ✅ Respond
    createSuccess(res, "Login successful", {
      accessToken,
      refreshToken,
      user,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
    return;
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

    /** ✅ Fetch Users */
    const { rows, count } = await User.findAndCountAll({
      attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
      where,
      offset,
      limit: limitNum,
      order: [["createdAt", "DESC"]],
    });

    createSuccess(res, "Users fetched successfully", {
      page: pageNum,
      limit: limitNum,
      total: count,
      rows,
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
    const { category_name } = req.body || {};
    if (!category_name) {
      badRequest(res, "category name is missing");
      return;
    }
    const isCategoryExist = await Middleware.FindByField(
      Category,
      "category_name",
      category_name
    );
    if (isCategoryExist) {
      badRequest(res, "Category already exists");
      return;
    }
    const item = await Category.create({ category_name });
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
    const data = req.query;
    const item = await Middleware.getCategory(Category, data);
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
      category_name
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
    const userData = req.userData as JwtPayload;
    const { page = 1, limit = 10, search = "", userId, date } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const where: any = {};
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
    const { rows, count } = await Meeting.findAndCountAll({
      attributes: [
        "id",
        "companyName",
        "personName",
        "mobileNumber",
        "meetingTimeIn",
        "meetingTimeOut",
        "meetingPurpose",
      ],
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
    // Correct check for multer.array()
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      badRequest(res, "CSV file is required");
      return;
    }

    // Multer.array("csv") → req.files is an array
    // const csvFile = (req.files as Express.Multer.File[])[0];
    // const csvFile = (req.files as { csv: MulterS3File[] }).csv[0];
    const csvFile = (req.files as MulterS3File[])[0];

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
      companyName: row.companyName?.trim() || "",
      personName: row.personName?.trim() || "",
      mobileNumber: row.mobileNumber?.trim() || "",
      companyEmail: row.companyEmail?.trim() || "",
      customerType:"existing"
    });
  })
  .on("end", async () => {
    try {
      const uniqueRows: any[] = [];

      for (const r of results) {
        const exists = await Meeting.findOne({
          where: {
            companyName: r.companyName,
            personName: r.personName,
            mobileNumber: r.mobileNumber,
            companyEmail: r.companyEmail,
          },
        });

        // If NOT found → add to insert list
        if (!exists) {
          uniqueRows.push(r);
        }
      }

      // Insert ONLY new rows
      if (uniqueRows.length > 0) {
        await Meeting.bulkCreate(uniqueRows);
      }

      return createSuccess(res, "Bulk upload successful", {
        totalCSV: results.length,
        inserted: uniqueRows.length,
        duplicatesSkipped: results.length - uniqueRows.length,
      });

    } catch (err) {
       badRequest(res, "DB error: " + err);
       return
    }
  });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};
