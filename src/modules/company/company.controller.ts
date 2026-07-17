import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ServiceError } from "../shared/serviceError";
import * as CompanyService from "./company.service";

// ============================================================
// Company controller — thin HTTP layer, extracted verbatim from admin.ts's
// addCompany/getCompany/getCompanyById/updateCompany/assignCompanyManager/
// removeCompanyManager/getCompanyManagers/getMyCompanies/switchCompany/
// deleteCompany/getOwnCompany/addCompanyBank.
// ============================================================

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) return badRequest(res, error.message);
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  return badRequest(res, errorMessage);
};

export const addCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const company = await CompanyService.addCompany(Number(userData.userId), userData.role, req.body);
    createSuccess(res, "Company added successfully", company);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const result = await CompanyService.getCompany(Number(userData.userId), req.query);
    createSuccess(res, "Company fetched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const company = await CompanyService.getCompanyById(req.params.id, Number(userData.userId), userData.role as string | undefined);
    createSuccess(res, "Company fetched successfully", company);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const updated = await CompanyService.updateCompany(req.params.id, Number(userData.userId), req.body, userData.role as string | undefined);
    createSuccess(res, "Company updated successfully", updated);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const assignCompanyManager = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const result = await CompanyService.assignCompanyManager(req.params.id, Number(userData.userId), req.body);
    createSuccess(res, result.message, result.record);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const removeCompanyManager = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    await CompanyService.removeCompanyManager(Number(userData.userId), req.body);
    createSuccess(res, "Manager removed from company", null);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompanyManagers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const assignments = await CompanyService.getCompanyManagers(req.params.id, Number(userData.userId));
    createSuccess(res, "Company managers fetched successfully", assignments);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getMyCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const companies = await CompanyService.getMyCompanies(Number(userData.userId), userData.role);
    createSuccess(res, "Companies fetched successfully", companies);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const assignCompanyAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const result = await CompanyService.assignCompanyAdmin(req.params.id, Number(userData.userId), req.body);
    createSuccess(res, result.message, result.record);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const removeCompanyAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    await CompanyService.removeCompanyAdmin(Number(userData.userId), req.body);
    createSuccess(res, "Admin removed from company", null);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompanyAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const assignments = await CompanyService.getCompanyAdmins(req.params.id, Number(userData.userId));
    createSuccess(res, "Company admins fetched successfully", assignments);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const switchCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const result = await CompanyService.switchCompany(Number(userData.userId), userData.role, req.body);
    createSuccess(res, "Company switched successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    await CompanyService.deleteCompany(req.params.id, Number(userData.userId));
    createSuccess(res, "Company deleted successfully");
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getOwnCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const companies = await CompanyService.getOwnCompany(Number(userData.userId));
    createSuccess(res, "Company fetched successfully", companies);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const addCompanyBank = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const result = await CompanyService.addCompanyBank(Number(userData.userId), req.body);
    createSuccess(res, "Bank details added successfully", result);
  } catch (error) {
    // Original preserved this specific generic message rather than error.message.
    if (error instanceof ServiceError) {
      badRequest(res, error.message);
      return;
    }
    badRequest(res, "Error adding bank details", error);
  }
};
