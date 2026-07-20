import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as DepartmentService from "./department.service";

// ============================================================
// Department controller — thin HTTP layer, extracted verbatim from
// admin.ts's addDepartment/updateDepartment/getDepartment/getDepartmentById.
// ============================================================

export const addDepartment = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const department = await DepartmentService.addDepartment(Number(userData.userId), req.body);
    return createSuccess(res, "Department added successfully", department);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const { id } = req.params || {};
    if (!id || isNaN(Number(id))) {
      return badRequest(res, "Valid department id is required");
    }

    const updated = await DepartmentService.updateDepartment(Number(id), Number(userData.userId), req.body);
    return createSuccess(res, "Department updated successfully", updated);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage, error);
  }
};

export const getDepartment = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await DepartmentService.listDepartments({
      userId: Number(userData.userId),
      role: userData.role as string | undefined,
      page,
      limit,
      search: (req.query.search as string) || "",
      branchId: req.query.branchId as string | undefined,
      companyId: req.query.companyId as string | undefined,
    });

    return createSuccess(res, "Departments fetched successfully", result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};

export const getDepartmentById = async (req: Request, res: Response) => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      return badRequest(res, "Unauthorized request");
    }
    if (!req.params.id) {
      return badRequest(res, "Department id is required");
    }
    if (isNaN(Number(req.params.id))) {
      return badRequest(res, "Department id must be a number");
    }

    const department = await DepartmentService.getDepartmentById(Number(req.params.id), Number(userData.userId));
    return createSuccess(res, "Department fetched successfully", department);
  } catch (error) {
    if (error instanceof ServiceError) return badRequest(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return badRequest(res, errorMessage);
  }
};
