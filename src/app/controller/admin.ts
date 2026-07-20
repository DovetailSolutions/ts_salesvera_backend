
import { Op, fn, col, cast,literal, Sequelize } from "sequelize";
import {sequelize} from "../../config/dbConnection";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";
import * as XLSX from "xlsx";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response } from "express-serve-static-core";
import {
  createSuccess,
  getSuccess,
  badRequest,
  forbidden,
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
  ExpenseImage,
  // Quotation,
  SubCategory,
  Quotations,
  Company,
  CompanyManager,
  Branch,Shift,
  Department,
  Holiday,
  CompanyLeave,
  EmployeeLeaveBalance,
  CompanyBank,
  Invoices,
  RecordSales,
  Permission,
  UserPermission,
  Report,
  Task,
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";
import { sendEmail, forgotpassword } from "../../config/email";
import { S3 } from "@aws-sdk/client-s3";
import { invalidatePermissionCache } from "../../config/permissionCache";
import { userHasPermission } from "../../config/checkPermission";
import { getAllChildUserIds } from "../../modules/shared/userHierarchy";

const getPagination = (req: Request) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const generateTempPassword = (): string => {
  return crypto.randomBytes(6).toString("base64").replace(/[+/=]/g, "x");
};

const findUser = async (userId: number) => {
  return User.findOne({
    where: { id: userId },
    attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
  });
};

// Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword have moved
// to src/modules/auth/ — see auth.controller.ts/service.ts/repository.ts.
// Routes are mounted from server.ts, same URL paths as before.

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
          attributes: ["id", "employeeCode", "firstName", "lastName", "email", "phone", "role"],
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

    console.log("userData in GetAllUser:", userData); // Debugging line

    const { page = 1, limit = 10, search = "", role, shiftId, branchId } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const loggedInId = userData?.userId;
    const loggedInRole = userData?.role;

    // super_admin sees all users; everyone else sees only their descendants (children + grandchildren)
    let idFilter: any;
    if (loggedInRole === "super_admin") {
      idFilter = { [Op.ne]: loggedInId };
    } 
    else {
      const childIds = await getAllChildUserIds(loggedInId);
      if (childIds.length === 0) {
        createSuccess(res, "Users fetched successfully", {
          page: pageNum,
          limit: limitNum,
          total: 0,
          finalRows: [],
        });
        return;
      }
      idFilter = { [Op.in]: childIds };
    }

    const where: any = { id: idFilter };

    if (role) where.role = role;
    if (shiftId) where.shiftId = Number(shiftId);
    if (branchId) where.branchId = Number(branchId);

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      attributes: [
        "id",
        "employeeCode",
        "firstName",
        "lastName",
        "email",
        "phone",
        "role",
        "shiftId",
        "branchId",
        "createdAt",
      ],
      where,
      offset,
      limit: limitNum,
      order: [["createdAt", "DESC"]],
      distinct: true,
      include: [
        {
          model: User,
          as: "creators",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "companyName"],
          required: false,
        },
        {
          model: Company,
          as: "managedCompanies",
          attributes: ["id", "companyName"],
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
    const { category_name,status } = req.body || {};
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
      status: status || "draft",
    });
    createSuccess(res, "category create successfully",item);
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

    let ll = loggedInId; // default (admin)

    if (role === "manager" || role === "sale_person") {
      // Walk up the creator chain until we find an admin
      let currentId = Number(loggedInId);
      while (true) {
        const currentUser = await User.findByPk(currentId, {
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
        const plain = currentUser?.get({ plain: true }) as any;
        const creator = plain?.creators?.[0];
        if (!creator) {
          if (plain?.role === "admin" || plain?.role === "super_admin") ll = currentId;
          break;
        }
        if (creator.role === "admin" || creator.role === "super_admin") {
          ll = creator.id;
          break;
        }
        currentId = creator.id;
      }
    }

    const data = req.query;
    const item = await Middleware.getCategory(Category, data, "", ll);

    createSuccess(res, "category list", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getCategoryWithSubCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const role = userData?.role;

    let adminId: any = loggedInId;

    if (role === "manager" || role === "sale_person") {
      let currentId = Number(loggedInId);
      while (true) {
        const currentUser = await User.findByPk(currentId, {
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
        const plain = currentUser?.get({ plain: true }) as any;
        const creator = plain?.creators?.[0];
        if (!creator) {
          if (plain?.role === "admin" || plain?.role === "super_admin") adminId = currentId;
          break;
        }
        if (creator.role === "admin" || creator.role === "super_admin") {
          adminId = creator.id;
          break;
        }
        currentId = creator.id;
      }
    }

    const categories = await Category.findAll({
      where: { adminId },
      include: [
        {
          model: SubCategory,
          as: "subCategories",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = categories.map((cat: any) => {
      const catObj = cat.toJSON();
      const subCategories = (catObj.subCategories || []).map((sub: any) => ({
        ...sub,
        tax: sub.text,
        text: undefined,
      }));
      return { ...catObj, subCategories };
    });

    createSuccess(res, "category with sub categories list", result);
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
    const { category_name, status } = req.body || {};
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;

    if (!id) {
      badRequest(res, "Category ID is missing");
      return;
    }

    if (!category_name && !status) {
      badRequest(res, "Nothing to update");
      return;
    }

    // Only check for duplicate name when category_name is being updated
    if (category_name) {
      const normalizedName = category_name.replace(/\s+/g, "").toLowerCase();
      const isCategoryExist = await Category.findOne({
        where: {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("REPLACE", Sequelize.fn("LOWER", Sequelize.col("category_name")), " ", ""),
              normalizedName
            ),
            { adminId: loggedInId },
            { id: { [Op.ne]: id } },
          ],
        },
      });
      if (isCategoryExist) {
        badRequest(res, "Category already exists");
        return;
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (category_name) updateData.category_name = category_name;
    if (status) updateData.status = status;

    const updatedCategory = await Middleware.UpdateData(
      Category,
      id,
      updateData
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

    // FIX: previously `where` stayed `{}` (no userId filter at all) unless the
    // caller explicitly passed `empty=true` or `userId` — a plain GET with no
    // query params returned every company's meeting records. Always scope to
    // the caller's own team.
    const childIds = await getAllChildUserIds(ll);
    const allowedIds = [ll, ...childIds];

    const where: any = {};

    if (empty === "true") {
      where.userId = ll;
    } else if (userId) {
      const requestedId = Number(userId);
      if (!allowedIds.includes(requestedId)) {
        forbidden(res, "You can only view meetings of your own team members");
        return;
      }
      where.userId = requestedId;
    } else {
      where.userId = { [Op.in]: allowedIds };
    }

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
      include: [
        {
          model: Meeting, // joined via Meeting.meetingUserId -> MeetingUser.id
        },
      ],
      distinct: true, // avoid inflated count from the hasMany join
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

export const BulkAddSalePerson = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    const loginUser = userData?.userId;
    const loginRole = userData?.role;
   console.log(">>>>>>>>>>>>>>",userData)
    if (!loginUser) {
      badRequest(res, "Unauthorized");
      return;
    }

    const { createdBy, branchId, shiftId } = req.body;

    // Validate branchId/shiftId (optional — applied to every row in the
    // batch) belong to the caller's own company, same as assignEmployeeShift
    // — an unvalidated cross-company id here would silently apply another
    // company's geofence/shift config to every bulk-created sale person.
    const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;
    let resolvedBranchId: number | null = null;
    let resolvedShiftId: number | null = null;

    if (branchId !== undefined && branchId !== null && branchId !== "") {
      const branch = await Branch.findByPk(Number(branchId));
      if (!branch || (callerCompanyId && Number((branch as any).companyId) !== callerCompanyId)) {
        badRequest(res, "Branch not found");
        return;
      }
      resolvedBranchId = Number(branchId);
    }

    if (shiftId !== undefined && shiftId !== null && shiftId !== "") {
      const shift = await Shift.findByPk(Number(shiftId));
      if (!shift || (callerCompanyId && Number((shift as any).companyId) !== callerCompanyId)) {
        badRequest(res, "Shift not found");
        return;
      }
      resolvedShiftId = Number(shiftId);
    }

    let creatorId: number;

    if (loginRole === "manager") {
      creatorId = Number(loginUser);
    } else {
      if (!createdBy) {
        badRequest(res, "createdBy is required");
        return;
      }

      creatorId = Number(createdBy);

      if (isNaN(creatorId)) {
        badRequest(res, "Invalid createdBy");
        return;
      }

      // FIX: previously createdBy was trusted straight from the request body
      // with no check that it's the caller themself or one of the caller's
      // own subordinates — an admin could attribute the bulk-created
      // sale-persons to a user in a completely different tenant, linking new
      // accounts into that other tenant's hierarchy.
      if (creatorId !== Number(loginUser)) {
        const callerChildIds = await getAllChildUserIds(Number(loginUser));
        if (!callerChildIds.includes(creatorId)) {
          forbidden(res, "createdBy must be yourself or one of your own team members");
          return;
        }
      }
    }

    // Resolve tenantId from the creator so bulk-created users are scoped correctly
    const creatorRecord = await User.findByPk(creatorId, {
      attributes: ["id", "role", "tenantId"],
    }) as any;

    let resolvedTenantId: number | null = null;
    if (creatorRecord) {
      if (creatorRecord.role === "user") {
        resolvedTenantId = creatorRecord.id;
      } else if (creatorRecord.tenantId) {
        resolvedTenantId = creatorRecord.tenantId;
      }
    }

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

    const data = await s3.send(
      new GetObjectCommand({
        Bucket: csvFile.bucket,
        Key: csvFile.key,
      })
    );

    if (!data.Body) {
      badRequest(res, "Unable to read CSV from S3");
      return;
    }

    const stream = data.Body as Readable;
    const rows: any[] = [];

    stream
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
        })
      )
      .on("data", (row) => {
        rows.push({
          firstName: row.firstname?.trim() || "",
          lastName: row.lastname?.trim() || "",
          email: row.email?.trim().toLowerCase() || "",
          phone: row.phone?.trim() || "",
          dob: row.dob?.trim() || "",
        });
      })
      .on("end", async () => {
        try {
          const invalidRows: any[] = [];
          const duplicateInCsv: any[] = [];
          const validRows: any[] = [];
          const seenEmails = new Set<string>();

          for (const r of rows) {
            if (
              !r.firstName ||
              !r.lastName ||
              !r.email ||
              !r.phone ||
              !r.dob
            ) {
              invalidRows.push(r);
              continue;
            }

            if (seenEmails.has(r.email)) {
              duplicateInCsv.push(r);
              continue;
            }

            seenEmails.add(r.email);
            validRows.push(r);
          }

          const existingByEmail = new Map<string, any>();

          if (validRows.length > 0) {
            const existingUsers = await User.findAll({
              where: {
                email: { [Op.in]: validRows.map((r) => r.email) },
                // scope to this tenant so the same email in another tenant is not treated as a duplicate
                ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
              },
              attributes: ["id", "email", "role"],
              include: [
                {
                  model: User,
                  as: "creators",
                  attributes: ["id"],
                  where: { id: creatorId },
                  required: false,
                  through: { attributes: [] },
                },
              ],
            });

            for (const user of existingUsers as any[]) {
              existingByEmail.set(
                user.getDataValue("email"),
                user
              );
            }
          }

          const created: any[] = [];
          const linkedExisting: any[] = [];
          const skippedDuplicate: any[] = [];
          const skippedRoleMismatch: any[] = [];

          for (const r of validRows) {
            const existing = existingByEmail.get(r.email);

            if (existing) {
              if (existing.getDataValue("role") !== "sale_person") {
                skippedRoleMismatch.push(r);
                continue;
              }

              const alreadyLinked =
                ((existing as any).creators || []).length > 0;

              if (alreadyLinked) {
                skippedDuplicate.push(r);
                continue;
              }

              await (existing as any).addCreators([creatorId]);

              linkedExisting.push({
                id: existing.getDataValue("id"),
                firstName: r.firstName,
                lastName: r.lastName,
                email: r.email,
                phone: r.phone,
              });

              continue;
            }

            const tempPassword = generateTempPassword();

            const item = await User.create({
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              phone: r.phone,
              dob: r.dob,
              password: tempPassword,
              role: req.body.role,
              createdBy: creatorId,
              tenantId: resolvedTenantId,
              branchId: resolvedBranchId,
              shiftId: resolvedShiftId,
            } as any);

            await (item as any).setCreators([creatorId]);

            sendEmail(
              "Welcome to SalesVera - Your Login Credentials",
              tempPassword,
              r.email,
              r.firstName,
              r.lastName
            ).catch((err) =>
              console.error(
                `Failed to send credentials email to ${r.email}:`,
                err
              )
            );

            created.push({
              id: item.getDataValue("id"),
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              phone: r.phone,
              tempPassword,
            });
          }

          createSuccess(res, "Bulk sale person upload completed", {
            totalCSV: rows.length,
            created: created.length,
            linkedExisting: linkedExisting.length,
            skippedInvalid: invalidRows.length,
            skippedDuplicateInCsv: duplicateInCsv.length,
            skippedDuplicate: skippedDuplicate.length,
            skippedRoleMismatch: skippedRoleMismatch.length,
            createdSalePersons: created,
            linkedSalePersons: linkedExisting,
          });
        } catch (err) {
          badRequest(
            res,
            err instanceof Error
              ? err.message
              : "Bulk sale person upload failed",
            err
          );
        }
      });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

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

// Maps a leave_type to the EmployeeLeaveBalance columns it draws from.
// unpaid/short_leave/half_day are not balance-tracked — always approvable.
// Exported so user.ts can run the same balance check at request time (not just on approval).
// LEAVE_BALANCE_FIELDS/countLeaveDays/rejectLeaveAndRestoreBalance/
// approveLeave/assignLeaveBalance/formatLeaveBalance/getEmployeeLeaveBalance/
// getTeamLeaveBalances have moved to src/modules/leave/ — see
// leave.controller.ts/service.ts/repository.ts. Routes are mounted from
// server.ts, same URL paths as before. (user.ts imports
// LEAVE_BALANCE_FIELDS/countLeaveDays from leave.service now.)

export const test = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { page = 1, limit = 10, search = "", role } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const loggedInId = userData?.userId;
    const createdWhere: any = {};

    if (search) {
      createdWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      createdWhere.role = role;
    }

    const result = await User.findByPk(loggedInId, {
      attributes: [
        "id",
        "employeeCode",
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
            "employeeCode",
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
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "createdUsers",
              attributes: [
                "id",
                "employeeCode",
                "firstName",
                "lastName",
                "email",
                "phone",
                "role",
                "createdAt",
              ],
              through: { attributes: [] },
              required: false,
            },
          ],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "companyName"],
        },
      ],
    });

    if (!result) {
      badRequest(res, "User not found");
      return;
    }

    let createdUsers = (result as any).createdUsers || [];
    const total = createdUsers.length;
    createdUsers = createdUsers.slice(offset, offset + limitNum);

    const userJson = (result as any).toJSON();
    userJson.createdUsers = createdUsers;

    createSuccess(res, "Users fetched successfully", {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      user: userJson,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const UpdateExpense = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { approvedByAdmin, approvedBySuperAdmin, userId, expenseId } =
      req.body || {};
    // FIX: `role` previously came from req.body — any caller could claim
    // role:"admin" to skip the manager-approval-first gate below. It must
    // come from the server-verified token instead.
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const role = userData?.role;

    // Validate userId
    if (!userId) {
      badRequest(res, "userId is missing");
      return;
    }
    if (!expenseId) {
      badRequest(res, "expenseId is missing");
      return;
    }

    // FIX: previously trusted userId straight from the request body with no
    // check that the employee is on the caller's own team, letting any
    // admin/manager approve another company's expense by ID.
    const childIds = await getAllChildUserIds(loggedInId);
    if (Number(userId) !== loggedInId && !childIds.includes(Number(userId))) {
      forbidden(res, "You can only manage expenses of your own team members");
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

    // ---------- Admin / Super Admin Approval ----------
    // FIX: role now comes from the verified token (see above), so super_admin
    // reaches this branch as itself instead of needing to misreport its role
    // as "admin" in the request body to pass the old body-trusted check.
    if (role === "admin" || role === "super_admin") {
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
    return;


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
// getAllChildUserIds has moved to src/modules/shared/userHierarchy.ts
// (imported below) so the leave/attendance/etc. modules can share it
// instead of duplicating the recursive team-hierarchy walk.

// leaveList/getTodayLeaveRequests have moved to src/modules/leave/ — see
// leave.controller.ts/service.ts/repository.ts.

export const  GetExpense = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;
    const search = req.query.search
    const { page, limit, offset } = getPagination(req);
    const childIds = await getAllChildUserIds(loggedInId);

    const allUserIds = [ ...childIds];
    console.log("userData",userData)
    console.log("<<>>>>>>>>>>>>>",allUserIds)

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
                  model: ExpenseImage,
                  as: "images",
                },
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

    // FIX: previously called badRequest() here without returning, then fell
    // through to the 200 response below anyway — an empty list was never
    // actually an error case, it just tried to send two responses on the
    // same request (crashing with "headers already sent" server-side),
    // which is why this page failed for any company/user with zero expense
    // records instead of just showing an empty list.
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


// getAttendance/markAttendancePresent have moved to src/modules/attendance/
// — see attendance.controller.ts/service.ts/repository.ts.

// cancelLeaveAndMarkPresent has moved to src/modules/leave/ — see
// leave.controller.ts/service.ts/repository.ts.

// bulkMarkAttendance has moved to src/modules/attendance/ — see
// attendance.controller.ts/service.ts/repository.ts.

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

export const getDashboardSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;

    const childIds = await getAllChildUserIds(loggedInId);

    const todayDateOnly = new Date().toISOString().slice(0, 10);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // ── KPI windows ──────────────────────────────────────────────────────
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const sevenDaysAgoDateOnly = sevenDaysAgo.toISOString().slice(0, 10);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const thirtyDaysAgoDateOnly = thirtyDaysAgo.toISOString().slice(0, 10);

    const currentYear = now.getFullYear();
    // Valid Attendance.status enum values that count as "marked" (present in
    // some form) for rate calculations — "late" is a separate boolean
    // column, not a status value, and isn't included here.
    const MARKED_STATUSES = ["in", "present", "out", "leaveApproved"];

    const [
      presentCount,
      pendingLeaveApprovalCount,
      pendingExpenseCount,
      meetingsThisWeekCount,
      completedQuotationCount,
      completedInvoiceCount,
      attendanceMarkedLast7DaysCount,
      attendanceMarkedLast30DaysCount,
      lateMarkedLast30DaysCount,
      taskTotalCount,
      taskCompletedCount,
      taskOverdueCount,
      leaveBalances,
      headcountByBranchRaw,
    ] = await Promise.all([
      Attendance.count({
        where: {
          employee_id: { [Op.in]: childIds },
          status: "present",
          date: todayDateOnly,
        },
      }),
      Leave.count({
        where: {
          employee_id: { [Op.in]: childIds },
          status: "pending",
        },
      }),
      Expense.count({
        where: {
          userId: { [Op.in]: childIds },
          approvedByAdmin: "pending",
        },
      }),
      Meeting.count({
        where: {
          userId: { [Op.in]: childIds },
          scheduledTime: { [Op.between]: [weekStart, weekEnd] },
        },
      }),
      Quotations.count({
        where: {
          userId: { [Op.in]: childIds },
          status: "accepted",
        },
      }),
      Invoices.count({
        where: {
          userId: { [Op.in]: childIds },
          status: "accepted",
        },
      }),
      // Attendance rate (last 7 days): marked days / (team size * 7) — a
      // simple proxy, not adjusted for holidays/weekends off, matching the
      // "cheap to compute from data already modeled" brief.
      Attendance.count({
        where: {
          employee_id: { [Op.in]: childIds },
          status: { [Op.in]: MARKED_STATUSES },
          date: { [Op.gte]: sevenDaysAgoDateOnly },
        },
      }),
      // Punctuality rate (last 30 days): marked days vs. how many were late.
      Attendance.count({
        where: {
          employee_id: { [Op.in]: childIds },
          status: { [Op.in]: MARKED_STATUSES },
          date: { [Op.gte]: thirtyDaysAgoDateOnly },
        },
      }),
      Attendance.count({
        where: {
          employee_id: { [Op.in]: childIds },
          late: true,
          date: { [Op.gte]: thirtyDaysAgoDateOnly },
        },
      }),
      // Task velocity
      Task.count({ where: { assignedTo: { [Op.in]: childIds } } }),
      Task.count({ where: { assignedTo: { [Op.in]: childIds }, status: { [Op.in]: ["completed", "done"] } } }),
      Task.count({
        where: {
          assignedTo: { [Op.in]: childIds },
          status: { [Op.notIn]: ["completed", "done", "cancelled"] },
          dueDate: { [Op.lt]: now },
        },
      }),
      // Leave utilization (current year)
      EmployeeLeaveBalance.findAll({
        where: { employeeId: { [Op.in]: childIds }, year: currentYear },
        raw: true,
      }),
      // Headcount by branch
      User.findAll({
        where: { id: { [Op.in]: childIds } },
        attributes: ["branchId", [fn("COUNT", col("id")), "count"]],
        group: ["branchId"],
        raw: true,
      }) as unknown as Promise<{ branchId: number | null; count: string }[]>,
    ]);

    const teamSize = childIds.length || 1;
    const attendanceRateLast7Days = Math.round((attendanceMarkedLast7DaysCount / (teamSize * 7)) * 1000) / 10;
    const punctualityRateLast30Days =
      attendanceMarkedLast30DaysCount > 0
        ? Math.round(((attendanceMarkedLast30DaysCount - lateMarkedLast30DaysCount) / attendanceMarkedLast30DaysCount) * 1000) / 10
        : null;

    const leaveAllocated = (leaveBalances as any[]).reduce(
      (sum, b) => sum + (b.casualLeaveAllocated || 0) + (b.sickLeaveAllocated || 0) + (b.paidLeaveAllocated || 0),
      0
    );
    const leaveUsed = (leaveBalances as any[]).reduce(
      (sum, b) => sum + (b.casualLeaveUsed || 0) + (b.sickLeaveUsed || 0) + (b.paidLeaveUsed || 0),
      0
    );
    const leaveUtilizationRate = leaveAllocated > 0 ? Math.round((leaveUsed / leaveAllocated) * 1000) / 10 : null;

    const headcountByBranch = (headcountByBranchRaw as any[]).map((r) => ({
      branchId: r.branchId,
      count: Number(r.count),
    }));

    res.status(200).json({
      success: true,
      message: "Dashboard summary fetched successfully",
      data: {
        teamMemberCount: childIds.length,
        presentCount,
        pendingLeaveApprovalCount,
        pendingExpenseCount,
        meetingsThisWeekCount,
        completedQuotationCount,
        completedInvoiceCount,
        kpis: {
          attendanceRateLast7Days,
          punctualityRateLast30Days,
          taskStats: {
            total: taskTotalCount,
            completed: taskCompletedCount,
            overdue: taskOverdueCount,
            completionRate: taskTotalCount > 0 ? Math.round((taskCompletedCount / taskTotalCount) * 1000) / 10 : null,
          },
          leaveUtilizationRate,
          headcountByBranch,
        },
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const getTopPerformers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData.userId;
    const limit = Number(req.query.limit) || 5;

    const childIds = await getAllChildUserIds(loggedInId);

    if (childIds.length === 0) {
      res.status(200).json({
        success: true,
        message: "Top performers fetched successfully",
        data: [],
      });
      return;
    }

    const [users, taskRows, meetingRows] = await Promise.all([
      User.findAll({
        where: { id: { [Op.in]: childIds } },
        attributes: ["id", "firstName", "lastName", "email", "phone", "role"],
      }),
      // Tasks completed on/before their dueDate
      Task.findAll({
        where: {
          [Op.and]: [
            { assignedTo: { [Op.in]: childIds } },
            { status: { [Op.in]: ["completed", "done"] } },
            { dueDate: { [Op.ne]: null } },
            // Compare calendar dates only — dueDate is stored at midnight, so a
            // same-day completion later in the day must still count as on time.
            Sequelize.where(fn("DATE", col("updatedAt")), Op.lte, fn("DATE", col("dueDate"))),
          ],
        } as any,
        attributes: ["assignedTo", [fn("COUNT", col("id")), "count"]],
        group: ["assignedTo"],
        raw: true,
      }) as unknown as { assignedTo: number; count: string }[],
      // Meetings that were completed/closed out
      Meeting.findAll({
        where: {
          userId: { [Op.in]: childIds },
          status: { [Op.in]: ["completed", "out"] },
        },
        attributes: ["userId", [fn("COUNT", col("id")), "count"]],
        group: ["userId"],
        raw: true,
      }) as unknown as { userId: number; count: string }[],
    ]);

    const taskCountMap = new Map<number, number>();
    taskRows.forEach((r) => taskCountMap.set(Number(r.assignedTo), Number(r.count)));

    const meetingCountMap = new Map<number, number>();
    meetingRows.forEach((r) => meetingCountMap.set(Number(r.userId), Number(r.count)));

    const performers = users.map((u: any) => {
      const tasksCompletedOnTime = taskCountMap.get(u.id) || 0;
      const meetingsDone = meetingCountMap.get(u.id) || 0;
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        tasksCompletedOnTime,
        meetingsDone,
        score: tasksCompletedOnTime + meetingsDone,
      };
    });

    performers.sort((a, b) => b.score - a.score);

    res.status(200).json({
      success: true,
      message: "Top performers fetched successfully",
      data: performers.slice(0, limit),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

const fetchData = async (
  model: any,
  where: any,
  limit: number,
  offset: number,
  dateFilter?: any,
  dateField: string = "date"
) => {
  return await model.findAndCountAll({
    // FIX: dateFilter was accepted as a param but never applied to the query —
    // startDate/endDate/lastDays/today filters were silently ignored.
    where: dateFilter && Object.keys(dateFilter).length > 0
      ? { ...where, [dateField]: dateFilter }
      : where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });
};

// Attendance history for one employee, by id — paginated, optionally filtered
// by startDate/endDate, lastDays, or today (see getDateFilter).
// userAttendance has moved to src/modules/attendance/ — see
// attendance.controller.ts/service.ts/repository.ts.

export const userExpense = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return badRequest(res, "UserId is required", 400);

    // FIX: previously trusted userId straight from the query string with no
    // ownership check — any caller with expense:view could pass any userId
    // and read another team's/company's expense history.
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const childIds = await getAllChildUserIds(loggedInId);
    const requestedUserId = Number(userId);
    if (requestedUserId !== loggedInId && !childIds.includes(requestedUserId)) {
      return forbidden(res, "You can only view expenses of your own team members");
    }

    const { page, limit, offset } = getPagination(req);
    const dateFilter = getDateFilter(req.query);

    // const user = await findUser(Number(userId));
    // if (!user) return badRequest(res, "User not found", 404);
    const { rows, count } = await fetchData(
      Expense,
      { userId: requestedUserId },
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

// userLeave has moved to src/modules/leave/ — see leave.controller.ts/
// service.ts/repository.ts.

export const createClient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.userData as JwtPayload;
    const { 
      name, email, mobile, companyName, panNumber, status, 
      state, customerType, city, pincode, country, address, gstNumber 
    } = req.body || {};

    // Only name, state, country, companyName are mandatory
    if (!name || !state || !country || !companyName) {
      badRequest(res, "name, state, country, and companyName are required");
      return;
    }

    // Duplicate check: only if email or mobile is provided
    const duplicateChecks: any[] = [];
    if (email) duplicateChecks.push({ email });
    if (mobile) duplicateChecks.push({ mobile });

    if (duplicateChecks.length > 0) {
      const isExist = await MeetingUser.findOne({
        where: {
          [Op.or]: duplicateChecks,
        },
      });

      if (isExist) {
        badRequest(res, "Client already exists with this email or mobile");
        return;
      }
    }

    // Create new client information (MeetingUser)
    await MeetingUser.create({
      name,
      email,
      mobile,
      userId,
      companyName,
      customerType: customerType || "new",
      state,
      city,
      pincode,
      country,
      address,
      gstNumber,
      panNumber,
      status: status || "draft"
    });

    createSuccess(res, "Client created successfully");
  } catch (error) {
    badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong"
    );
  }
};

// AttendanceBook has moved to src/modules/attendance/ — see
// attendance.controller.ts/service.ts/repository.ts. (Fixed a pre-existing
// double-response bug while moving: the empty-childIds case called
// badRequest() and then fell through to the full query/response anyway —
// same pattern already applied to ownLeave/GetExpense.)

export const assignMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, meetingId, scheduledTime } = req.body || {};
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;
    const role = userData?.role;

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

    // FIX: previously neither the meeting's company nor the assignee's team
    // membership were checked — a caller could supply a meetingId belonging
    // to another company and/or an arbitrary userId, cross-linking data
    // across tenants.
    if (role !== "super_admin" && meeting.companyId !== userData?.companyId) {
      forbidden(res, "You can only assign meetings within your own company");
      return;
    }
    const childIds = await getAllChildUserIds(loggedInId);
    if (Number(userId) !== loggedInId && !childIds.includes(Number(userId))) {
      forbidden(res, "You can only assign meetings to your own team members");
      return;
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

// ownLeave has moved to src/modules/leave/ — see leave.controller.ts/
// service.ts/repository.ts. (Fixed a pre-existing double-response bug while
// moving: the empty-list case called badRequest() and then fell through to
// createSuccess() anyway — now it returns after badRequest, same pattern
// already applied to GetExpense.)


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
    const { sub_category_name, amount, tax,status,gstedit,totaledit, CategoryId,gst,unit,hsnCode,baseUnit,secondaryUnit } = req.body;
    if (!sub_category_name?.trim()) {
      badRequest(res, "Sub category name is required");
      return;
    }
    if (!CategoryId) {
      badRequest(res, "CategoryId is required");
      return;
    }
    const cleanName = sub_category_name.trim();
    const normalizedName = cleanName.replace(/\s+/g, "").toLowerCase();
    const existingSubCategory = await SubCategory.findOne({
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("REPLACE", Sequelize.fn("LOWER", Sequelize.col("sub_category_name")), " ", ""),
            normalizedName
          ),
          { CategoryId: CategoryId },
          { adminId: loggedInId },
        ],
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
      status: status || "draft",
      gst:gst ?? null,
      unit:unit ?? null,
      hsnCode:hsnCode ?? null,
      baseUnit:baseUnit ?? null,
      secondaryUnit:secondaryUnit ?? null,
      gstedit:gstedit ?? null,
      totaledit:totaledit ?? null
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

    const { sub_category_name, amount, tax, CategoryId,status,baseUnit,secondaryUnit,discountedit,gstedit,totaledit,hsnCode} = req.body;

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
    if (status !== undefined) {
      object.status = status;
    }

    if (baseUnit !== undefined) {
      object.baseUnit = baseUnit;
    }

    if (secondaryUnit !== undefined) {
      object.secondaryUnit = secondaryUnit;
    }

    if( discountedit !== undefined){
      object.discountedit = discountedit;
    }
    if( gstedit !== undefined){
      object.gstedit = gstedit;
    }
    if( totaledit !== undefined){
      object.totaledit = totaledit;
    }
     
    if( hsnCode !== undefined){
      object.hsnCode = hsnCode;
    }

    object.managerId = loggedInId;

    // Duplicate check ONLY if name is being updated
    if (sub_category_name !== undefined) {
      const cleanName = sub_category_name.trim();
      const normalizedName = cleanName.replace(/\s+/g, "").toLowerCase();

      const duplicate = await SubCategory.findOne({
        where: {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("REPLACE", Sequelize.fn("LOWER", Sequelize.col("sub_category_name")), " ", ""),
              normalizedName
            ),
            { CategoryId: CategoryId ?? existingSubCategory.CategoryId },
            { adminId: loggedInId },
            { id: { [Op.ne]: id } },
          ],
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
    const { id } = req.params || {};

    if (!id) {
      badRequest(res, "Category id is required");
      return;
    }

    const where:any = {
      CategoryId: id,
    }

    if(req.query.status){
      where.status = req.query.status;
    }

    const subCategory = await SubCategory.findAll({
      where,
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


    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { count, rows } = await Quotations.findAndCountAll({
      where: {
        // userId: userData.userId
        status: {
          [Op.notIn]: ["cancelled", "deleted"]
        }
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

    // FIX: previously trusted userId straight from the query string with no
    // ownership check — any caller could pass any userId and read another
    // team's/company's meeting-distance data.
    const loggedInId = Number(userData.userId);
    const childIds = await getAllChildUserIds(loggedInId);
    if (userId !== loggedInId && !childIds.includes(userId)) {
      forbidden(res, "You can only view meeting distances of your own team members");
      return;
    }

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

    // FIX: previously trusted userId straight from the query string with no
    // ownership check — any caller could pass any userId and read another
    // team's/company's fuel-expense data.
    const loggedInId = Number(userData.userId);
    const childIds = await getAllChildUserIds(loggedInId);
    if (userId !== loggedInId && !childIds.includes(userId)) {
      forbidden(res, "You can only view fuel expenses of your own team members");
      return;
    }

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



// addCompany/getCompany/getCompanyById/updateCompany/assignCompanyManager/
// removeCompanyManager/getCompanyManagers/getMyCompanies/switchCompany/
// deleteCompany/getOwnCompany have moved to src/modules/company/ — see
// company.controller.ts/service.ts/repository.ts. Routes are mounted from
// server.ts, same URL paths as before. (Dropped a leftover debug console.log
// of the full userData object in addCompany while moving.)

// Branch CRUD (addBranch/updateBranch/getBranch/getBranchById) has moved to
// src/modules/branch/ — see branch.controller.ts/service.ts/repository.ts.
// Routes are mounted from server.ts, same URL paths as before.














// validateShiftItem/buildShiftCreateAttrs/addShift have moved to
// src/modules/shift/ — see shift.controller.ts/service.ts/repository.ts.
// Routes are mounted from server.ts, same URL paths as before.
// (assignEmployeeShift below stays here — cross-domain concern, not shift-only.)

// ============================================================
// PATCH /admin/assign-employee-shift
// Assign (or clear) an employee's shift/department/branch — there was
// previously no way to do this at all; the attendance engine needs it to
// resolve "this employee's assigned shift" instead of a hardcoded default.
// Body: { employeeId, shiftId?, departmentId?, branchId? } (null clears)
// ============================================================
export const assignEmployeeShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const loggedInId = userData?.userId;

    if (!userData || !loggedInId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { employeeId, shiftId, departmentId, branchId } = req.body || {};
    if (!employeeId || isNaN(Number(employeeId))) {
      badRequest(res, "Valid employeeId is required");
      return;
    }

    const childIds = await getAllChildUserIds(Number(loggedInId));
    if (Number(employeeId) !== Number(loggedInId) && !childIds.includes(Number(employeeId))) {
      forbidden(res, "You can only assign shifts to your own team members");
      return;
    }

    const employee = await User.findByPk(Number(employeeId));
    if (!employee) {
      badRequest(res, "Employee not found");
      return;
    }

    // FIX: previously only checked that the shift/department *existed*
    // anywhere in the system, and branchId wasn't validated at all — a
    // caller could assign an employee a shift/branch/department belonging
    // to a completely different company, silently applying that other
    // company's geofence/working-hours config to this employee's attendance.
    // Every reference must belong to the caller's own resolved company.
    const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;

    if (shiftId !== undefined && shiftId !== null) {
      const shift = await Shift.findByPk(Number(shiftId));
      if (!shift || (callerCompanyId && Number((shift as any).companyId) !== callerCompanyId)) {
        badRequest(res, "Shift not found");
        return;
      }
    }
    if (departmentId !== undefined && departmentId !== null) {
      const department = await Department.findByPk(Number(departmentId));
      if (!department || (callerCompanyId && Number((department as any).companyId) !== callerCompanyId)) {
        badRequest(res, "Department not found");
        return;
      }
    }
    if (branchId !== undefined && branchId !== null) {
      const branch = await Branch.findByPk(Number(branchId));
      if (!branch || (callerCompanyId && Number((branch as any).companyId) !== callerCompanyId)) {
        badRequest(res, "Branch not found");
        return;
      }
    }

    const updates: any = {};
    if (shiftId !== undefined) updates.shiftId = shiftId === null ? null : Number(shiftId);
    if (departmentId !== undefined) updates.departmentId = departmentId === null ? null : Number(departmentId);
    if (branchId !== undefined) updates.branchId = branchId === null ? null : Number(branchId);

    await employee.update(updates);

    createSuccess(res, "Employee shift assignment updated", {
      id: employee.getDataValue("id"),
      shiftId: employee.getDataValue("shiftId" as any),
      departmentId: employee.getDataValue("departmentId" as any),
      branchId: employee.getDataValue("branchId" as any),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

// updateShift/getShift/getShiftById have moved to src/modules/shift/ — see
// shift.controller.ts/service.ts/repository.ts. Routes are mounted from
// server.ts, same URL paths as before.


// Department CRUD (addDepartment/updateDepartment/getDepartment/
// getDepartmentById) has moved to src/modules/department/ — see
// department.controller.ts/service.ts/repository.ts. Routes are mounted
// from server.ts, same URL paths as before.


// Holiday CRUD (addHoliday/updateHoliday/getHoliday/getHolidayById) has
// moved to src/modules/holiday/ — see holiday.controller.ts/service.ts/
// repository.ts. Routes are mounted from server.ts, same URL paths as
// before, so nothing outside this file changed.



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

    // if (!data.referenceNumber) {
    //    badRequest(res, "Reference number is required");
    //    return
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
    //    badRequest(res, "Quotation already exists with this reference number");
    //    return
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
      status: data.status || "draft",
      isConsumed: false,
      guid: data.guid || null,
      alterid: data.alterid || null
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

    // ✅ Validate status
    const allowedStatus = ["draft", "accepted", "rejected"];
    if (status && !allowedStatus.includes(status)) {
      return badRequest(res, "Invalid status value");
    }
    // 🟢 HIERARCHY LOGIC 🟢
    // Admin > Manager > Sales Person
    // We fetch all sub-users created by the logged-in user, and their sub-users too.
    
    // 🟢 DEEP HIERARCHY LOGIC (Recursive Descendants) 🟢
    // Starts with the logged-in user and recursively finds all children, grandchildren, etc.
    // This supports chains like: Admin(1) > Manager(15) > Manager(16) > Sales Person(17)
    
    let teamUserIds: any[] = [userData.userId]; 
    let currentParentIds: any[] = [userData.userId];

    // 🔄 Loop until no more children are found at the next level
    while (currentParentIds.length > 0) {
      // Find all users created by the current batch of parents
      const subUsers = await User.findAll({
        where: { id: { [Op.in]: currentParentIds } },
        include: [{
          model: User,
          as: "createdUsers", // 👈 "createdUsers" finds CHILDREN (not creators/parents)
          attributes: ["id"]
        }]
      });

      let nextLevelParentIds: any[] = [];
      
      subUsers.forEach((u: any) => {
        const children = (u as any).createdUsers || [];
        children.forEach((child: any) => {
          // If we haven't seen this user yet, add them to the team and search their children next
          if (!teamUserIds.includes(child.id)) {
            teamUserIds.push(child.id);
            nextLevelParentIds.push(child.id);
          }
        });
      });

      // Move to the next generation
      currentParentIds = nextLevelParentIds;
    }



    // ✅ Base where condition for Quotations
    // We now filter by all IDs discovered in the hierarchy (Self + all Descendants)
    let whereCondition: any = {
      userId: { [Op.in]: teamUserIds },
      status: {
        [Op.notIn]: ["cancelled", "deleted"]
      }
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
    quotationData.TallyAPISync = true
    await quotationData.save();
    createSuccess(res, "Quotation updated successfully");
  }catch(error){
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


// addLeave/getLeave/getLeaveById/updateLeave (CompanyLeave leave-type
// policy CRUD) have moved to src/modules/leave/ — see leave.controller.ts/
// service.ts/repository.ts. Routes are mounted from server.ts, same URL
// paths as before.


// addCompanyBank has moved to src/modules/company/ — see
// company.controller.ts/service.ts/repository.ts.



export const getClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    // ✅ Auth validation
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { status, search } = req.query;

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ✅ Get all team user IDs (BFS traversal)
    let teamUserIds: number[] = [];
    let queue: number[] = [userData.userId];

    while (queue.length > 0) {
      const users = await User.findAll({
        where: { id: { [Op.in]: queue } },
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "createdUsers",
            attributes: ["id"],
          },
        ],
      });

      let nextQueue: number[] = [];

      for (const user of users as any[]) {
        if (!teamUserIds.includes(user.id)) {
          teamUserIds.push(user.id);
        }

        const children = user.createdUsers || [];

        for (const child of children) {
          if (!teamUserIds.includes(child.id)) {
            nextQueue.push(child.id);
          }
        }
      }

      queue = nextQueue;
    }

    // ✅ Where condition
    const obj: any = {
      userId: { [Op.in]: teamUserIds },
    };

    if (status) {
      obj.status = status;
    }

    if (search) {
      const searchValue = `%${search}%`;

      obj[Op.or] = [
        { name: { [Op.like]: searchValue } },
        { email: { [Op.like]: searchValue } },
        { mobile: { [Op.like]: searchValue } },
        { companyName: { [Op.like]: searchValue } },
        { city: { [Op.like]: searchValue } },
        { state: { [Op.like]: searchValue } },
      ];
    }

    // ✅ Fetch data
    const { count, rows } = await MeetingUser.findAndCountAll({
      where: obj,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // ✅ Response (UNCHANGED)
    createSuccess(res, "user list fetched successfully", {
      total: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const updateClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { id } = req.params || {};

    if (!id) {
      badRequest(res, "Client ID is required");
      return;
    }

    const client = await MeetingUser.findOne({
      where: {
        id: Number(id),
        // userId: Number(userData.userId),
      },
    });

    if (!client) {
      badRequest(res, "Client not found");
      return;
    }
    client.status = req.body.status;
    await client.save();

    if (!client) {
      badRequest(res, "Client not found");
      return;
    }
    createSuccess(res, "Client fetched successfully", client);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const CategoryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { id } = req.params || {};

    if (!id) {
      badRequest(res, "Category ID is required");
      return;
    }

    const category = await Category.findOne({
      where: {
        id: Number(id),
      },
    });

    if (!category) {
      badRequest(res, "Category not found");
      return;
    }
    category.status = req.body.status;
    await category.save();

    createSuccess(res, "Category updated successfully", category);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const SubCategoryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { id } = req.params || {};

    if (!id) {
      badRequest(res, "Sub Category ID is required");
      return;
    }

    const subCategory = await SubCategory.findOne({
      where: {
        id: Number(id),
      },
    });

    if (!subCategory) {
      badRequest(res, "Sub Category not found");
      return;
    }
    subCategory.status = req.body.status;
    await subCategory.save();

    createSuccess(res, "Sub Category updated successfully", subCategory);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const addInvoice = async (
  req: Request,
  res: Response
): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    const userData = req.userData as JwtPayload;

    // 🔒 Auth validation
    if (!userData?.userId) {
      await transaction.rollback();
      badRequest(res, "Unauthorized request");
    }

    const data = req.body;

    // 🔍 Basic validation
    if (!data.customerName) {
      await transaction.rollback();
      badRequest(res, "Customer name is required");
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      await transaction.rollback();
      badRequest(res, "Items are required");
    }

    // 🔍 Item validation
    for (const item of data.items) {
      if (!item.itemName || !item.quantity || !item.rate) {
        await transaction.rollback();
        badRequest(
          res,
          "Each item must have itemName, quantity, and rate"
        );
      }

      if (!item.index) {
        await transaction.rollback();
        badRequest(res, "Item index is required");
      }

      if (Number(item.quantity) <= 0) {
        await transaction.rollback();
        badRequest(res, "Item quantity must be greater than 0");
      }
    }

    const {
      tallyInvoiceNumber = "web",
      customerName,
      quotationId,
      status,
      QuotationNumber,
      QuotationDate,
      date,
      guid,
      alterid,
      ...restData
    } = data;

    let quotationRecord: any = null;

    // =========================================
    // 🔁 QUOTATION HANDLING (FIXED LOGIC)
    // =========================================
    if (quotationId) {
      quotationRecord = await Quotations.findOne({
        where: { id: Number(quotationId) },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!quotationRecord) {
        throw new Error("Quotation not found");
      }

      if (quotationRecord.isConsumed) {
        throw new Error("Quotation already fully consumed");
      }

      const quotationData = quotationRecord.quotation;

      if (!Array.isArray(quotationData?.items)) {
        throw new Error("Invalid quotation items");
      }

      // 🧠 Filter only valid (remaining) invoice items
      const validInvoiceItems = data.items.filter((invItem: any) => {
        const qItem = quotationData.items.find(
          (q: any) => String(q.index) === String(invItem.index)
        );

        if (!qItem) return false;

        const remaining =
          Number(qItem.quantity) - Number(qItem.consumedQuantity || 0);

        return remaining > 0;
      });

      if (validInvoiceItems.length === 0) {
        throw new Error("All selected items are already fully consumed");
      }

      // 🧠 Update quotation items
      const updatedItems = quotationData.items.map((qItem: any) => {
        const invItem = validInvoiceItems.find(
          (i: any) => String(i.index) === String(qItem.index)
        );

        const baseQuantity = Number(qItem.quantity) || 0;
        const alreadyConsumed = Number(qItem.consumedQuantity) || 0;

        // 🟢 Skip fully consumed
        if (alreadyConsumed >= baseQuantity) {
          return {
            ...qItem,
            consumedQuantity: alreadyConsumed,
            remainingQuantity: 0,
          };
        }

        // 🟡 No new invoice item → keep same
        if (!invItem) {
          return {
            ...qItem,
            consumedQuantity: alreadyConsumed,
            remainingQuantity: baseQuantity - alreadyConsumed,
          };
        }

        const newConsume = Number(invItem.quantity) || 0;

        const available = baseQuantity - alreadyConsumed;

        // 🔴 Prevent over-consumption
        // if (newConsume > available) {
        //   throw new Error(
        //     `Only ${available} quantity left for ${qItem.itemName}`
        //   );
        // }

        const totalConsumed = alreadyConsumed + newConsume;

        return {
          ...qItem,
          consumedQuantity: totalConsumed,
          remainingQuantity: baseQuantity - totalConsumed,
        };
      });

      // ✅ Check if fully consumed
      const isQuotationConsumed =
        updatedItems.length > 0 &&
        updatedItems.every(
          (item: any) => Number(item.remainingQuantity) === 0
        );

      // 💾 Save
      quotationRecord.set("quotation", {
        ...quotationData,
        items: updatedItems,
      });

      quotationRecord.set("isConsumed", isQuotationConsumed);
      quotationRecord.changed("quotation", true);

      await quotationRecord.save({ transaction });

      // 👉 Replace original items with valid ones only
      data.items = validInvoiceItems;
    }

    // =========================================
    // 🧾 CREATE INVOICE
    // =========================================
    const invoicePayload = {
      userId: userData.userId,
      companyId: userData.companyId || 0,
      invoiceNumber: tallyInvoiceNumber,
      customerName,
      quotationId: quotationId || null,
      status: status || "draft",
      quotationNumber: QuotationNumber || null,
      quotationDate: QuotationDate ? new Date(QuotationDate) : null,
      invoiceDate: date ? new Date(date) : null,
      invoice: restData,
      items: data.items,
      guid: guid || null,
      alterid: alterid || null
    };

    const invoiceData = await Invoices.create(invoicePayload, {
      transaction,
    });

    // ✅ Commit
    await transaction.commit();

    createSuccess(res, "Invoice added successfully", invoiceData);
  } catch (error) {
    await transaction.rollback();

    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";

    badRequest(res, errorMessage);
    return
  }
};


// export const addInvoice = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   const transaction = await sequelize.transaction();

//   try {
//     const userData = req.userData as JwtPayload;

//     // 🔒 Auth validation
//     if (!userData?.userId) {
//       await transaction.rollback();
//       badRequest(res, "Unauthorized request");
//       return;
//     }

//     const data = req.body;

//     // 🔍 Basic validation
//     if (!data.customerName) {
//       await transaction.rollback();
//       badRequest(res, "Customer name is required");
//       return;
//     }

//     if (!Array.isArray(data.items) || data.items.length === 0) {
//       await transaction.rollback();
//       badRequest(res, "Items are required");
//       return;
//     }

//     // 🔍 Item validation
//     for (const item of data.items) {
//       if (!item.itemName || !item.quantity || !item.rate) {
//         await transaction.rollback();
//         badRequest(
//           res,
//           "Each item must have itemName, quantity, and rate"
//         );
//         return;
//       }

//       if (!item.index) {
//         await transaction.rollback();
//         badRequest(res, "Item index is required for quotation mapping");
//         return;
//       }

//       if (Number(item.quantity) <= 0) {
//         await transaction.rollback();
//         badRequest(res, "Item quantity must be greater than 0");
//         return;
//       }
//     }

//     // 🧩 Extract fields
//     const {
//       tallyInvoiceNumber = "web",
//       customerName,
//       quotationId,
//       status,
//       QuotationNumber,
//       QuotationDate,
//       date,
//       ...restData
//     } = data;

//     let quotationRecord: any = null;

//     // ============================
//     // 🔁 HANDLE QUOTATION UPDATE
//     // ============================
//     if (quotationId) {
//       quotationRecord = await Quotations.findOne({
//         where: { id: Number(quotationId) },
//         transaction,
//         lock: transaction.LOCK.UPDATE, // 🔒 prevent race condition
//       });

//       if (!quotationRecord) {
//         throw new Error("Quotation not found");
//       }

//       // 🚫 Prevent invoicing if already consumed
//       if (quotationRecord.isConsumed) {
//         throw new Error("Quotation already fully consumed");
//       }

//       const quotationData = quotationRecord.quotation;

//       if (!quotationData?.items || !Array.isArray(quotationData.items)) {
//         throw new Error("Invalid quotation items");
//       }

//       // 🧠 Update quantities
//       const updatedItems = quotationData.items.map((qItem: any) => {
//         const invItem = data.items.find(
//           (i: any) => String(i.index) === String(qItem.index)
//         );

//         const baseQuantity = Number(qItem.quantity);
//         const alreadyConsumed = Number(qItem.consumedQuantity || 0);

//         // If no invoice item → just recalc remaining
//         if (!invItem) {
//           const remaining = baseQuantity - alreadyConsumed;

//           return {
//             ...qItem,
//             consumedQuantity: alreadyConsumed,
//             remainingQuantity: remaining,
//           };
//         }

//         const newConsume = Number(invItem.quantity);
//         const totalConsumed = alreadyConsumed + newConsume;

//         if (totalConsumed > baseQuantity) {
//           throw new Error(
//             `Invoice quantity exceeds quotation for item: ${qItem.itemName}`
//           );
//         }

//         const remaining = baseQuantity - totalConsumed;

//         return {
//           ...qItem,
//           consumedQuantity: totalConsumed,
//           remainingQuantity: remaining,
//         };
//       });

//       // ✅ Check if all items fully consumed
//       const isQuotationConsumed =
//         updatedItems.length > 0 &&
//         updatedItems.every(
//           (item: any) => Number(item.remainingQuantity) === 0
//         );

//       // ✅ Save quotation JSON + flag
//       quotationRecord.set("quotation", {
//         ...quotationData,
//         items: updatedItems,
//       });

//       quotationRecord.set("isConsumed", isQuotationConsumed);

//       quotationRecord.changed("quotation", true);

//       await quotationRecord.save({ transaction });
//     }

//     // ============================
//     // 🧾 CREATE INVOICE
//     // ============================
//     const invoicePayload = {
//       userId: userData.userId,
//       companyId: userData.companyId || 0,
//       invoiceNumber: tallyInvoiceNumber,
//       customerName,
//       quotationId: quotationId || null,
//       status: status || "draft",
//       quotationNumber: QuotationNumber || null,
//       quotationDate: QuotationDate ? new Date(QuotationDate) : null,
//       invoiceDate: date ? new Date(date) : null,
//       invoice: restData,
//       items: data.items,
//     };

//     const invoiceData = await Invoices.create(invoicePayload, {
//       transaction,
//     });

//     // ✅ Commit transaction
//     await transaction.commit();

//     createSuccess(res, "Invoice added successfully", invoiceData);
//   } catch (error) {
//     await transaction.rollback();

//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";

//     badRequest(res, errorMessage);
//   }
// };
export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;




    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const {
      page = "1",
      limit = "10",
      search = "",
      companyName,
      city,
      state,
      status,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Math.min(Number(limit), 50);
    const offset = (pageNumber - 1) * pageSize;

    // ✅ Recursive team users
    let teamUserIds: any[] = [userData.userId];
    let currentParentIds: any[] = [userData.userId];

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

      let nextLevelParentIds: any[] = [];

      subUsers.forEach((u: any) => {
        const children = u.createdUsers || [];

        children.forEach((child: any) => {
          if (!teamUserIds.includes(child.id)) {
            teamUserIds.push(child.id);
            nextLevelParentIds.push(child.id);
          }
        });
      });

      currentParentIds = nextLevelParentIds;
    }

    

    // Drafts are gated separately via proformainvoice:view — a user with only
    // invoice:view should not see draft-status invoices in the list.
    const canViewDraft = await userHasPermission(
      Number(userData.userId),
      (userData as any).role,
      "proformainvoice",
      "view"
    );

    // ✅ FIX: Use ONLY ONE whereCondition
    let whereCondition: any = {
      userId: { [Op.in]: teamUserIds },
      status: {
        [Op.notIn]: canViewDraft ? ["cancelled", "deleted"] : ["cancelled", "deleted", "draft"]
      }
    };


    
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

  if (status) {
    let statusArray: string[];

    if (Array.isArray(status)) {
      // case: ?status[]=draft&status[]=sent
      statusArray = status.map((s) => String(s));
    } else if (typeof status === "string") {
      // case: ?status=draft,sent
      statusArray = status.split(",").map((s) => s.trim());
    } else {
      // Handle the case where it might be a ParsedQs object or other type
      statusArray = [String(status)];
    }

    // Without proformainvoice:view, drop "draft" from an explicit status filter too.
    if (!canViewDraft) {
      statusArray = statusArray.filter((s) => s !== "draft");
    }

    whereCondition.status = {
      [Op.in]: statusArray,
    };
  }

    // ✅ Query
    const { rows, count } = await Invoices.findAndCountAll({
      where: whereCondition,
      limit: pageSize,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    // ✅ DO NOT CHANGE RESPONSE STRUCTURE
    createSuccess(res, "Invoice list fetched successfully", {
      totalItems: count,
      currentPage: pageNumber,
      totalPages: Math.ceil(count / pageSize),
      pageSize,
      data: rows,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;



    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { id } = req.params || {};

    if (!id) {
      badRequest(res, "Invoice ID is required");
      return;
    }

    const invoice = await Invoices.findOne({
      where: {
        id: Number(id),
        // userId: Number(userData.userId),
      },
    });

    if (!invoice) {
      badRequest(res, "Invoice not found");
      return;
    }
    invoice.status = req.body.status;
    invoice.TallyAPISync = true
    await invoice.save();

    createSuccess(res, "Invoice updated successfully", invoice);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


// export const getRecordSale = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;

//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }

//     const {
//       page = "1",
//       limit = "10",
//       search = "",
//       companyName,
//       city,
//       state,
//       status,
//     } = req.query as any;

//     // ✅ Safe pagination parsing
//     const pageNumber = Math.max(Number(page) || 1, 1);
//     const pageSize = Math.min(Number(limit) || 10, 50);
//     const offset = (pageNumber - 1) * pageSize;

//     /** --------------------------
//      * 🔁 Get Team Users (Recursive)
//      * -------------------------- */
//     let teamUserIds: number[] = [userData.userId];
//     let currentParentIds: number[] = [userData.userId];

//     while (currentParentIds.length > 0) {
//       const subUsers = await User.findAll({
//         where: { id: { [Op.in]: currentParentIds } },
//         include: [
//           {
//             model: User,
//             as: "createdUsers",
//             attributes: ["id"],
//           },
//         ],
//       });

//       let nextLevelParentIds: number[] = [];

//       subUsers.forEach((u: any) => {
//         const children = u.createdUsers || [];

//         children.forEach((child: any) => {
//           if (!teamUserIds.includes(child.id)) {
//             teamUserIds.push(child.id);
//             nextLevelParentIds.push(child.id);
//           }
//         });
//       });

//       currentParentIds = nextLevelParentIds;
//     }

//     /** --------------------------
//      * 🔍 Filters
//      * -------------------------- */
//     const whereCondition: any = {
//       userId: { [Op.in]: teamUserIds },
//     };

//     // Global search
//     if (search) {
//       whereCondition[Op.or] = [
//         { companyName: { [Op.like]: `%${search}%` } },
//         { city: { [Op.like]: `%${search}%` } },
//         { state: { [Op.like]: `%${search}%` } },
//       ];
//     }

//     if (companyName) {
//       whereCondition.companyName = { [Op.like]: `%${companyName}%` };
//     }

//     if (city) {
//       whereCondition.city = { [Op.like]: `%${city}%` };
//     }

//     if (state) {
//       whereCondition.state = { [Op.like]: `%${state}%` };
//     }

//     if (status) {
//       whereCondition.status = status;
//     }

//     /** --------------------------
//      * 📦 Fetch Data
//      * -------------------------- */
//     const { count, rows } = await RecordSales.findAndCountAll({
//       where: whereCondition,
//       order: [["createdAt", "DESC"]], // ✅ latest first
//       limit: pageSize,                // ✅ fixed
//       offset,
//     });

//     /** --------------------------
//      * 🧠 Transform Data
//      * -------------------------- */
//     const updatedRows = rows.map((item: any, rowIndex: number) => {
//       const data = item.toJSON();
//       const { quotation, ...rest } = data;

//       const finalQuotation = quotation?.quotation || quotation;

//       if (finalQuotation?.items && Array.isArray(finalQuotation.items)) {
//         finalQuotation.items = finalQuotation.items.map(
//           (itm: any, itemIndex: number) => ({
//             index: itemIndex + 1,
//             ...itm,
//           })
//         );
//       }

//       return {
//         ...rest,
//         rowIndex: offset + rowIndex + 1,
//         quotation: finalQuotation,
//       };
//     });

//     /** --------------------------
//      * ✅ Response
//      * -------------------------- */
//     createSuccess(res, "Invoice list fetched successfully", {
//       totalItems: count,
//       currentPage: pageNumber,
//       totalPages: Math.ceil(count / pageSize),
//       pageSize,
//       data: updatedRows, // ✅ FIXED (was rows)
//     });

//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
export const getRecordSale = async (req: Request, res: Response): Promise<void> => {
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
      companyName,
      city,
      state,
      status,
      startDate,   // ✅ added
      endDate,     // ✅ added
    } = req.query as any;

    // ✅ Safe pagination parsing
    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Number(limit) || 10, 50);
    const offset = (pageNumber - 1) * pageSize;

    /** --------------------------
     * 🔁 Get Team Users (Recursive)
     * -------------------------- */
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

      let nextLevelParentIds: number[] = [];

      subUsers.forEach((u: any) => {
        const children = u.createdUsers || [];

        children.forEach((child: any) => {
          if (!teamUserIds.includes(child.id)) {
            teamUserIds.push(child.id);
            nextLevelParentIds.push(child.id);
          }
        });
      });

      currentParentIds = nextLevelParentIds;
    }

    /** --------------------------
     * 🔍 Filters
     * -------------------------- */
    const whereCondition: any = {
      userId: { [Op.in]: teamUserIds },
    };

    // 🔍 Global search
    if (search) {
      whereCondition[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { state: { [Op.like]: `%${search}%` } },
      ];
    }

    if (companyName) {
      whereCondition.companyName = { [Op.like]: `%${companyName}%` };
    }

    if (city) {
      whereCondition.city = { [Op.like]: `%${city}%` };
    }

    if (state) {
      whereCondition.state = { [Op.like]: `%${state}%` };
    }

    // ✅ Status filter
    if (status) {
      whereCondition.paymentReceived = status;
    }

    // ✅ Date filter (createdAt)
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

    /** --------------------------
     * 📦 Fetch Data
     * -------------------------- */
    const { count, rows } = await RecordSales.findAndCountAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    /** --------------------------
     * 🧠 Transform Data
     * -------------------------- */
    const updatedRows = rows.map((item: any, rowIndex: number) => {
      const data = item.toJSON();
      const { quotation, ...rest } = data;

      const finalQuotation = quotation?.quotation || quotation;

      if (finalQuotation?.items && Array.isArray(finalQuotation.items)) {
        finalQuotation.items = finalQuotation.items.map(
          (itm: any, itemIndex: number) => ({
            index: itemIndex + 1,
            ...itm,
          })
        );
      }

      return {
        ...rest,
        rowIndex: offset + rowIndex + 1,
        quotation: finalQuotation,
      };
    });

    /** --------------------------
     * ✅ Response (UNCHANGED)
     * -------------------------- */
    createSuccess(res, "Invoice list fetched successfully", {
      totalItems: count,
      currentPage: pageNumber,
      totalPages: Math.ceil(count / pageSize),
      pageSize,
      data: updatedRows,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const addReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData?.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const payload = req.body;



    // ✅ FIXED NORMALIZATION
    let reports: any[] = [];


    if (Array.isArray(payload)) {
      reports = payload;
    } else if (Array.isArray(payload.data)) {
      reports = payload.data;
    } else {
      reports = [payload];
    }

    if (!reports.length) {
      badRequest(res, "Payload cannot be empty");
      return;
    }

    // ✅ VALIDATION
    const allowedStatus = [
      "draft",
      "imported",
      "sent",
      "accepted",
      "rejected",
    ];

    const validateReport = (item: any, index: number) => {
      if (!item.date) throw new Error(`date is required at index ${index}`);
      if (!item.referenceNo) throw new Error(`referenceNo is required at index ${index}`);
      if (!item.customerName) throw new Error(`customerName is required at index ${index}`);

      if (item.openingAmount == null || isNaN(item.openingAmount)) {
        throw new Error(`openingAmount must be number at index ${index}`);
      }

      if (item.pendingAmount == null || isNaN(item.pendingAmount)) {
        throw new Error(`pendingAmount must be number at index ${index}`);
      }

      if (item.pendingAmount > item.openingAmount) {
        throw new Error(`pendingAmount > openingAmount at index ${index}`);
      }

      if (!item.dueOn || isNaN(new Date(item.dueOn).getTime())) {
        throw new Error(`Invalid dueOn at index ${index}`);
      }

      if (!Number.isInteger(item.overdueDays)) {
        throw new Error(`overdueDays must be integer at index ${index}`);
      }

      if (item.status && !allowedStatus.includes(item.status)) {
        throw new Error(`Invalid status at index ${index}`);
      }
    };

    reports.forEach((item, index) => validateReport(item, index));

    // ✅ DUPLICATE CHECK (referenceNo + date)
    const conditions = reports.map((item) => ({
      referenceNo: item.referenceNo,
      date: item.date,

    }));

    const existingReports = await Report.findAll({
      where: {
        [Op.or]: conditions,
      },
    });

    if (existingReports.length > 0) {
      const duplicates = existingReports
        .map((r: any) => `Ref: ${r.referenceNo}, Date: ${r.date}`)
        .join("; ");
      badRequest(res, `Duplicate reports found: ${duplicates}`);
      return;
    }

    // ✅ PREPARE DATA
    const finalData = reports.map((item) => ({
      ...item,
      userId: userData.userId,
      companyId: userData.companyId || userData.userId,
    }));

    let result;

    if (finalData.length === 1) {
      result = await Report.create(finalData[0]);
    } else {
      result = await Report.bulkCreate(finalData, {
        validate: true,
        returning: true,
      });
    }

    createSuccess(res, "Report added successfully", result);

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


// export const addReport = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;

//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }

//     const payload = req.body;

//     // ✅ Normalize to array
//     const reports = Array.isArray(payload) ? payload : [payload];

//     if (!reports.length) {
//       badRequest(res, "Payload cannot be empty");
//       return;
//     }

//     // ✅ Validation function
//     const validateReport = (item: any, index: number) => {
//       if (!item.date) {
//         throw new Error(`date is required at index ${index}`);
//       }

//       if (!item.referenceNo) {
//         throw new Error(`referenceNo is required at index ${index}`);
//       }

//       if (!item.customerName) {
//         throw new Error(`customerName is required at index ${index}`);
//       }

//       if (item.openingAmount == null || isNaN(item.openingAmount)) {
//         throw new Error(`openingAmount must be a number at index ${index}`);
//       }

//       if (item.openingAmount < 0) {
//         throw new Error(`openingAmount cannot be negative at index ${index}`);
//       }

//       if (item.pendingAmount == null || isNaN(item.pendingAmount)) {
//         throw new Error(`pendingAmount must be a number at index ${index}`);
//       }

//       if (item.pendingAmount < 0) {
//         throw new Error(`pendingAmount cannot be negative at index ${index}`);
//       }

//       if (item.pendingAmount > item.openingAmount) {
//         throw new Error(
//           `pendingAmount cannot be greater than openingAmount at index ${index}`
//         );
//       }

//       if (!item.dueOn || isNaN(new Date(item.dueOn).getTime())) {
//         throw new Error(`dueOn must be a valid date at index ${index}`);
//       }

//       if (item.overdueDays == null || !Number.isInteger(item.overdueDays)) {
//         throw new Error(`overdueDays must be an integer at index ${index}`);
//       }

//       if (item.overdueDays < 0) {
//         throw new Error(`overdueDays cannot be negative at index ${index}`);
//       }

//       const allowedStatus = [
//         "draft",
//         "imported",
//         "sent",
//         "accepted",
//         "rejected",
//       ];

//       if (item.status && !allowedStatus.includes(item.status)) {
//         throw new Error(`Invalid status at index ${index}`);
//       }
//     };

//     // ✅ Run validation
//     reports.forEach((item, index) => validateReport(item, index));

//     // ✅ Prepare data
//     const finalData = reports.map((item) => ({
//       ...item,
//       userId: userData.userId,
//       companyId: userData.companyId || userData.userId,
//     }));

//     let result;

//     if (finalData.length === 1) {
//       result = await Report.create(finalData[0]);
//     } else {
//       result = await Report.bulkCreate(finalData, {
//         validate: true,
//         returning: true,
//       });
//     }

//     createSuccess(
//       res,
//       finalData.length === 1
//         ? "Report added successfully"
//         : "Report added successfully",
//       result
//     );
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };


// export const addReport = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;

//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }

//     const payload = req.body;


//         if (referenceNo) {
//       whereCondition.referenceNo = referenceNo;
//     }

//     if (customerName) {
//       whereCondition.customerName = customerName;
//     }

//     if (date) {
//       // DB format: "2023-04-20T10:00:00.000Z"
//       // Input: "2023-04-20"
//       whereCondition.date = {
//         [Op.like]: `%${date}%`,
//       };
//     }

//     // ✅ Fetch latest matching record
//     const report = await Report.findOne({
//       where: whereCondition,
//       order: [["createdAt", "DESC"]],
//     });

//     if (!report) {
//       badRequest(res, "Report not found");
//       return;
//     }

//     // ==============================
//     // ✅ NORMALIZE INPUT (IMPORTANT)
//     // ==============================
//     let reports: any[] = [];

//     if (Array.isArray(payload)) {
//       // case: direct array
//       reports = payload;
//     } else if (Array.isArray(payload.data)) {
//       // case: { data: [...] }
//       reports = payload.data;
//     } else {
//       // case: single object
//       reports = [payload];
//     }

//     if (!reports.length) {
//       badRequest(res, "Payload cannot be empty");
//       return;
//     }

//     // ==============================
//     // ✅ VALIDATION
//     // ==============================
//     const allowedStatus = [
//       "draft",
//       "imported",
//       "sent",
//       "accepted",
//       "rejected",
//     ];

//     const validateReport = (item: any, index: number) => {
//       if (!item.date) {
//         throw new Error(`date is required at index ${index}`);
//       }

//       if (!item.referenceNo) {
//         throw new Error(`referenceNo is required at index ${index}`);
//       }

//       if (!item.customerName) {
//         throw new Error(`customerName is required at index ${index}`);
//       }

//       if (item.openingAmount == null || isNaN(item.openingAmount)) {
//         throw new Error(`openingAmount must be a number at index ${index}`);
//       }

//       if (item.openingAmount < 0) {
//         throw new Error(`openingAmount cannot be negative at index ${index}`);
//       }

//       if (item.pendingAmount == null || isNaN(item.pendingAmount)) {
//         throw new Error(`pendingAmount must be a number at index ${index}`);
//       }

//       if (item.pendingAmount < 0) {
//         throw new Error(`pendingAmount cannot be negative at index ${index}`);
//       }

//       if (item.pendingAmount > item.openingAmount) {
//         throw new Error(
//           `pendingAmount cannot be greater than openingAmount at index ${index}`
//         );
//       }

//       if (!item.dueOn || isNaN(new Date(item.dueOn).getTime())) {
//         throw new Error(`dueOn must be a valid date at index ${index}`);
//       }

//       if (item.overdueDays == null || !Number.isInteger(item.overdueDays)) {
//         throw new Error(`overdueDays must be an integer at index ${index}`);
//       }

//       if (item.overdueDays < 0) {
//         throw new Error(`overdueDays cannot be negative at index ${index}`);
//       }

//       if (item.status && !allowedStatus.includes(item.status)) {
//         throw new Error(`Invalid status at index ${index}`);
//       }
//     };

//     // Run validation
//     reports.forEach((item, index) => validateReport(item, index));

//     // ==============================
//     // ✅ PREPARE DATA
//     // ==============================
//     const finalData = reports.map((item) => ({
//       ...item,
//       userId: userData.userId,
//       companyId: userData.companyId || userData.userId,
//     }));

//     // ==============================
//     // ✅ INSERT DATA
//     // ==============================
//     let result;

//     if (finalData.length === 1) {
//       result = await Report.create(finalData[0]);
//     } else {
//       result = await Report.bulkCreate(finalData, {
//         validate: true,
//         returning: true,
//       });
//     }

//     // ==============================
//     // ✅ RESPONSE
//     // ==============================
//     createSuccess(
//       res,
//       "Report added successfully",
//       result
//     );

//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };
export const getReport = async (req: Request, res: Response): Promise<void> => {
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
      referenceNo,
      startDate,
      endDate,
    } = req.query as any;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Number(limit) || 10, 50);
    const offset = (pageNumber - 1) * pageSize;

    // ✅ Use AND conditions (important)
    const andConditions: any[] = [
      { userId: userData.userId },
    ];

    // 🔍 Global search
    if (search) {
      andConditions.push({
        [Op.or]: [
          { referenceNo: { [Op.like]: `%${search}%` } },
          { customerName: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    // 🎯 Reference filter (separate from search)
    if (referenceNo) {
      andConditions.push({
        referenceNo: { [Op.like]: `%${referenceNo}%` },
      });
    }

    // 📅 Date range filter (using createdAt)
    if (startDate && endDate) {
      andConditions.push({
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate),
          ],
        },
      });
    } else if (startDate) {
      andConditions.push({
        createdAt: {
          [Op.gte]: new Date(startDate),
        },
      });
    } else if (endDate) {
      andConditions.push({
        createdAt: {
          [Op.lte]: new Date(endDate),
        },
      });
    }

    const whereCondition = {
      [Op.and]: andConditions,
    };

    // ✅ Fetch data
    const { count, rows } = await Report.findAndCountAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    // ✅ Add rowIndex
    const updatedRows = rows.map((item: any, rowIndex: number) => ({
      ...item.toJSON(),
      rowIndex: offset + rowIndex + 1,
    }));

    createSuccess(res, "Reports fetched successfully", {
      totalItems: count,
      currentPage: pageNumber,
      totalPages: Math.ceil(count / pageSize),
      pageSize,
      data: updatedRows,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


// export const getReportById = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userData = req.userData as JwtPayload;

//     if (!userData?.userId) {
//       badRequest(res, "Unauthorized request");
//       return;
//     }

//     const { id } = req.params;

//     const report = await Report.findOne({
//       where: {
//         id,
//         // userId: userData.userId,
//       },
//     });

//     if (!report) {
//       badRequest(res, "Report not found");
//       return;
//     }

//     createSuccess(res, "Report fetched successfully", report);
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Something went wrong";
//     badRequest(res, errorMessage);
//   }
// };


export const getReportDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData?.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

    const { referenceNo, customerName, date } = req.query;

    // ❗ Require at least one filter
    if (!referenceNo && !customerName && !date) {
      badRequest(res, "At least one filter is required");
      return;
    }

    const whereCondition: any = {
      userId: userData.userId, // 🔐 security
    };

    // ✅ Flexible filters
    if (referenceNo) {
      whereCondition.referenceNo = referenceNo;
    }

    if (customerName) {
      whereCondition.customerName = customerName;
    }

    if (date) {
      // DB format: "2023-04-20T10:00:00.000Z"
      // Input: "2023-04-20"
      whereCondition.date = {
        [Op.like]: `%${date}%`,
      };
    }

    // ✅ Fetch latest matching record
    const report = await Report.findOne({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    if (!report) {
      badRequest(res, "Report not found");
      return;
    }

    createSuccess(res, "Report fetched successfully", report);

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};
export const updateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;

    if (!userData?.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }

     const { referenceNo, customerName, date } = req.query;

    // ❗ require at least one identifier
    if (!referenceNo && !customerName && !date) {
      badRequest(res, "At least one filter is required");
      return;
    }

    const whereCondition: any = {
      userId: userData.userId, // keep security
    };

    // 🎯 referenceNo
    if (referenceNo && customerName && date) {
      whereCondition.referenceNo = referenceNo;
      whereCondition.customerName = customerName; 
      // whereCondition.date = date;
    }

    // 🎯 date (match full day)
   if (date) {
      // DB format: "2023-04-20T10:00:00.000Z"
      // Input: "2023-04-20"
      whereCondition.date = {
        [Op.like]: `%${date}%`,
      };
    }
    const payload = req.body;

    const report = await Report.findOne({
      where: whereCondition,
      order: [["createdAt", "DESC"]], // latest match
    });

    if (!report) {
      badRequest(res, "Report not found");
      return;
    }

    const updatedReport = await report.update(payload);

    createSuccess(res, "Report updated successfully", updatedReport);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


export const assignAdmin = async(req:Request, res:Response):Promise<void>=>{
  try{
    const userData = req.userData as JwtPayload;

   let obj:any={};
    if(req.body.adminId){
      obj.adminId=req.body.adminId;
    }
    if(req.body.managerId){
      obj.managerId=req.body.managerId;
    }
    const item = await Company.update(obj,{
      where:{
        id:Number(req.params.id)
      }
    });
    createSuccess(res, "Admin assigned successfully", item);
  }catch(error){
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
}

// forgotPassword/verifyOtp/changePassword have moved to src/modules/auth/
// — see auth.controller.ts/service.ts/repository.ts.
