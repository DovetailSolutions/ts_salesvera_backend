import dotenv from "dotenv";
import { Op } from "sequelize";
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User, Company } from "../config/dbConnection";
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
        errorMessage: "Please provide bearer token",
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

    // Fetch user from DB — must be active and a valid role
    const item = await User.findOne({
      where: {
        id,
        status: "active",
        [Op.or]: [
          { role: "admin" },
          { role: "super_admin" },
          { role: "manager" },
          { role: "sale_person" },
        ],
      },
    }) as any;

    if (!item) {
      return res.status(403).json({
        code: "403",
        success: false,
        message: "Unauthorized — user not found or inactive",
      });
    }

    // ── Resolve companyId ──────────────────────────────────────────────
    // Priority: JWT payload → Company table lookup (admin) → null (super_admin)
    let companyId: number | null = (decoded as any).companyId
      ? Number((decoded as any).companyId)
      : null;

    if (!companyId && item.role !== "super_admin") {
      if (item.role === "admin") {
        // Admin's companyId = company where they are set as adminId
        const company = await (Company as any).findOne({
          where: { adminId: id },
          attributes: ["id"],
        });
        companyId = company ? company.id : null;
      }
      // manager / sale_person must include companyId in their JWT (set at login)
    }

    // Attach enriched userData to request (available in all controllers & middleware)
    req.userData = {
      ...decoded,
      userId: id,
      role: item.role,
      companyId,
    };

    return next();
  } catch (error) {
    console.error("tokenCheck error:", error);
    return res.status(500).json({
      code: "500",
      success: false,
      message: "Internal server error",
    });
  }
};
