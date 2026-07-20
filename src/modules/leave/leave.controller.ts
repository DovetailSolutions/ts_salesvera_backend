import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as LeaveService from "./leave.service";

// ============================================================
// Leave controller — thin HTTP layer, extracted verbatim from admin.ts's
// approveLeave/assignLeaveBalance/getEmployeeLeaveBalance/
// getTeamLeaveBalances/leaveList/getTodayLeaveRequests/
// cancelLeaveAndMarkPresent/userLeave/ownLeave/addLeave/getLeave/
// getLeaveById/updateLeave.
// ============================================================

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

const getPagination = (req: Request) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

export const createLeaveRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const leave = await LeaveService.createLeaveRequest(Number(userData?.userId), callerCompanyId, req.body);
    createSuccess(res, "Leave requested successfully", leave);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const approveLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const leave = await LeaveService.approveLeave(Number(userData?.userId), req.body);
    createSuccess(res, "Status updated", leave);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const assignLeaveBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await LeaveService.assignLeaveBalance(Number(userData?.userId), callerCompanyId, req.body);
    createSuccess(res, "Leave balance assigned successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getEmployeeLeaveBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { employeeId } = req.params;
    const year = Number(req.query.year) || new Date().getFullYear();
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await LeaveService.getEmployeeLeaveBalance(Number(userData?.userId), employeeId, year, callerCompanyId);
    createSuccess(res, "Leave balance fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getTeamLeaveBalances = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const year = Number(req.query.year) || new Date().getFullYear();
    const { page, limit, offset } = getPagination(req);
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await LeaveService.getTeamLeaveBalances(Number(userData?.userId), year, page, limit, offset, callerCompanyId);
    createSuccess(res, "Team leave balances fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const leaveList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { status } = req.query;
    const { page, limit, offset } = getPagination(req);
    const result = await LeaveService.leaveList(Number(userData.userId), status, page, limit, offset);
    res.status(200).json({
      success: true,
      message: "Leaves fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getTodayLeaveRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await LeaveService.getTodayLeaveRequests(Number(userData.userId));
    res.status(200).json({
      success: true,
      message: "Today's leave requests fetched successfully",
      data: result,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const cancelLeaveAndMarkPresent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await LeaveService.cancelLeaveAndMarkPresent(Number(userData.userId), req.body);
    createSuccess(res, "Leave cancelled and attendance marked present", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const userLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;
    if (!userId) {
      badRequest(res, "UserId is required", 400);
      return;
    }
    const userData = req.userData as JwtPayload;
    const { page, limit, offset } = getPagination(req);
    const result = await LeaveService.userLeave(Number(userData?.userId), userId as string, page, limit, offset);
    createSuccess(res, "User leave fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const ownLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const { page, limit, offset } = getPagination(req);
    const result = await LeaveService.ownLeave(Number(userData?.userId), page, limit, offset);
    if (result.isEmpty) {
      badRequest(res, "No leaves found");
      return;
    }
    createSuccess(res, "Leave fetched successfully", {
      leave: result.leave,
      pagination: result.pagination,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const addLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const leaves = await LeaveService.addLeave(Number(userData.userId), req.body);
    createSuccess(res, "Leaves added successfully", leaves);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const result = await LeaveService.getLeave(Number(userData.userId), userData.role as string | undefined, req.query);
    createSuccess(res, "Leaves fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getLeaveById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { id } = req.params || {};
    const leave = await LeaveService.getLeaveById(id, Number(userData.userId), userData.role as string | undefined);
    createSuccess(res, "Leave fetched successfully", leave);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const { id } = req.params || {};
    const leave = await LeaveService.updateLeave(id, Number(userData.userId), userData.role as string | undefined, req.body);
    createSuccess(res, "Leave updated successfully", leave);
  } catch (error) {
    handleServiceError(res, error);
  }
};
