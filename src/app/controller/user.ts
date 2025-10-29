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
  PropertyType,
  Flat,
  Amenities,
  Property,
  Project,
} from "../../config/dbConnection";
import * as Middleware from "../middlewear/comman";

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
       const { email, password } = req.body || {};

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

    // ✅ Create access & refresh tokens
    const { accessToken, refreshToken } = Middleware.CreateToken(
      String(user.getDataValue("id")),
      String(user.getDataValue("role"))
    );

    // ✅ Save refresh token in DB
    await user.update({ refreshToken });

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
    const { firstName, lastName, email } = req.body || {};

    // ✅ Build update object dynamically
    const updates = { firstName, lastName, email };
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined && v !== "")
    );

    if (Object.keys(filteredUpdates).length === 0) {
      badRequest(res, "No valid fields provided to update");
      return;
    }
    // ✅ Update user
    const updatedUser = await Middleware.Update(
      User,
      Number(userData.userId),
      filteredUpdates
    );

    if (!updatedUser) {
      badRequest(res, "User not found");
      return;
    }
    createSuccess(res, "Profile updated successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};
export const MySalePerson = async (req: Request, res: Response): Promise<void> => {
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
          where,              // ✅ apply search
          required: false,    // ✅ so user must exist even if none found
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
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};




















export const addProdut = async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ Get user ID from JWT
    const userData = req.userData as JwtPayload;
    const user_id = userData?.userId;
    const {
      project_name,
      status,
      project_details,
      project_features,
      price_range_from,
      price_range_to,
      price_per_sqft,
      units_size_sqft,
      total_units,
      location,
      city,
      state,
      country,
      possession_date,
      builder_name,
      project_images,
      is_active,
    } = req.body || {};

    const allowedFields = [
      "project_name",
      "status",
      "project_details",
      "project_features",
      "price_range_from",
      "price_range_to",
      "price_per_sqft",
      "units_size_sqft",
      "total_units",
      "location",
      "city",
      "state",
      "country",
      "possession_date",
      "builder_name",
      "project_images",
      "is_active",
    ];

    // ✅ Build object with non-empty values
    const object: any = { user_id }; // include user_id
    for (const key of allowedFields) {
      const value = req.body[key];
      if (value !== undefined && value !== null && value !== "") {
        object[key] = value;
      }
    }

    // ✅ Auto-calculate price_per_sqft if missing
    if (
      price_range_from &&
      price_range_to &&
      !price_per_sqft &&
      units_size_sqft
    ) {
      const avgPrice = (Number(price_range_from) + Number(price_range_to)) / 2;
      object.price_per_sqft = avgPrice / Number(units_size_sqft);
    }

    // ✅ Save to DB
    const item = await Project.create(object);

    createSuccess(res, "Project added successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const AddPropertys = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const builder_id = userData?.userId;
    const {
      name,
      listing_type,
      property_for,
      owner_ship,
      project_id,
      category_id,
      property_type,
      amenities_id,
      title,
      unique_selling_point,
      state,
      city,
      country,
      locality,
      address,
      facing,
      bedroom,
      bathroom,
      balconies,
      floor_no,
      total_floor,
      furnished_status,
      price,
      price_negotiable,
      price_include,
      other_charge,
      maintenance_charge,
      maintenance_mode,
      corner_plot,
      length,
      breadth,
      is_active,
      possession_status,
      image,
    } = req.body || {};

    const allowedFields = [
      "name",
      "listing_type",
      "property_for",
      "owner_ship",
      "project_id",
      "category_id",
      "property_type",
      "amenities_id",
      "title",
      "price",
      "unique_selling_point",
      "state",
      "city",
      "country",
      "locality",
      "address",
      "facing",
      "bedroom",
      "bathroom",
      "balconies",
      "floor_no",
      "total_floor",
      "furnished_status",
      "price_negotiable",
      "price_include",
      "other_charge",
      "maintenance_charge",
      "maintenance_mode",
      "corner_plot",
      "length",
      "breadth",
      "is_active",
      "possession_status",
      "image",
    ];

    const object: any = { builder_id };
    // ✅ Add only non-empty fields
    for (const key of allowedFields) {
      if (
        req.body[key] !== undefined &&
        req.body[key] !== null &&
        req.body[key] !== ""
      ) {
        object[key] = req.body[key];
      }
    }
    // ✅ Auto calculations
    if (length && breadth) {
      object.area = Number(length) * Number(breadth);
    }
    if (price) {
      // If area exists, calculate price per sqft
      if (object.area) {
        object.price_per_sqft = Number(price) / Number(object.area);
      }

      // 25% of price as booking amount
      object.booking_amount = Number(price) * 0.25;
    }
    console.log("✅ Final Property Object:", object);
    const item = await Property.create(object);
    createSuccess(res, "Property added successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};

export const getProjectList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const data = req.query;
    const item = await Middleware.getCategory(Project, data,userData?.userId);
    if (!item) {
      badRequest(res, "Amenities not found");
      return;
    }
    createSuccess(res, "Amenities list", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage, error);
  }
};


export const getProjectDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params || {};
    const userData = req.userData as JwtPayload;

    // ✅ Validate input
    if (!id) {
      badRequest(res, "Project ID is required");
      return;
    }

    // ✅ Fetch project by ID and user ID (if provided)
    const item = await Middleware.getById(
      Project,
      Number(id),
      Number(userData?.userId)
    );

    // ✅ Handle not found
    if (!item) {
      badRequest(res, "Project not found");
      return;
    }

    // ✅ Success response
    createSuccess(res, "Project details fetched successfully", item);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // project ID
    const userData = req.userData as JwtPayload;

    if (!id) {
      badRequest(res, "Project ID is required");
      return;
    }

    // ✅ Extract allowed fields
    const allowedFields = [
      "project_name",
      "status",
      "project_details",
      "project_features",
      "price_range_from",
      "price_range_to",
      "price_per_sqft",
      "units_size_sqft",
      "total_units",
      "location",
      "city",
      "state",
      "country",
      "possession_date",
      "builder_name",
      "project_images",
      "is_active",
    ];

    // ✅ Build update object with only provided values
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      const value = req.body[key];
      if (value !== undefined && value !== null && value !== "") {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      badRequest(res, "No valid fields provided for update");
      return;
    }

    // ✅ Auto-calculate price_per_sqft if needed
    const { price_range_from, price_range_to, price_per_sqft, units_size_sqft } = req.body;
    if (
      price_range_from &&
      price_range_to &&
      !price_per_sqft &&
      units_size_sqft
    ) {
      const avgPrice = (Number(price_range_from) + Number(price_range_to)) / 2;
      updates.price_per_sqft = avgPrice / Number(units_size_sqft);
    }

    // ✅ Find project owned by current user (if applicable)
   const project = await Middleware.getById(
      Project,
      Number(id),
      Number(userData?.userId)
    );

    if (!project) {
      badRequest(res, "Project not found or not authorized");
      return;
    }

    // ✅ Perform update
    await project.update(updates);

    createSuccess(res, "Project updated successfully", project);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};


export const deleteProduct = async(req:Request,res:Response):Promise<void>=>{
  try{
     const { id } = req.params; // project ID
    const userData = req.userData as JwtPayload;
    if (!id) {
      badRequest(res, "Project ID is required");
      return;
    }
    const item = await Middleware.DeleteItembyId(Project,Number(id),Number(userData?.userId))
    if(!item){
      badRequest(res,"product not founded")
    }
    createSuccess(res,"product delete successfully")
  }catch(error){
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};