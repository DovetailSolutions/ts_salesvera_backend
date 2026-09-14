import { ServiceError } from "../shared/serviceError";
import * as Middleware from "../../app/middlewear/comman";
import { invalidatePermissionCache } from "../../config/permissionCache";
import { hasCompanyAccess } from "../shared/companyAccess";
import { getISTDateString } from "../shared/dateUtils";
import { getCompanyScopedChildUserIdsFast } from "../shared/userHierarchy";
import * as CompanyRepo from "./company.repository";
import * as SetupTracking from "../setupTracking/setupTracking.service";

// ============================================================
// Company service — validation + orchestration. Byte-for-byte port of the
// previous addCompany/getCompany/getCompanyById/updateCompany/
// assignCompanyManager/removeCompanyManager/getCompanyManagers/
// getMyCompanies/switchCompany/deleteCompany/getOwnCompany/addCompanyBank
// controller bodies in admin.ts.
// ============================================================

export const addCompany = async (userId: number, role: any, body: any) => {
  if (!["admin", "super_admin", "user"].includes(role)) {
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
    // Branding Images & Travel Rate
    companyProfileImg, companyStampImg, companySignatureImg, vehicleAllowanceRatePerKm,
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

  const targetUserId = createdBy || (role === "user" ? userId : (body.userId || null));
  const targetAdminId = adminId || (role === "admin" ? userId : null);

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
    userId: targetUserId,
    adminId: targetAdminId,
    managerId: managerId || null,
    companyProfileImg: companyProfileImg || null,
    companyStampImg: companyStampImg || null,
    companySignatureImg: companySignatureImg || null,
    vehicleAllowanceRatePerKm: vehicleAllowanceRatePerKm !== undefined ? vehicleAllowanceRatePerKm : null,
  });

  // When a company is linked to an admin, propagate the creator-user's permissions
  // to that admin scoped to this company. Company is optional — if no adminId, skip.
  if (targetAdminId && role === "user") {
    const creatorUserId = Number(userId);
    const newCompanyId = (company as any).id;

    const creatorPerms = await CompanyRepo.findCreatorPermissions(creatorUserId);

    if (creatorPerms.length > 0) {
      await Promise.all(
        creatorPerms.map((p: any) =>
          CompanyRepo.grantPermissionToAdminForCompany({
            adminId: Number(targetAdminId),
            permissionId: p.permissionId,
            companyId: newCompanyId,
            grantedBy: creatorUserId,
          })
        )
      );
      invalidatePermissionCache(Number(targetAdminId));
    }
  }

  // Setup Tracking: best-effort audit trail — never block company creation.
  try {
    await SetupTracking.recordCompanyCreated({
      companyId: (company as any).id,
      companyName: (company as any).companyName,
      tenantUserId: targetUserId ?? null,
      actorId: Number(userId),
      actorRole: role ?? null,
    });
  } catch (e) {
    console.error("setupTracking.recordCompanyCreated failed:", e);
  }

  return company;
};

export const getCompany = async (userId: number, query: any, role?: string) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = (query.search as string) || "";

  const { count, rows } = await CompanyRepo.findCompaniesPaginated({ userId, role, search, limit, offset });

  return {
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit) || 1,
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

