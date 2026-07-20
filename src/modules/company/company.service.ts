import { ServiceError } from "../shared/serviceError";
import * as Middleware from "../../app/middlewear/comman";
import { invalidatePermissionCache } from "../../config/permissionCache";
import { hasCompanyAccess } from "../shared/companyAccess";
import * as CompanyRepo from "./company.repository";

// ============================================================
// Company service — validation + orchestration. Byte-for-byte port of the
// previous addCompany/getCompany/getCompanyById/updateCompany/
// assignCompanyManager/removeCompanyManager/getCompanyManagers/
// getMyCompanies/switchCompany/deleteCompany/getOwnCompany/addCompanyBank
// controller bodies in admin.ts.
// ============================================================

export const addCompany = async (userId: number, role: any, body: any) => {
  if (role !== "user") {
    throw new ServiceError("You are not authorized to add a company");
  }

  const {
    companyName, legalName, registrationNo, gst, pan, industry, companySize,
    website, companyEmail, companyPhone, city, timezone, currency, state, country, zipcode,
    // Bank
    bankAccountHolder, bankName, bankAccountNumber, bankIfsc, bankBranchName,
    bankAccountType, bankMicr, upiId,
    // HR Config
    payrollCycle, lateMarkAfter, autoHalfDayAfter, geoFencingRequired, officeLocationRequired,
    overtimeAllowed, companyWorkingDays, altSaturday, casualHolidaysTotal, casualHolidaysPerMonth,
    casualHolidayNotice, compOffMinHours, compOffExpiryDays, casualCarryForwardLimit,
    casualCarryForwardExpiry, adminId, managerId, createdBy,
  } = body;

  if (!companyName || companyName.trim().length < 2) throw new ServiceError("Company name is required (min 2 chars)");
  if (!legalName) throw new ServiceError("Legal name is required");
  if (!registrationNo) throw new ServiceError("Registration number is required");
  if (!companyEmail || !/^\S+@\S+\.\S+$/.test(companyEmail)) throw new ServiceError("Valid company email is required");
  if (!companyPhone || companyPhone.length < 8) throw new ServiceError("Valid company phone is required");
  if (gst && gst.length !== 15) throw new ServiceError("GST must be 15 characters");
  if (pan && pan.length !== 10) throw new ServiceError("PAN must be 10 characters");
  if (website && !/^https?:\/\/.+/.test(website)) throw new ServiceError("Website must be a valid URL");
  if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) throw new ServiceError("Invalid IFSC code");
  if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId)) throw new ServiceError("Invalid UPI ID");

  const numericFields = [
    { field: lateMarkAfter, name: "lateMarkAfter" },
    { field: autoHalfDayAfter, name: "autoHalfDayAfter" },
    { field: casualHolidaysTotal, name: "casualHolidaysTotal" },
    { field: casualHolidaysPerMonth, name: "casualHolidaysPerMonth" },
    { field: casualHolidayNotice, name: "casualHolidayNotice" },
    { field: compOffMinHours, name: "compOffMinHours" },
    { field: compOffExpiryDays, name: "compOffExpiryDays" },
    { field: casualCarryForwardLimit, name: "casualCarryForwardLimit" },
    { field: casualCarryForwardExpiry, name: "casualCarryForwardExpiry" },
  ];
  for (const item of numericFields) {
    if (item.field && isNaN(Number(item.field))) throw new ServiceError(`${item.name} must be a number`);
  }

  const company = await CompanyRepo.createCompany({
    companyName, legalName, registrationNo, gst, pan, industry, companySize,
    website, companyEmail, companyPhone, city, timezone, currency,
    bankAccountHolder, bankName, bankAccountNumber, bankIfsc, bankBranchName,
    bankAccountType, bankMicr, upiId, state, country, zipcode,
    payrollCycle, lateMarkAfter, autoHalfDayAfter,
    geoFencingRequired: geoFencingRequired !== undefined ? Boolean(geoFencingRequired) : true,
    officeLocationRequired: officeLocationRequired !== undefined ? Boolean(officeLocationRequired) : true,
    overtimeAllowed: overtimeAllowed !== undefined ? Boolean(overtimeAllowed) : false,
    companyWorkingDays: Array.isArray(companyWorkingDays) ? companyWorkingDays : null,
    altSaturday: altSaturday !== undefined ? Boolean(altSaturday) : false,
    casualHolidaysTotal, casualHolidaysPerMonth, casualHolidayNotice,
    compOffMinHours, compOffExpiryDays, casualCarryForwardLimit, casualCarryForwardExpiry,
    userId: createdBy || userId,
    adminId: adminId || null,
    managerId: managerId || null,
  });

  // When a company is linked to an admin, propagate the creator-user's permissions
  // to that admin scoped to this company. Company is optional — if no adminId, skip.
  if (adminId) {
    const creatorUserId = Number(userId);
    const newCompanyId = (company as any).id;

    const creatorPerms = await CompanyRepo.findCreatorPermissions(creatorUserId);

    if (creatorPerms.length > 0) {
      await Promise.all(
        creatorPerms.map((p: any) =>
          CompanyRepo.grantPermissionToAdminForCompany({
            adminId: Number(adminId),
            permissionId: p.permissionId,
            companyId: newCompanyId,
            grantedBy: creatorUserId,
          })
        )
      );
      invalidatePermissionCache(Number(adminId));
    }
  }

  return company;
};

