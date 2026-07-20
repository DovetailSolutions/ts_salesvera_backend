import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import { UserPermission } from "../app/model/userPermission";
import { Permission } from "../app/model/permission";
import { Invoices } from "../app/model/Invoice";
import { getUserPermissionsFromCache } from "./permissionCache";

// ============================================================
// checkPermission middleware factory
//
// Usage:
//   router.post('/attendance', tokenCheck, checkPermission('attendance', 'create'), controller)
//
// Behaviour by role:
//   super_admin  → always passes (global access, no DB hit)
//   admin        → checked against user_permissions cache (must have explicit permission)
//   manager      → checked against user_permissions cache
//   sale_person  → checked against user_permissions cache
//
// FIX: admin no longer bypasses permission checks — all non-super_admin roles
//      are verified against user_permissions so that an admin without leave:*
//      cannot access leave routes (and cannot cascade those rights to manager/sale_person).
// ============================================================

interface AuthenticatedRequest extends Request {
  userData?: string | JwtPayload;
}

/**
 * Loads a user's permissions from the database.
 * Returns an array of "module:action" strings.
 * Eager-loads Permission model to avoid N+1.
 */
const loadUserPermissionsFromDB = async (
  userId: number
): Promise<string[]> => {
  const userPerms = await UserPermission.findAll({
    where: { userId },
    include: [
      {
        model: Permission,
        as: "permission",
        attributes: ["module", "action"],
      },
    ],
    attributes: [],
  });

  return userPerms.map((up: any) => `${up.permission.module}:${up.permission.action}`);
};

/**
 * Direct permission check (no middleware) — usable from inside controllers
 * that need to branch behaviour (e.g. filtering a list) rather than reject
 * the whole request. super_admin always returns true.
 */
export const userHasPermission = async (
  userId: number,
  role: string,
  module: string,
  action: string
): Promise<boolean> => {
  if (role === "super_admin") return true;

  const permissionSet = await getUserPermissionsFromCache(
    userId,
    () => loadUserPermissionsFromDB(userId)
  );

  return permissionSet.has(`${module}:${action}`);
};

/**
 * Middleware factory — call with module and action to protect a route.
 */
export const checkPermission = (module: string, action: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData = req.userData as JwtPayload;

      if (!userData || !userData.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized — no user data in token",
        });
      }

      const { role, userId } = userData as any;
      // companyId comes exclusively from req.userData, which tokenCheck
      // already resolved server-side (JWT payload → DB lookup) — never from
      // client-supplied body/params/query, which would let a caller satisfy
      // this gate with an arbitrary companyId.
      const companyId = (userData as any).companyId;

      // ── Super Admin: bypass all permission checks ──────────────────
      if (role === "super_admin") {
        return next();
      }

      // ── Admin / Manager / User: check permissions table via cache ──────
      // sale_person is exempt from the companyId requirement — its permission
      // set is still enforced below, just without a company context gate.
      if (!companyId && role !== "sale_person") {
        return res.status(403).json({
          success: false,
          message: "Forbidden — no company context in token",
        });
      }

      const permissionSet = await getUserPermissionsFromCache(
        userId,
        () => loadUserPermissionsFromDB(userId)
      );

      const required = `${module}:${action}`;

      if (!permissionSet.has(required)) {
        return res.status(403).json({
          success: false,
          message: `You don’t have  '${module}" "${action}'permission`,
        });
      }

      return next();
    } catch (error) {
      console.error("checkPermission error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check",
      });
    }
  };
};

// ============================================================
// checkInvoiceCreatePermission middleware
//
// Add-invoice needs two different permissions depending on the invoice
// status sent by the client:
//   status === "draft" (or missing) → proformainvoice:create  (separate module,
//                                       managed independently of "invoice")
//   otherwise                        → invoice:create          (existing behaviour, unchanged)
// ============================================================
export const checkInvoiceCreatePermission = () => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData = req.userData as JwtPayload;

      if (!userData || !userData.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized — no user data in token",
        });
      }

      const { role, userId } = userData as any;
      const companyId =
        (userData as any).companyId ??
        req.body?.companyId ??
        req.params?.companyId ??
        req.query?.companyId;

      // ── Super Admin: bypass all permission checks ──────────────────
      if (role === "super_admin") {
        return next();
      }

      if (!companyId && role !== "sale_person") {
        return res.status(403).json({
          success: false,
          message: "Forbidden — no company context in token",
        });
      }

      // No status sent → Invoices.create() defaults it to "draft" too, so treat
      // a missing status the same as an explicit "draft" here.
      const isDraft = !req.body?.status || req.body.status === "draft";
      const module = isDraft ? "proformainvoice" : "invoice";
      const action = "create";
      const required = `${module}:${action}`;

      const permissionSet = await getUserPermissionsFromCache(
        userId,
        () => loadUserPermissionsFromDB(userId)
      );

      console.log(`checkInvoiceCreatePermission: userId=${userId}, role=${role}, required=${required}`);

      if (!permissionSet.has(required)) {
        return res.status(403).json({
          success: false,
          message: `You don’t have '${module}:${action}' permission`,
        });
      }

      return next();
    } catch (error) {
      console.error("checkInvoiceCreatePermission error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check",
      });
    }
  };
};

