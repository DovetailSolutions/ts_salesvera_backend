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
