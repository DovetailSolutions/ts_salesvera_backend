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
    // sale_person is intentionally excluded — admin routes are off-limits to them
    const item = await User.findOne({
      where: {
        id,
        status: "active",
        [Op.or]: [
          { role: "user" },
          { role: "admin" },
          { role: "super_admin" },
          { role: "manager" },
        ],
      },
    }) as any;

    if (!item) {
      return res.status(403).json({
        code: "403",
        success: false,
        message: "Forbidden — user not found, inactive, or insufficient role",
      });
    }

    // ── Resolve companyId ──────────────────────────────────────────────
    // Priority: JWT payload → Company table lookup (admin) → null (super_admin)
    let companyId: number | null = (decoded as any).companyId
      ? Number((decoded as any).companyId)
      : null;

    if (!companyId && item.role !== "super_admin") {
      if (item.role === "admin") {
        const company = await (Company as any).findOne({
          where: { adminId: id },
          attributes: ["id"],
        });
        companyId = company ? company.id : null;
      } else {
        // For manager/sale_person: walk up the creator chain to find the root admin,
        // then resolve their company (mirrors the login companyId resolution)
        const { User: UserModel } = await import("./dbConnection");
        let currentId = id;
        let rootAdminId: number | null = null;

        while (true) {
          const currentUser = await (UserModel as any).findByPk(currentId, {
            include: [{ model: UserModel, as: "creators", attributes: ["id", "role"], through: { attributes: [] } }],
          });
          const plain = currentUser?.get({ plain: true }) as any;
          const creator = plain?.creators?.[0] || null;

          if (!creator) {
            if (plain?.role === "admin" || plain?.role === "super_admin") rootAdminId = currentId;
            break;
          }
          if (creator.role === "admin" || creator.role === "super_admin") {
            rootAdminId = creator.id;
            break;
          }
          currentId = creator.id;
        }

        if (rootAdminId) {
          const company = await (Company as any).findOne({
            where: { adminId: rootAdminId },
            attributes: ["id"],
          });
          companyId = company ? company.id : null;
        }
      }
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