// ============================================================
// checkInvoiceViewPermission middleware
//
// getinvoice serves both real invoices and draft (proforma) invoices in one
// list, with the controller filtering draft rows by proformainvoice:view.
// That controller-level gating is dead code if the route itself requires
// invoice:view up front — a sale_person who only has proformainvoice:*
// (no invoice:view) would be blocked before ever reaching the controller,
// even though they're only asking for their draft invoices.
// Pass if the caller has EITHER invoice:view OR proformainvoice:view; the
// controller still scopes which rows (draft vs non-draft) are returned.
// ============================================================
export const checkInvoiceViewPermission = () => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData = req.userData as JwtPayload;

      if (!userData || !userData.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized — no user data in token",
        });
      }

      const { role, userId } = userData as any;
      const companyId =
        (userData as any).companyId ??
        req.body?.companyId ??
        req.params?.companyId ??
        req.query?.companyId;

      // ── Super Admin: bypass all permission checks ──────────────────
      if (role === "super_admin") {
        return next();
      }

      if (!companyId && role !== "sale_person") {
        return res.status(403).json({
          success: false,
          message: "Forbidden — no company context in token",
        });
      }

      const permissionSet = await getUserPermissionsFromCache(
        userId,
        () => loadUserPermissionsFromDB(userId)
      );

      console.log(`checkInvoiceViewPermission: userId=${userId}, role=${role}, has invoice:view=${permissionSet.has("invoice:view")}, has proformainvoice:view=${permissionSet.has("proformainvoice:view")}`);

      if (!permissionSet.has("invoice:view") && !permissionSet.has("proformainvoice:view")) {
        return res.status(403).json({
          success: false,
          message: `You don’t have 'invoice:view' or 'proformainvoice:view' permission`,
        });
      }

      return next();
    } catch (error) {
      console.error("checkInvoiceViewPermission error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check",
      });
    }
  };
};

// ============================================================
// checkInvoiceUpdatePermission middleware
//
// Updating an invoice needs a different permission depending on the
// invoice's CURRENT status (not the status being set):
//   currently "draft" → proformainvoice:update
//   otherwise         → invoice:update (existing behaviour, unchanged)
// Route must have an :id param identifying the invoice.
// ============================================================
export const checkInvoiceUpdatePermission = () => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData = req.userData as JwtPayload;

      if (!userData || !userData.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized — no user data in token",
        });
      }

      const { role, userId } = userData as any;
      const companyId =
        (userData as any).companyId ??
        req.body?.companyId ??
        req.params?.companyId ??
        req.query?.companyId;

      // ── Super Admin: bypass all permission checks ──────────────────
      if (role === "super_admin") {
        return next();
      }

      if (!companyId && role !== "sale_person") {
        return res.status(403).json({
          success: false,
          message: "Forbidden — no company context in token",
        });
      }

      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: "Invoice ID is required" });
      }

      const invoice = await Invoices.findOne({ where: { id: Number(id) } });
      if (!invoice) {
        return res.status(404).json({ success: false, message: "Invoice not found" });
      }

      const isDraft = (invoice as any).status === "draft";
      const module = isDraft ? "proformainvoice" : "invoice";
      const action = "update";
      const required = `${module}:${action}`;

      const permissionSet = await getUserPermissionsFromCache(
        userId,
        () => loadUserPermissionsFromDB(userId)
      );

      console.log(`checkInvoiceUpdatePermission: userId=${userId}, role=${role}, required=${required}`);

      if (!permissionSet.has(required)) {
        return res.status(403).json({
          success: false,
          message: `You don’t have '${module}:${action}' permission`,
        });
      }

      return next();
    } catch (error) {
      console.error("checkInvoiceUpdatePermission error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during permission check",
      });
    }
  };
};