export const getCompany = async (userId: number, query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = (query.search as string) || "";

  const { count, rows } = await CompanyRepo.findCompaniesPaginated({ userId, search, limit, offset });

  return {
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    data: rows,
  };
};

export const getCompanyById = async (id: string, userId: number, role?: string) => {
  if (!id) throw new ServiceError("Company id is required");
  if (isNaN(Number(id))) throw new ServiceError("Company id must be a number");

  // FIX: previously only matched Company.userId exactly — an admin,
  // manager, or super_admin (e.g. CompanyManagement.jsx, which is
  // super_admin-only) could never load a company by id at all, always
  // hitting "Company not found". hasCompanyAccess also covers the
  // CompanyAdmin/CompanyManager junctions and super_admin's universal access.
  const allowed = await hasCompanyAccess(Number(id), userId, role);
  if (!allowed) throw new ServiceError("Company not found");

  const company = await CompanyRepo.findCompanyByIdOnly(id);
  if (!company) throw new ServiceError("Company not found");
  return company;
};

export const updateCompany = async (id: string, userId: number, body: any, role?: string) => {
  if (!id) throw new ServiceError("Company id is required");
  if (isNaN(Number(id))) throw new ServiceError("Company id must be a number");

  const allowed = await hasCompanyAccess(Number(id), userId, role);
  if (!allowed) throw new ServiceError("Company not found");

  const company = await CompanyRepo.findCompanyByIdOnly(id);
  if (!company) throw new ServiceError("Company not found");

  return company.update(body);
};

export const assignCompanyManager = async (companyIdParam: string, userId: number, body: any) => {
  if (!companyIdParam) throw new ServiceError("Company id is required");
  if (isNaN(Number(companyIdParam))) throw new ServiceError("Company id must be a number");

  const { managerId } = body;
  if (!managerId) throw new ServiceError("managerId is required");
  if (isNaN(Number(managerId))) throw new ServiceError("managerId must be a number");

  const company = await CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
  if (!company) throw new ServiceError("Company not found");

  const manager = await CompanyRepo.findManagerById(Number(managerId));
  if (!manager) throw new ServiceError("Manager not found");

  const [record, created] = await CompanyRepo.findOrCreateCompanyManager(Number(companyIdParam), Number(managerId));

  return {
    message: created ? "Manager assigned to company" : "Manager already assigned to this company",
    record,
  };
};

export const removeCompanyManager = async (userId: number, body: any) => {
  const { companyId, managerId } = body;
  if (!companyId || !managerId) throw new ServiceError("companyId and managerId are required");

  const company = await CompanyRepo.findCompanyOwnedOrAdminBy(Number(companyId), userId);
  if (!company) throw new ServiceError("Company not found");

  const deleted = await CompanyRepo.destroyCompanyManager(Number(companyId), Number(managerId));
  if (!deleted) throw new ServiceError("Assignment not found");
};

export const getCompanyManagers = async (companyIdParam: string, userId: number) => {
  if (!companyIdParam) throw new ServiceError("Company id is required");

  const company = await CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
  if (!company) throw new ServiceError("Company not found");

  return CompanyRepo.findCompanyManagers(Number(companyIdParam));
};

export const getMyCompanies = async (userId: number, role: any) => {
  const assignments =
    role === "admin"
      ? await CompanyRepo.findAdminCompanyAssignments(userId)
      : await CompanyRepo.findManagerCompanyAssignments(userId);
  return assignments.map((a: any) => a.company);
};

