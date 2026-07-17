import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as Middleware from "../../app/middlewear/comman";
import { Attendance } from "../../config/dbConnection";
import * as AttendanceService from "./attendance.service";

// ============================================================
// Attendance controller — thin HTTP layer, extracted verbatim from
// admin.ts's getAttendance/markAttendancePresent/bulkMarkAttendance/
// userAttendance/AttendanceBook and user.ts's AttendancePunchIn/
// AttendancePunchOut/getTodayAttendance/AttendanceList.
// ============================================================

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    if (error.status === 403) return forbidden(res, error.message);
    return badRequest(res, error.message);
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

// ---- Admin/team-scoped ----

export const getAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await AttendanceService.getAttendance(Number(userData.userId), req.query);
    res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const markAttendancePresent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;
    const record = await AttendanceService.markAttendancePresent(Number(userData.userId), callerCompanyId, req.body);
    createSuccess(res, "Attendance updated", record);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const userAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;
    if (!userId) {
      badRequest(res, "UserId is required", 400);
      return;
    }
    const userData = req.userData as JwtPayload;
    const result = await AttendanceService.userAttendance(Number(userData.userId), userId as string, req.query);
    createSuccess(res, "User attendance fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const AttendanceBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await AttendanceService.attendanceBook(Number(userData.userId), req.query);
    res.status(200).json({
      success: true,
      message: "Attendance loaded",
      data: result,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const bulkMarkAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const result = await AttendanceService.bulkMarkAttendance(
      Number(userData.userId),
      userData.companyId ? Number(userData.companyId) : undefined,
      req.file as any,
      req.body
    );
    createSuccess(res, result.applied === 0 ? "No valid attendance rows to apply" : "Bulk attendance applied successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ---- Self-service (punch in/out, today, list) ----

export const AttendancePunchIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const record = await AttendanceService.attendancePunchIn(Number(userData?.userId), callerCompanyId, req.body);
    createSuccess(res, "Punch-in recorded successfully", record);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const AttendancePunchOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const record = await AttendanceService.attendancePunchOut(Number(userData?.userId), callerCompanyId, req.body);
    createSuccess(res, "Punch-out recorded successfully", record);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const record = await AttendanceService.getTodayAttendance(Number(userData?.userId));
    createSuccess(res, "Today attendance fetched successfully", record);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const AttendanceList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const finalUserId = userData?.userId;
    const data = req.query;

    const { data: attendanceRows, pagination } = await Middleware.withuserlogin(
      Attendance,
      finalUserId,
      data
    );
    res.status(200).json({
      success: true,
      message: "Attendance list fetched successfully",
      data: attendanceRows,
      pagination,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};
