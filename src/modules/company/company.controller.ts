import { buildSpacesUrl } from "../../config/spaces";
import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as CompanyService from "./company.service";

// ============================================================
// Company controller — thin HTTP layer, extracted verbatim from admin.ts's
// addCompany/getCompany/getCompanyById/updateCompany/assignCompanyManager/
// removeCompanyManager/getCompanyManagers/getMyCompanies/switchCompany/
// deleteCompany/getOwnCompany/addCompanyBank.
//
// FIX: this file used to define its own private handleServiceError that
// always mapped to badRequest(400), silently discarding ServiceError.status
// — so the existing `throw new ServiceError(..., 403)` in getCompanyPolicy
// was never actually reaching callers as 403. Switched to the shared,
// status-aware mapper already used by attendance/attendanceSecurity
// controllers (badRequest for 400, forbidden for 403).
// ============================================================

export const addCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const files = req.files as { [fieldname: string]: Express.MulterS3.File[] } | undefined;
    const body = { ...req.body };
    const getFileUrl = (file?: any) => {
      if (!file) return undefined;
      return file.location || (file.key ? buildSpacesUrl(file.key) : undefined);
    };
    const profileImgUrl = getFileUrl(files?.companyProfileImg?.[0]);
    if (profileImgUrl) {
      body.companyProfileImg = profileImgUrl;
    } else if (body.companyProfileImg === "") {
      body.companyProfileImg = null;
    }
    const stampImgUrl = getFileUrl(files?.companyStampImg?.[0]);
    if (stampImgUrl) {
      body.companyStampImg = stampImgUrl;
    } else if (body.companyStampImg === "") {
      body.companyStampImg = null;
    }
    const signatureImgUrl = getFileUrl(files?.companySignatureImg?.[0]);
    if (signatureImgUrl) {
      body.companySignatureImg = signatureImgUrl;
    } else if (body.companySignatureImg === "") {
      body.companySignatureImg = null;
    }
    const company = await CompanyService.addCompany(Number(userData.userId), userData.role, body);
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
    const result = await CompanyService.getCompany(Number(userData.userId), req.query, userData.role as string | undefined);
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

export const getCompanyPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const callerCompanyId = (userData as any).companyId ? Number((userData as any).companyId) : null;
    const policy = await CompanyService.getCompanyPolicy(Number(userData.userId), userData.role as string | undefined, callerCompanyId);
    createSuccess(res, "Company policy fetched successfully", policy);
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
    const files = req.files as { [fieldname: string]: Express.MulterS3.File[] } | undefined;
    const body = { ...req.body };
    const getFileUrl = (file?: any) => {
      if (!file) return undefined;
      return file.location || (file.key ? buildSpacesUrl(file.key) : undefined);
    };
    const profileImgUrl = getFileUrl(files?.companyProfileImg?.[0]);
    if (profileImgUrl) {
      body.companyProfileImg = profileImgUrl;
    } else if (body.companyProfileImg === "") {
      body.companyProfileImg = null;
    }
    const stampImgUrl = getFileUrl(files?.companyStampImg?.[0]);
    if (stampImgUrl) {
      body.companyStampImg = stampImgUrl;
    } else if (body.companyStampImg === "") {
      body.companyStampImg = null;
    }
    const signatureImgUrl = getFileUrl(files?.companySignatureImg?.[0]);
    if (signatureImgUrl) {
      body.companySignatureImg = signatureImgUrl;
    } else if (body.companySignatureImg === "") {
      body.companySignatureImg = null;
    }
    const updated = await CompanyService.updateCompany(req.params.id, Number(userData.userId), body, userData.role as string | undefined);
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
    await CompanyService.deleteCompany(req.params.id, Number(userData.userId), userData.role as string | undefined);
    createSuccess(res, "Company deleted successfully", null);
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
    const fallbackCompanyId = userData.companyId ? Number(userData.companyId) : undefined;
    const result = await CompanyService.addCompanyBank(Number(userData.userId), req.body, fallbackCompanyId);
    createSuccess(res, "Bank details added successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompanyBanks = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const companyId = req.query.companyId
      ? Number(req.query.companyId)
      : (userData.companyId ? Number(userData.companyId) : undefined);

    if (!companyId) {
      badRequest(res, "companyId is required");
      return;
    }
    const banks = await CompanyService.getCompanyBanks(companyId);
    createSuccess(res, "Bank details retrieved successfully", banks);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getCompanyBankById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const bankId = Number(req.params.id);
    const userCompanyId = userData.companyId ? Number(userData.companyId) : undefined;
    const bank = await CompanyService.getCompanyBankById(bankId, userCompanyId, userData.role as string);
    createSuccess(res, "Bank detail retrieved successfully", bank);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const updateCompanyBank = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const bankId = Number(req.params.id);
    const userCompanyId = userData.companyId ? Number(userData.companyId) : undefined;
    const updated = await CompanyService.updateCompanyBank(bankId, req.body, userCompanyId, userData.role as string);
    createSuccess(res, "Bank details updated successfully", updated);
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const deleteCompanyBank = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    if (!userData || !userData.userId) {
      badRequest(res, "Unauthorized request");
      return;
    }
    const bankId = Number(req.params.id);
    const userCompanyId = userData.companyId ? Number(userData.companyId) : undefined;
    const result = await CompanyService.deleteCompanyBank(bankId, userCompanyId, userData.role as string);
    createSuccess(res, "Bank details deleted successfully", result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