export const switchCompany = async (userId: number, role: any, body: any) => {
  const { companyId } = body;
  if (!companyId) throw new ServiceError("companyId is required");
  if (isNaN(Number(companyId))) throw new ServiceError("companyId must be a number");

  if (role !== "admin" && role !== "manager") {
    throw new ServiceError("Only admin or manager accounts can switch companies");
  }

  const targetCompanyId = Number(companyId);
  const callerId = Number(userId);

  // Verify this admin/manager is actually assigned to the target company via junction table
  const assignment =
    role === "admin"
      ? await CompanyRepo.findAdminCompanyAssignment(targetCompanyId, callerId)
      : await CompanyRepo.findManagerCompanyAssignment(targetCompanyId, callerId);
  if (!assignment) throw new ServiceError("You are not assigned to this company");

  const company = (assignment as any).company;

  // Issue a new token scoped to the target company
  const { accessToken, refreshToken } = Middleware.CreateToken(String(callerId), role, targetCompanyId);

  await CompanyRepo.updateUserRefreshToken(callerId, refreshToken);

  return {
    accessToken,
    companyId: targetCompanyId,
    companyName: (company as any).companyName,
  };
};

export const assignCompanyAdmin = async (companyIdParam: string, userId: number, body: any) => {
  if (!companyIdParam) throw new ServiceError("Company id is required");
  if (isNaN(Number(companyIdParam))) throw new ServiceError("Company id must be a number");

  const { adminId } = body;
  if (!adminId) throw new ServiceError("adminId is required");
  if (isNaN(Number(adminId))) throw new ServiceError("adminId must be a number");

  const company = await CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
  if (!company) throw new ServiceError("Company not found");

  const admin = await CompanyRepo.findAdminById(Number(adminId));
  if (!admin) throw new ServiceError("Admin not found");

  const [record, created] = await CompanyRepo.findOrCreateCompanyAdmin(Number(companyIdParam), Number(adminId));

  return {
    message: created ? "Admin assigned to company" : "Admin already assigned to this company",
    record,
  };
};

export const removeCompanyAdmin = async (userId: number, body: any) => {
  const { companyId, adminId } = body;
  if (!companyId || !adminId) throw new ServiceError("companyId and adminId are required");

  const company = await CompanyRepo.findCompanyOwnedOrAdminBy(Number(companyId), userId);
  if (!company) throw new ServiceError("Company not found");

  const deleted = await CompanyRepo.destroyCompanyAdmin(Number(companyId), Number(adminId));
  if (!deleted) throw new ServiceError("Assignment not found");
};

export const getCompanyAdmins = async (companyIdParam: string, userId: number) => {
  if (!companyIdParam) throw new ServiceError("Company id is required");

  const company = await CompanyRepo.findCompanyOwnedOrAdminBy(companyIdParam, userId);
  if (!company) throw new ServiceError("Company not found");

  return CompanyRepo.findCompanyAdmins(Number(companyIdParam));
};

export const deleteCompany = async (id: string, userId: number) => {
  if (!id) throw new ServiceError("Company id is required");
  if (isNaN(Number(id))) throw new ServiceError("Company id must be a number");

  const company = await CompanyRepo.findCompanyOwnedBy(id, userId);
  if (!company) throw new ServiceError("Company not found");

  await company.destroy();
};

export const getOwnCompany = async (userId: number) => {
  const companies = await CompanyRepo.findCompaniesWithFullDetail(userId);
  if (!companies || companies.length === 0) throw new ServiceError("No company found for this user");
  return companies;
};

export const addCompanyBank = async (userId: number, body: any) => {
  const { companyId, banks } = body;

  if (!companyId) throw new ServiceError("companyId is required");
  if (!Array.isArray(banks) || banks.length === 0) throw new ServiceError("banks array is required");

  const bankData = banks.map((b: any) => ({
    companyId: Number(companyId),
    branchId: b.branchId ? Number(b.branchId) : null,
    userId: Number(userId),
    bankAccountHolder: b.bankAccountHolder,
    bankName: b.bankName,
    bankAccountNumber: b.bankAccountNumber,
    bankIfsc: b.bankIfsc,
    bankBranchName: b.bankBranchName || null,
    bankAccountType: b.bankAccountType || null,
    bankMicr: b.bankMicr || null,
    upiId: b.upiId || null,
  }));

  return CompanyRepo.bulkCreateCompanyBanks(bankData);
};
