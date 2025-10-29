import dotenv from "dotenv";
import { Op } from "sequelize";
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../config/dbConnection";
dotenv.config();

declare module "express-serve-static-core" {
  interface Request {
    userData?: string | JwtPayload; // Or a custom type for decoded token
  }
}

interface CustomRequest extends Request {
  userData?: string | JwtPayload;
}

export const tokenCheck = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer") ||
      !req.headers.authorization.split(" ")[1]
    ) {
      return res.status(401).json({
        code: 401,
        success: false,
        errorMessage: "Please provide bearer token",
      });
    }

    const token = req.headers.authorization.split(" ")[1];
    console.log(">>>>>>>>>>>>>>>>>token", token);

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;
    } catch (err) {
      return res.status(401).json({
        code: "401",
        success: false,
        message: "Unauthorized",
      });
    }

    req.userData = decoded;
    console.log(">>>>>>>>>>>>>>>>>>>>>", req.userData);
    // support both possible token fields
    const rawId = (decoded as any).userId ?? (decoded as any).userId;
    const id = Number(rawId);

    // Fetch both tables in parallel (you asked to include Users table)
    const [item] = await Promise.all([
      User.findOne({
        where: {
          id,
          [Op.or]: [{ role: "user" }, { role: "manager" },{ role: "sale_person" }],
        },
      }),
    ]);
    if (
      (item && item.role === "user") ||
      item?.role === "manager" ||
      item?.role === "sale_person"
    ) {
      return next();
    }
    return res.status(403).json({
      code: "403",
      success: false,
      message: "Unauthorized",
    });
  } catch (error) {
    console.error(error);
  }
};