// Read-only attendance/leave policy bundle — the Settings module's Company
// Policy tab (manager: view the rules that apply to their team; admin/user
// already get the full editable versions of this same data via the other
// Settings tabs, so this endpoint exists specifically to give manager a
// legitimate, non-ADMIN_ONLY way to see it). Resolves companyId from the
// caller's own JWT context rather than taking one as a param — nobody
// calling this should ever need to look up a DIFFERENT company's policy.
export const getCompanyPolicy = async (userId: number, role: string | undefined, callerCompanyId: number | null) => {
  if (!callerCompanyId) throw new ServiceError("No company context — cannot resolve your company's policy");

  const allowed = await hasCompanyAccess(callerCompanyId, userId, role);
  if (!allowed) throw new ServiceError("You do not have access to this company", 403);

  const company = await CompanyRepo.findCompanyPolicyFields(callerCompanyId);
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

  const payload = { ...body };
  if (typeof payload.companyWorkingDays === "string") {
    try { payload.companyWorkingDays = JSON.parse(payload.companyWorkingDays); } catch {}
  }
  const numericFields = [
    "lateMarkAfter", "autoHalfDayAfter", "casualHolidaysTotal", "casualHolidaysPerMonth",
    "casualHolidayNotice", "casualCarryForwardLimit", "casualCarryForwardExpiry",
    "compOffMinHours", "compOffExpiryDays", "vehicleAllowanceRatePerKm"
  ];
  numericFields.forEach((f) => {
    if (payload[f] !== undefined && payload[f] !== null && payload[f] !== "") {
      const n = Number(payload[f]);
      if (!isNaN(n)) payload[f] = n;
    }
  });
  const boolFields = [
    "geoFencingRequired", "officeLocationRequired", "overtimeAllowed",
    "altSaturday", "halfSaturday", "casualHolidayApprovalRequired",
    "casualHolidayCarryForward", "compOffApprovalRequired"
  ];
  boolFields.forEach((f) => {
    if (payload[f] !== undefined && payload[f] !== null) {
      if (payload[f] === "true" || payload[f] === true) payload[f] = true;
      else if (payload[f] === "false" || payload[f] === false) payload[f] = false;
    }
  });

  await company.update(payload);
  return company.reload();
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
  if (role === "admin") {
    // FIX: the CompanyAdmin junction only holds companies an admin was
    // explicitly ASSIGNED to — it has no row for the company an admin
    // created and owns outright (Company.userId/adminId, stamped directly
    // at creation), so an owning admin with no extra assignments got an
    // empty array here even though getowncompany/profile correctly showed
    // their company. Merge both sources, deduped by company id, same
    // response shape (array of company objects) as before.
    const [assignments, owned] = await Promise.all([
      CompanyRepo.findAdminCompanyAssignments(userId),
      CompanyRepo.findOwnedCompaniesByAdminId(userId),
    ]);
    const companies = [...assignments.map((a: any) => a.company), ...owned];
    const seen = new Set<number>();
    return companies.filter((c: any) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }

  // A "user" (tenant root) owns companies directly via Company.userId — no
  // junction table involved, unlike admin (CompanyAdmin) or manager
  // (CompanyManager).
  if (role === "user") {
    return CompanyRepo.findOwnedCompaniesByUserId(userId);
  }

  const assignments = await CompanyRepo.findManagerCompanyAssignments(userId);
  return assignments.map((a: any) => a.company);
};

export const switchCompany = async (userId: number, role: any, body: any) => {
  const { companyId } = body;
  if (!companyId) throw new ServiceError("companyId is required");
  if (isNaN(Number(companyId))) throw new ServiceError("companyId must be a number");

  if (role !== "admin" && role !== "manager" && role !== "user") {
    throw new ServiceError("Only admin, manager, or owner accounts can switch companies");
  }

  const targetCompanyId = Number(companyId);
  const callerId = Number(userId);

  let company: any;
  if (role === "user") {
    // Ownership check, not junction membership — a "user" is a tenant root,
    // never a CompanyAdmin/CompanyManager assignee of their own company.
    company = await CompanyRepo.findCompanyOwnedBy(targetCompanyId, callerId);
    if (!company) throw new ServiceError("You do not own this company", 403);
  } else {
    // Verify this admin/manager is actually assigned to the target company via junction table
    const assignment =
      role === "admin"
        ? await CompanyRepo.findAdminCompanyAssignment(targetCompanyId, callerId)
        : await CompanyRepo.findManagerCompanyAssignment(targetCompanyId, callerId);
    if (!assignment) throw new ServiceError("You are not assigned to this company");
    company = (assignment as any).company;
  }

  // Issue a new token scoped to the target company
  const { accessToken, refreshToken } = Middleware.CreateToken(String(callerId), role, targetCompanyId);

  await CompanyRepo.updateUserRefreshToken(callerId, refreshToken);
  // See updateLastLoginCompanyId's doc comment — this is what lets a
  // subsequent /admin/refreshtoken call (now happening far more often,
  // with short-lived access tokens) restore the company the user actually
  // switched to, instead of reverting to a default.
  await CompanyRepo.updateLastLoginCompanyId(callerId, targetCompanyId);

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

export const deleteCompany = async (id: string, userId: number, role?: string) => {
  if (!id) throw new ServiceError("Company id is required");
  if (isNaN(Number(id))) throw new ServiceError("Company id must be a number");

  const company = await CompanyRepo.findCompanyOwnedBy(id, userId);
  if (!company) throw new ServiceError("Company not found");

  // FIX: this used to destroy the company unconditionally. Block instead,
  // with a clear message, until the company is actually empty — see
  // countCompanyDependents' comment for why this matters.
  const { branchCount, shiftCount, departmentCount } = await CompanyRepo.countCompanyDependents(Number(id));
  if (branchCount > 0 || shiftCount > 0 || departmentCount > 0) {
    throw new ServiceError(
      `Cannot delete this company while it still has ${branchCount} branch(es), ${shiftCount} shift(s), and ${departmentCount} department(s). Remove those first.`
    );
  }

  await company.destroy();
};

export const getOwnCompany = async (userId: number) => {
  const companies = await CompanyRepo.findCompaniesWithFullDetail(userId);
  if (!companies || companies.length === 0) throw new ServiceError("No company found for this user");
  return companies;
};

export const addCompanyBank = async (userId: number, body: any, fallbackCompanyId?: number) => {
  const companyId = body.companyId || fallbackCompanyId;
  if (!companyId) throw new ServiceError("companyId is required");

  let banksList: any[] = [];
  if (Array.isArray(body.banks)) {
    banksList = body.banks;
  } else if (body.bankAccountHolder || body.bankAccountNumber || body.bankName) {
    banksList = [body];
  } else if (body.banks && typeof body.banks === "object") {
    banksList = [body.banks];
  }

  if (banksList.length === 0) {
    throw new ServiceError("At least one bank account is required");
  }

  for (const b of banksList) {
    if (!b.bankAccountHolder || !String(b.bankAccountHolder).trim()) {
      throw new ServiceError("Bank account holder name is required");
    }
    if (!b.bankName || !String(b.bankName).trim()) {
      throw new ServiceError("Bank name is required");
    }
    if (!b.bankAccountNumber || !String(b.bankAccountNumber).trim()) {
      throw new ServiceError("Bank account number is required");
    }
    if (!b.bankIfsc || !String(b.bankIfsc).trim()) {
      throw new ServiceError("Bank IFSC code is required");
    }
  }

  const bankData = banksList.map((b: any) => ({
    companyId: Number(companyId),
    branchId: b.branchId ? Number(b.branchId) : null,
    userId: Number(userId),
    bankAccountHolder: String(b.bankAccountHolder).trim(),
    bankName: String(b.bankName).trim(),
    bankAccountNumber: String(b.bankAccountNumber).trim(),
    bankIfsc: String(b.bankIfsc).trim().toUpperCase(),
    bankBranchName: b.bankBranchName ? String(b.bankBranchName).trim() : null,
    bankAccountType: b.bankAccountType ? String(b.bankAccountType).trim() : null,
    bankMicr: b.bankMicr ? String(b.bankMicr).trim() : null,
    upiId: b.upiId ? String(b.upiId).trim() : null,
  }));

  if (bankData.length === 1) {
    return CompanyRepo.createCompanyBank(bankData[0]);
  }
  return CompanyRepo.bulkCreateCompanyBanks(bankData);
};

export const getCompanyBanks = async (companyId: number) => {
  if (!companyId) throw new ServiceError("companyId is required");
  return CompanyRepo.findCompanyBanks(Number(companyId));
};

export const getCompanyBankById = async (id: number, userCompanyId?: number, role?: string) => {
  if (!id) throw new ServiceError("Bank ID is required");
  const bank = await CompanyRepo.findCompanyBankById(Number(id));
  if (!bank) throw new ServiceError("Bank account not found");
  if (role !== "super_admin" && userCompanyId && bank.companyId !== Number(userCompanyId)) {
    throw new ServiceError("You do not have access to this bank account");
  }
  return bank;
};

export const updateCompanyBank = async (id: number, body: any, userCompanyId?: number, role?: string) => {
  if (!id) throw new ServiceError("Bank ID is required");
  const bank = await CompanyRepo.findCompanyBankById(Number(id));
  if (!bank) throw new ServiceError("Bank account not found");

  if (role !== "super_admin" && userCompanyId && bank.companyId !== Number(userCompanyId)) {
    throw new ServiceError("You are not authorized to update this bank account");
  }

  const updateFields: any = {};
  if (body.bankAccountHolder !== undefined) {
    if (!body.bankAccountHolder || !String(body.bankAccountHolder).trim()) {
      throw new ServiceError("Bank account holder name is required");
    }
    updateFields.bankAccountHolder = String(body.bankAccountHolder).trim();
  }
  if (body.bankName !== undefined) {
    if (!body.bankName || !String(body.bankName).trim()) {
      throw new ServiceError("Bank name is required");
    }
    updateFields.bankName = String(body.bankName).trim();
  }
  if (body.bankAccountNumber !== undefined) {
    if (!body.bankAccountNumber || !String(body.bankAccountNumber).trim()) {
      throw new ServiceError("Bank account number is required");
    }
    updateFields.bankAccountNumber = String(body.bankAccountNumber).trim();
  }
  if (body.bankIfsc !== undefined) {
    if (!body.bankIfsc || !String(body.bankIfsc).trim()) {
      throw new ServiceError("Bank IFSC code is required");
    }
    updateFields.bankIfsc = String(body.bankIfsc).trim().toUpperCase();
  }
  if (body.bankBranchName !== undefined) {
    updateFields.bankBranchName = body.bankBranchName ? String(body.bankBranchName).trim() : null;
  }
  if (body.bankAccountType !== undefined) {
    updateFields.bankAccountType = body.bankAccountType ? String(body.bankAccountType).trim() : null;
  }
  if (body.bankMicr !== undefined) {
    updateFields.bankMicr = body.bankMicr ? String(body.bankMicr).trim() : null;
  }
  if (body.upiId !== undefined) {
    updateFields.upiId = body.upiId ? String(body.upiId).trim() : null;
  }
  if (body.branchId !== undefined) {
    updateFields.branchId = body.branchId ? Number(body.branchId) : null;
  }

  await CompanyRepo.updateCompanyBank(Number(id), updateFields);
  return CompanyRepo.findCompanyBankById(Number(id));
};

export const deleteCompanyBank = async (id: number, userCompanyId?: number, role?: string) => {
  if (!id) throw new ServiceError("Bank ID is required");
  const bank = await CompanyRepo.findCompanyBankById(Number(id));
  if (!bank) throw new ServiceError("Bank account not found");

  if (role !== "super_admin" && userCompanyId && bank.companyId !== Number(userCompanyId)) {
    throw new ServiceError("You are not authorized to delete this bank account");
  }

  await CompanyRepo.deleteCompanyBank(Number(id));
  return { success: true, id: Number(id) };
};

// ============================================================
// Vehicle Allowance Rate — effective-dated history (migration 0023).
//
// Company.vehicleAllowanceRatePerKm alone can't answer "what rate applied
// on this specific past travel date" once it's been changed more than
// once — this is the fix. It stays company-scoped (never per-vehicle-type,
// never per-staff-member — the database has no such concepts) and reuses
// the exact same hasCompanyAccess() ownership check and callerCompanyId
// resolution getCompanyPolicy/updateCompany already use above, so
// authorization/company-isolation behaves identically to every other
// Company settings endpoint.
// ============================================================

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toPublicRate = (row: any) => {
  const plain = row.get ? row.get({ plain: true }) : row;
  return { id: plain.id, ratePerKm: plain.ratePerKm, effectiveFrom: plain.effectiveFrom, createdBy: plain.createdBy };
};

// The single reusable lookup every payout calculation should go through —
// never Company.vehicleAllowanceRatePerKm directly — so a historical travel
// date always resolves to the rate that was actually in force on it.
//
// When a userId is given, that user's own override (user_vehicle_allowance_rates
// — a simple current value, not effective-dated, see migration 0024) always
// wins over the company-wide history, including a deliberately-set ₹0.
// Falls back to Company.vehicleAllowanceRatePerKm (then 10) only when
// neither a user override nor any company history row exists yet.
export const findEffectiveVehicleAllowanceRateForDate = async (
  companyId: number,
  onOrBeforeDate: string,
  userId?: number | null
): Promise<number> => {
  if (userId != null) {
    const userOverride = await CompanyRepo.findUserVehicleAllowanceRate(userId);
    if (userOverride) return Number((userOverride as any).ratePerKm);
  }

  const row = await CompanyRepo.findEffectiveVehicleAllowanceRate(companyId, onOrBeforeDate);
  if (row) return Number((row as any).ratePerKm);

  const company = await CompanyRepo.findCompanyByIdOnly(String(companyId));
  return (company as any)?.vehicleAllowanceRatePerKm ?? 10;
};

// Recomputes "the rate effective right now" from history and keeps
// Company.vehicleAllowanceRatePerKm in sync with it — so any existing code
// that still reads that column directly (e.g. as a last-resort fallback
// above) sees the current rate, never a future-scheduled one that hasn't
// taken effect yet.
const syncCurrentRateOntoCompany = async (companyId: number) => {
  const effectiveRow = await CompanyRepo.findEffectiveVehicleAllowanceRate(companyId, getISTDateString());
  if (!effectiveRow) return;
  const company = await CompanyRepo.findCompanyByIdOnly(String(companyId));
  if (company) {
    (company as any).vehicleAllowanceRatePerKm = Number((effectiveRow as any).ratePerKm);
    await (company as any).save();
  }
};

export const getVehicleAllowanceRateInfo = async (
  userId: number,
  role: string | undefined,
  callerCompanyId: number | null
) => {
  if (!callerCompanyId) throw new ServiceError("No company context — cannot resolve your company's vehicle allowance rate");

  const allowed = await hasCompanyAccess(callerCompanyId, userId, role);
  if (!allowed) throw new ServiceError("You do not have access to this company", 403);

  const today = getISTDateString();
  const [currentRow, scheduledRow, historyRows] = await Promise.all([
    CompanyRepo.findEffectiveVehicleAllowanceRate(callerCompanyId, today),
    CompanyRepo.findNextScheduledVehicleAllowanceRate(callerCompanyId, today),
    CompanyRepo.findVehicleAllowanceRateHistory(callerCompanyId),
  ]);

  return {
    currentRate: currentRow ? toPublicRate(currentRow) : null,
    scheduledRate: scheduledRow ? toPublicRate(scheduledRow) : null,
    history: historyRows.map(toPublicRate),
  };
};

export const addVehicleAllowanceRate = async (
  userId: number,
  role: string | undefined,
  callerCompanyId: number | null,
  body: any
) => {
  if (!callerCompanyId) throw new ServiceError("No company context — cannot set a vehicle allowance rate");

  const allowed = await hasCompanyAccess(callerCompanyId, userId, role);
  if (!allowed) throw new ServiceError("You do not have access to this company", 403);

  const rateNum = Number(body?.ratePerKm);
  if (body?.ratePerKm === undefined || body?.ratePerKm === null || body?.ratePerKm === "") {
    throw new ServiceError("ratePerKm is required");
  }
  if (!Number.isFinite(rateNum) || rateNum < 0) {
    throw new ServiceError("ratePerKm must be a valid number of 0 or more");
  }

  const effectiveFrom = String(body?.effectiveFrom || "").trim() || getISTDateString();
  if (!DATE_ONLY.test(effectiveFrom) || Number.isNaN(new Date(`${effectiveFrom}T00:00:00`).getTime())) {
    throw new ServiceError("effectiveFrom must be a valid date (YYYY-MM-DD)");
  }

  const saved = await CompanyRepo.upsertVehicleAllowanceRate({
    companyId: callerCompanyId,
    ratePerKm: rateNum,
    effectiveFrom,
    createdBy: userId,
  });

  // Only actually changes anything when this rate is now (or already) in
  // effect — a future-dated rate leaves Company.vehicleAllowanceRatePerKm
  // pointing at whatever is genuinely effective today.
  await syncCurrentRateOntoCompany(callerCompanyId);

  return getVehicleAllowanceRateInfo(userId, role, callerCompanyId).then((info) => ({
    saved: toPublicRate(saved),
    ...info,
  }));
};

// ============================================================
// Per-user Vehicle Allowance Rate override (migration 0024) — a simple
// current-value override per staff member, not effective-dated. Presence
// of a row is the override; 0 is a valid, deliberate value (e.g. a user
// who gets no travel allowance at all). Editing is admin-only, same as the
// company-wide rate; viewing reuses the same ADMIN_AND_MANAGER route gate.
//
// Authorization mirrors assertCanAct's admin/manager branch elsewhere
// (geoFencing.service.ts, attendanceRegularization.service.ts): the target
// user must be inside the caller's own company-scoped hierarchy — never
// just "any user whose id was supplied."
// ============================================================

const toPublicUserRate = (row: any) => {
  const plain = row.get ? row.get({ plain: true }) : row;
  return { userId: plain.userId, ratePerKm: plain.ratePerKm };
};

const assertTargetUserInCallerOrg = async (callerId: number, role: string | undefined, callerCompanyId: number | null, targetUserId: number) => {
  if (role === "super_admin") return;
  const orgIds = await getCompanyScopedChildUserIdsFast(callerId, callerCompanyId);
  if (!orgIds.includes(targetUserId)) {
    throw new ServiceError("This user is not on your team, or belongs to another company", 403);
  }
};

// All per-user overrides for the caller's company, keyed by userId — the
// settings page merges this with its own staff list in one extra call
// instead of one request per staff member.
export const getUserVehicleAllowanceOverrides = async (
  userId: number,
  role: string | undefined,
  callerCompanyId: number | null
) => {
  if (!callerCompanyId) return [];
  const allowed = await hasCompanyAccess(callerCompanyId, userId, role);
  if (!allowed) throw new ServiceError("You do not have access to this company", 403);

  const rows = await CompanyRepo.findUserVehicleAllowanceRatesByCompany(callerCompanyId);
  return rows.map(toPublicUserRate);
};

export const setUserVehicleAllowanceRate = async (
  callerId: number,
  role: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number,
  body: any
) => {
  if (!targetUserId || Number.isNaN(targetUserId)) throw new ServiceError("A valid userId is required");
  if (!callerCompanyId) throw new ServiceError("No company context — cannot set a vehicle allowance rate");

  await assertTargetUserInCallerOrg(callerId, role, callerCompanyId, targetUserId);

  if (body?.ratePerKm === undefined || body?.ratePerKm === null || body?.ratePerKm === "") {
    throw new ServiceError("ratePerKm is required");
  }
  const rateNum = Number(body.ratePerKm);
  if (!Number.isFinite(rateNum) || rateNum < 0) {
    throw new ServiceError("ratePerKm must be a valid number of 0 or more");
  }

  const saved = await CompanyRepo.upsertUserVehicleAllowanceRate({
    userId: targetUserId,
    companyId: callerCompanyId,
    ratePerKm: rateNum,
    createdBy: callerId,
  });

  return toPublicUserRate(saved);
};

export const clearUserVehicleAllowanceRate = async (
  callerId: number,
  role: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number
) => {
  if (!targetUserId || Number.isNaN(targetUserId)) throw new ServiceError("A valid userId is required");
  await assertTargetUserInCallerOrg(callerId, role, callerCompanyId, targetUserId);

  await CompanyRepo.deleteUserVehicleAllowanceRate(targetUserId);
  return { userId: targetUserId, cleared: true };
};
