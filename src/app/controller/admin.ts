import {Op} from "sequelize";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";
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
  Attendance,
  Leave,
  Expense,
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

    if (role === "sale_person" || role === "manager" || role === "admin") {
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
    const {
      page = 1,
      limit = 10,
      search = "",
      userId,
      date,
      empty,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    // adminId:ll
    const where: any = {};

    if (empty === "true") {
      where.userId = null;
      where.adminId = ll; // <-- correctly added to where clause
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

    const { rows, count } = await Meeting.findAndCountAll({
      attributes: [
        "id",
        "companyName",
        "personName",
        "mobileNumber",
        "companyEmail",
        "meetingTimeIn",
        "meetingTimeOut",
        "meetingPurpose",
        "userId",
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
    const userData = req.userData as JwtPayload;
    let loginUser = userData?.userId;
    // Correct check for multer.array()
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      badRequest(res, "CSV file is required");
      return;
    }
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
          customerType: "existing",
          adminId: loginUser,
          managerId: loginUser,
        });
      })
      .on("end", async () => {
        try {
          const uniqueRows: any[] = [];
          for (const r of results) {
            const exists = await Meeting.findOne({
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
            await Meeting.bulkCreate(uniqueRows);
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
    const { status } = req.query; // <- status comes from query
    const childIds = await getAllChildUserIds(loggedInId);

    const allUserIds = [loggedInId, ...childIds];

    const leaves = await User.findAll({
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
      data: leaves,
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
    const childIds = await getAllChildUserIds(loggedInId);
    const allUserIds = [loggedInId, ...childIds];

    const { approvedByAdmin, approvedBySuperAdmin } = req.query;

    // 🔥 Build dynamic where condition
    const expenseWhere: any = {
      userId: { [Op.in]: allUserIds },
    };

    if (approvedByAdmin !== undefined) {
      expenseWhere.approvedByAdmin = approvedByAdmin;
    }

    if (approvedBySuperAdmin !== undefined) {
      expenseWhere.approvedBySuperAdmin = approvedBySuperAdmin;
    }

    const leaves = await Expense.findAll({
      where: expenseWhere, // 👈 final merged condition
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (leaves.length === 0) {
      badRequest(res, "data not found");
    }

    res.status(200).json({
      success: true,
      message: "Expense fetched successfully",
      data: leaves,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const getAttendance = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;

    const childIds = await getAllChildUserIds(loggedInId);
    const allUserIds = [loggedInId, ...childIds]; // keep full list

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const leaves = await User.findAll({
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
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: leaves,
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
    const { companyName, personName, mobileNumber, companyEmail } =
      req.body || {};
    // Required fields check
    if (![companyName, personName, mobileNumber, companyEmail].every(Boolean)) {
      badRequest(res, "All fields are required");
      return;
    }
    // Check if client already exists
    const isExist = await Meeting.findOne({
      where: {
        [Op.or]: [{ adminId: userId }, { managerId: userId }],
        companyName,
        personName,
        mobileNumber,
        companyEmail,
      },
    });

    if (isExist) {
      badRequest(res, "Client already exists");
      return;
    }

    // Create new client
    await Meeting.create({
      companyName,
      personName,
      mobileNumber,
      companyEmail,
      adminId: userId,
      managerId: userId,
      customerType: "existing",
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
      companyName: meeting.companyName,
      personName: meeting.personName,
      mobileNumber: meeting.mobileNumber,
      companyEmail: meeting.companyEmail,
      userId,
      scheduledTime,
      status: "scheduled",
      customerType:"existing"
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


