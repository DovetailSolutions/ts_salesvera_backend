import dotenv from "dotenv";
import { Op } from "sequelize";
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../config/dbConnection";
dotenv.config();

declare module "express-serve-static-core" {
  interface Request {
    userData?: string | JwtPayload;
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
        message: "Unauthorized — please provide a Bearer token",
      });
    }

    const token = req.headers.authorization.split(" ")[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "dovetailPharma"
      ) as JwtPayload;
    } catch (err) {
      return res.status(401).json({
        code: "401",
        success: false,
        message: "Unauthorized — invalid or expired token",
      });
    }

    const rawId = (decoded as any).userId ?? (decoded as any).id;
    const id = Number(rawId);

    // Verify user is active and has a valid non-admin role
    const item = await User.findOne({
      where: {
        id,
        status: "active",
        [Op.or]: [
          { role: "user" },
          { role: "manager" },
          { role: "sale_person" },
        ],
      },
    });

    if (!item) {
      return res.status(403).json({
        code: "403",
        success: false,
        message: "Forbidden — user not found, inactive, or insufficient role",
      });
    }

    // Enrich userData: spread decoded JWT (which includes companyId if present),
    // then override userId and role with the DB-verified values
    req.userData = {
      ...decoded,
      userId: id,
      role: item.role,
    };

    return next();
  } catch (error) {
    console.error("tokenCheck (user) error:", error);
    return res.status(500).json({
      code: "500",
      success: false,
      message: "Internal server error",
    });
  }
};
