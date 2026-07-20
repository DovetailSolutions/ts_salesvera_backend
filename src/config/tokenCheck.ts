import { Op } from "sequelize";
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User, Company, CompanyManager, CompanyAdmin } from "./dbConnection";
import { JWT_SECRET } from "./env";

declare module "express-serve-static-core" {
  interface Request {
    userData?: string | JwtPayload;
  }
}

interface CustomRequest extends Request {
  userData?: string | JwtPayload;
}

// ── Resolve companyId ──────────────────────────────────────────────────
// Priority: JWT payload → Company table lookup (admin/user) → CompanyManager
// junction (manager) → creator-chain walk to root admin (sale_person) →
// null (super_admin, or no company found).
export const resolveCompanyId = async (
  id: number,
  role: string,
  decodedCompanyId: number | null
): Promise<number | null> => {
  if (decodedCompanyId) return decodedCompanyId;
  if (role === "super_admin") return null;

  if (role === "admin") {
    const company = await (Company as any).findOne({
      where: { adminId: id },
      attributes: ["id"],
    });
    if (company) return company.id;

    // Fall back to the multi-company junction table (assign-company-admin)
    // for admins who administer a company without being its primary owner.
    const assignment = await (CompanyAdmin as any).findOne({
      where: { adminId: id },
      attributes: ["companyId"],
    });
    return assignment ? assignment.companyId : null;
  }

  if (role === "manager") {
    const assignment = await (CompanyManager as any).findOne({
      where: { managerId: id },
      attributes: ["companyId"],
    });
    return assignment ? assignment.companyId : null;
  }

  if (role === "user") {
    // "user" is a tenant root — resolves by ownership (Company.userId), not
    // by climbing to a creator (a tenant root's creator is super_admin,
    // which has no matching Company row and would always resolve to null).
    const company = await (Company as any).findOne({
      where: { userId: id },
      attributes: ["id"],
    });
    return company ? company.id : null;
  }

  // sale_person: walk up the creator chain to find the root admin, then
  // resolve their company.
  let currentId = id;
  let rootAdminId: number | null = null;

  while (true) {
    const currentUser = await (User as any).findByPk(currentId, {
      include: [{ model: User, as: "creators", attributes: ["id", "role"], through: { attributes: [] } }],
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

  if (!rootAdminId) return null;
  const company = await (Company as any).findOne({
    where: { adminId: rootAdminId },
    attributes: ["id"],
  });
  return company ? company.id : null;
};

/**
 * Shared JWT auth middleware factory. Verifies the bearer token, loads the
 * user (must be active and have one of `allowedRoles`), and attaches an
 * enriched, server-resolved `req.userData` (never trusting anything the
 * client sends beyond the signed token itself).
 */
export const createTokenCheck = (allowedRoles: string[]) => {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<any> => {
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
        decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      } catch (err) {
        return res.status(401).json({
          code: "401",
          success: false,
          message: "Unauthorized — invalid or expired token",
        });
      }

      const rawId = (decoded as any).userId ?? (decoded as any).id;
      const id = Number(rawId);

      const item = (await User.findOne({
        where: {
          id,
          status: "active",
          [Op.or]: allowedRoles.map((role) => ({ role })),
        },
      })) as any;

      if (!item) {
        return res.status(403).json({
          code: "403",
          success: false,
          message: "Forbidden — user not found, inactive, or insufficient role",
        });
      }

      const decodedCompanyId = (decoded as any).companyId ? Number((decoded as any).companyId) : null;
      const companyId = await resolveCompanyId(id, item.role, decodedCompanyId);

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
};

/**
 * Like createTokenCheck, but never rejects the request for a missing/invalid
 * token — it just leaves req.userData unset and calls next(). Exists solely
 * for /admin/register: role "super_admin" must remain callable with no
 * token at all (there's no seed script — the very first super_admin has
 * always been created through this exact endpoint, before any JWT can
 * exist), while every other role requires a real, hierarchy-checked caller.
 * That role-dependent branching happens in auth.service.ts's register(),
 * using req.userData when present — this middleware only ever *populates*
 * it opportunistically, it never enforces anything itself.
 */
export const optionalTokenCheck = async (
  req: CustomRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer") || !authHeader.split(" ")[1]) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return next();
    }

    const rawId = (decoded as any).userId ?? (decoded as any).id;
    const id = Number(rawId);

    const item = (await User.findOne({ where: { id, status: "active" } })) as any;
    if (!item) return next();

    const decodedCompanyId = (decoded as any).companyId ? Number((decoded as any).companyId) : null;
    const companyId = await resolveCompanyId(id, item.role, decodedCompanyId);

    req.userData = { ...decoded, userId: id, role: item.role, companyId };
    return next();
  } catch (error) {
    console.error("optionalTokenCheck error:", error);
    return next();
  }
};
