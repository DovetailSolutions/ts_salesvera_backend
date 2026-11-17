import { Router, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { tokenCheck } from "../../config/jwtVerify";
import { createTokenCheck } from "../../config/tokenCheck";
import { authorizeRoles } from "../../app/middlewear/rbac";
import { ServiceError } from "../shared/serviceError";
import * as PlanAccess from "./planAccess.service";

// ============================================================
// Subscription plan / feature access API.
//
//   GET  /admin/subscription/features            any role — own plan + feature map
//   GET  /admin/subscription/overview            user, admin — subscription page
//   GET  /admin/super-admin/plans                super_admin — plan catalogue
//   GET  /admin/super-admin/tenants/:userId/subscription-overview
//   POST /admin/super-admin/tenants/:userId/addons
//   POST /admin/super-admin/tenants/:userId/addons/:code/cancel
//
// Plan upgrade/downgrade: PATCH /admin/super-admin/subscriptions/:id
// with { planId } (superAdmin.routes.ts).
// ============================================================

const router = Router();
const superAdminOnly = createTokenCheck(["super_admin"]);

const send = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    res.status(error.status || 400).json({ success: false, message: error.message, data: error.meta ?? {} });
    return;
  }
  console.error("[subscription]", error);
  res.status(500).json({ success: false, message: "Something went wrong" });
};

const caller = (req: Request) => {
  const u = req.userData as JwtPayload;
  return { userId: Number(u.userId), role: String(u.role) };
};

router.get("/subscription/features", tokenCheck, async (req, res) => {
  try {
    const { userId, role } = caller(req);
    res.json({ success: true, data: await PlanAccess.myEntitlements(userId, role) });
  } catch (e) { send(res, e); }
});

router.get("/subscription/overview", tokenCheck, authorizeRoles("user", "admin"), async (req, res) => {
  try {
    const { userId, role } = caller(req);
    res.json({ success: true, data: await PlanAccess.overview(userId, role) });
  } catch (e) { send(res, e); }
});

router.get("/super-admin/plans", superAdminOnly, async (_req, res) => {
  try {
    res.json({ success: true, data: await PlanAccess.listPlans() });
  } catch (e) { send(res, e); }
});

router.get("/super-admin/tenants/:userId/subscription-overview", superAdminOnly, async (req, res) => {
  try {
    const { userId, role } = caller(req);
    const tenant = Number(req.params.userId);
    if (!tenant) throw new ServiceError("Invalid tenant id");
    res.json({ success: true, data: await PlanAccess.overview(userId, role, tenant) });
  } catch (e) { send(res, e); }
});

router.post("/super-admin/tenants/:userId/addons", superAdminOnly, async (req, res) => {
  try {
    const tenant = Number(req.params.userId);
    if (!tenant) throw new ServiceError("Invalid tenant id");
    const result = await PlanAccess.activateAddon(caller(req).userId, tenant, req.body || {});
    res.status(result.alreadyActive ? 200 : 201).json({
      success: true,
      message: result.alreadyActive ? "Add-on is already active" : "Add-on activated",
      data: result.addon,
    });
  } catch (e) { send(res, e); }
});

router.post("/super-admin/tenants/:userId/addons/:code/cancel", superAdminOnly, async (req, res) => {
  try {
    const tenant = Number(req.params.userId);
    if (!tenant) throw new ServiceError("Invalid tenant id");
    const row = await PlanAccess.cancelAddon(caller(req).userId, tenant, String(req.params.code), req.body?.reason);
    res.json({ success: true, message: "Add-on cancelled", data: row });
  } catch (e) { send(res, e); }
});

export default router;
