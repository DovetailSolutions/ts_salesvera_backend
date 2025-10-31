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
} from "sequelize";
import fs from "fs";
import pdfParse from "pdf-parse";
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
import {
  User,
  Category,
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";

const UNIQUE_ROLES = ["admin", "super_admin"];

export const Register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, dob, role,createdBy } = req.body;

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
         return
      }
    }
    /** ✅ Check if user with same email exists */
    const isExist = await Middleware.FindByEmail(User, email);
    if (isExist) {
       badRequest(res, "Email already exists");
       return
    }

    /** ✅ Check role — admin/super_admin only once in DB */
    if (UNIQUE_ROLES.includes(role)) {
      const existing = await Middleware.findByRole(User, role);
      if (existing) {
         badRequest(
          res,
          `${role} already exists. Only one ${role} can be created.`
        );
        return
      }
    }

    const obj:any = {
      email,
      password,
      firstName,
      lastName,
      phone,
      dob,
      role,
    }
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
      // item,
      accessToken,
      // refreshToken,
    });
  } catch (error) {
     badRequest(
      res,
      error instanceof Error ? error.message : "Something went wrong",
      error
    );
    return
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
    await user.update({ refreshToken });

    // ✅ Respond
    createSuccess(res, "Login successful", {
      accessToken,
      refreshToken,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
    return
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
    return
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
    return
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
    return
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

































