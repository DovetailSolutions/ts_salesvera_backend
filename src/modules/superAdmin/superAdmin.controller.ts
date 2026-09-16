import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { ServiceError } from "../shared/serviceError";
import * as SuperAdminService from "./superAdmin.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return res.status(400).json({ success: false, message });
};

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await SuperAdminService.getDashboardStats();
    res.status(200).json({ success: true, message: "Super Admin dashboard stats fetched", data: stats });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await SuperAdminService.getUsersList(req.query as any);
    res.status(200).json({ success: true, message: "Users list fetched", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getUserTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = Number(req.params.id);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const tree = await SuperAdminService.getUserTreeDetails(targetUserId);
    res.status(200).json({ success: true, message: "User hierarchy tree fetched", data: tree });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const superAdminId = Number(userData.userId);
    const newUser = await SuperAdminService.createUserAsSuperAdmin(req.body, superAdminId);
    res.status(201).json({ success: true, message: "User created successfully", data: newUser });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = Number(req.params.id);
    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const updated = await SuperAdminService.updateUserAsSuperAdmin(targetUserId, req.body);
    res.status(200).json({ success: true, message: "User updated successfully", data: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/super-admin/subscriptions — every tenant's subscription, plan,
// expiry and role-limit usage in one list.
export const listSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search) : undefined;
    const result = await SuperAdminService.listTenantSubscriptions({ page, limit, offset, search });
    res.status(200).json({ success: true, message: "Subscriptions fetched", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/super-admin/subscriptions/:id — one tenant's full detail,
// usage, payment history, and access-audit trail.
export const getSubscriptionDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ success: false, message: "Invalid subscription id" }); return; }
    const result = await SuperAdminService.getTenantSubscriptionDetail(id);
    res.status(200).json({ success: true, message: "Subscription detail fetched", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// PATCH /admin/super-admin/subscriptions/:id — update plan limits, access
// window, or status (suspend/reactivate/cancel/etc).
export const updateSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ success: false, message: "Invalid subscription id" }); return; }
    const { reason, ...updates } = req.body || {};
    const result = await SuperAdminService.updateTenantSubscription(Number(userData.userId), id, updates, reason);
    res.status(200).json({ success: true, message: "Subscription updated", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};
