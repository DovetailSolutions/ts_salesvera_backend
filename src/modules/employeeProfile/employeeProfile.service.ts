import { sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { userHasPermission } from "../../config/checkPermission";
import { getCompanyScopedChildUserIdsFast } from "../shared/userHierarchy";
import { encryptBankAccountNumber, decryptBankAccountNumber, last4 } from "../../config/bankAccountCrypto";
import * as Repo from "./employeeProfile.repository";

// ============================================================
// employee-profile / bank-account business logic.
//
// Ownership model (see plan): editing your OWN record needs no special
// permission (self-service — same as attendance-regularization's /my
// routes). Managing someone ELSE's record requires: caller role is
// admin/super_admin/manager, the target is within the caller's
// company-scoped team (getCompanyScopedChildUserIdsFast — the same helper
// getDashboardSummary/getTopPerformers use), AND the caller holds the
// relevant permission (employee-profile:view/update, bank-account:
// view/manage). sale_person has no downstream reports today, so in
// practice they only ever satisfy the self-service branch.
// ============================================================

const IN_SCOPE_ROLES = new Set(["admin", "super_admin", "manager", "sale_person"]);

interface Caller {
  callerId: number;
  callerRole: string | undefined;
  callerCompanyId: number | null;
}

const assertAccess = async (
  { callerId, callerRole, callerCompanyId }: Caller,
  targetUserId: number,
  permissionModule: "employee-profile" | "bank-account",
  permissionAction: string
): Promise<void> => {
  if (targetUserId === callerId) return; // self-service, always allowed

  if (!callerRole || !["admin", "super_admin", "manager"].includes(callerRole)) {
    throw new ServiceError("You do not have permission to access this employee's record.", 403);
  }

  const allowed = await userHasPermission(callerId, callerRole, permissionModule, permissionAction);
  if (!allowed) {
    throw new ServiceError("You do not have permission to access this employee's record.", 403);
  }

  const teamIds = await getCompanyScopedChildUserIdsFast(callerId, callerCompanyId);
  if (!teamIds.includes(targetUserId)) {
    throw new ServiceError("You can only manage employees within your own team.", 403);
  }
};

const assertTargetInScope = async (targetUserId: number): Promise<any> => {
  const target = await Repo.findUserSafeById(targetUserId);
  if (!target) throw new ServiceError("Employee not found.", 404);
  if (!IN_SCOPE_ROLES.has(target.role)) {
    throw new ServiceError("This feature is only available for admin, manager, and sale_person accounts.", 403);
  }
  return target;
};

const maskBankAccount = (row: any) => ({
  id: row.id,
  userId: row.userId,
  bankAccountHolder: row.bankAccountHolder,
  bankName: row.bankName,
  bankAccountNumberLast4: row.bankAccountNumberLast4,
  bankIfsc: row.bankIfsc,
  bankBranchName: row.bankBranchName,
  bankAccountType: row.bankAccountType,
  upiId: row.upiId,
  isPrimary: row.isPrimary,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// ── Extra details ────────────────────────────────────────────────────────

export const getProfile = async (caller: Caller, targetUserId: number) => {
  const target = await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "employee-profile", "view");

  const extraDetails = await Repo.findExtraDetails(targetUserId);
  const bankAccounts = await Repo.findBankAccountsForUser(targetUserId);

  return {
    user: target,
    extraDetails: extraDetails ?? null,
    bankAccounts: bankAccounts.map(maskBankAccount),
  };
};

// Fields a caller may set — deliberately an explicit allowlist so nothing
// this table doesn't own (role, businessCode, employeeCode, userId,
// companyId) can ever be written through this endpoint, no matter what the
// request body contains.
const EXTRA_DETAILS_FIELDS = [
  "countryCode", "personalEmail", "officialEmail", "dateOfJoining",
  "employeeIdExternal", "jobTitle", "employeeType", "currentAddress",
  "permanentAddress", "gender", "maritalStatus", "bloodGroup",
  "pfAccountNumber", "esiAccountNumber", "uan", "aadhaarNumber", "panNumber",
  "guardianName", "emergencyContactName", "emergencyContactCountryCode",
  "emergencyContactPhone", "emergencyContactRelationship",
  "emergencyContactAddress", "educationalQualification", "incrementAmount",
  "grade", "maintenanceFee", "laptopSerialNumber", "mobileSerialNumber",
  "houseNumber", "lockerNumber", "staff", "stationary", "worker", "laptops",
  "juniorManager", "upiDetails", "contractVendorName", "businessUnit",
  "assets", "simOperatorName", "registrationNumber",
] as const;

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
const AADHAAR_REGEX = /^\d{12}$/;

const validateExtraDetails = (body: Record<string, any>) => {
  if (body.panNumber && !PAN_REGEX.test(String(body.panNumber).trim())) {
    throw new ServiceError("Invalid PAN number format.");
  }
  if (body.aadhaarNumber && !AADHAAR_REGEX.test(String(body.aadhaarNumber).replace(/\s/g, ""))) {
    throw new ServiceError("Aadhaar number must be exactly 12 digits.");
  }
  if (body.incrementAmount != null && isNaN(Number(body.incrementAmount))) {
    throw new ServiceError("Increment amount must be a number.");
  }
  if (body.maintenanceFee != null && isNaN(Number(body.maintenanceFee))) {
    throw new ServiceError("Maintenance fee must be a number.");
  }
  if (body.dateOfJoining && isNaN(Date.parse(body.dateOfJoining))) {
    throw new ServiceError("Date of joining is not a valid date.");
  }
};

export const updateProfile = async (caller: Caller, targetUserId: number, body: Record<string, any>) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "employee-profile", "update");
  validateExtraDetails(body);

  const fields: Record<string, any> = { companyId: caller.callerCompanyId, updatedBy: caller.callerId };
  for (const key of EXTRA_DETAILS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) fields[key] = body[key];
  }
  if (!(await Repo.findExtraDetails(targetUserId))) fields.createdBy = caller.callerId;

  return Repo.upsertExtraDetails(targetUserId, fields);
};

// ── Bank accounts ────────────────────────────────────────────────────────

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

const validateBankAccount = (body: Record<string, any>, { partial = false } = {}) => {
  const required = (key: string) => {
    if (!partial && !body[key]) throw new ServiceError(`${key} is required.`);
  };
  required("bankAccountHolder");
  required("bankName");
  required("bankIfsc");
  if (!partial) required("accountNumber");

  if (body.bankIfsc && !IFSC_REGEX.test(String(body.bankIfsc).trim())) {
    throw new ServiceError("Invalid IFSC code format.");
  }
  if (body.accountNumber != null && String(body.accountNumber).replace(/\s/g, "").length < 4) {
    throw new ServiceError("Account number is too short.");
  }
};

export const listBankAccounts = async (caller: Caller, targetUserId: number) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "bank-account", "view");
  const rows = await Repo.findBankAccountsForUser(targetUserId);
  return rows.map(maskBankAccount);
};

export const addBankAccount = async (caller: Caller, targetUserId: number, body: Record<string, any>) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "bank-account", "manage");
  validateBankAccount(body);

  const accountNumber = String(body.accountNumber).replace(/\s/g, "");
  const existing = await Repo.findBankAccountsForUser(targetUserId);
  // First account for this user is automatically primary regardless of what
  // the caller passed — a user should never end up with bank accounts but
  // no primary one.
  const makePrimary = existing.length === 0 || Boolean(body.isPrimary);

  return sequelize.transaction(async (t) => {
    const created = await Repo.createBankAccount({
      userId: targetUserId,
      companyId: caller.callerCompanyId,
      bankAccountHolder: String(body.bankAccountHolder).trim(),
      bankName: String(body.bankName).trim(),
      bankAccountNumberEncrypted: encryptBankAccountNumber(accountNumber),
      bankAccountNumberLast4: last4(accountNumber),
      bankIfsc: String(body.bankIfsc).trim().toUpperCase(),
      bankBranchName: body.bankBranchName ?? null,
      bankAccountType: body.bankAccountType ?? null,
      upiId: body.upiId ?? null,
      isPrimary: makePrimary,
      status: "active",
      createdBy: caller.callerId,
    }, t);

    if (makePrimary) {
      await Repo.unsetOtherPrimaryAccounts(targetUserId, created.id, t);
    }

    return maskBankAccount(created);
  });
};

const loadOwnedBankAccount = async (targetUserId: number, bankAccountId: number) => {
  const row = await Repo.findBankAccountById(bankAccountId);
  if (!row || row.userId !== targetUserId) {
    throw new ServiceError("Bank account not found.", 404);
  }
  return row;
};

export const updateBankAccountDetails = async (
  caller: Caller,
  targetUserId: number,
  bankAccountId: number,
  body: Record<string, any>
) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "bank-account", "manage");
  await loadOwnedBankAccount(targetUserId, bankAccountId);
  validateBankAccount(body, { partial: true });

  const fields: Record<string, any> = { updatedBy: caller.callerId };
  if (body.bankAccountHolder != null) fields.bankAccountHolder = String(body.bankAccountHolder).trim();
  if (body.bankName != null) fields.bankName = String(body.bankName).trim();
  if (body.bankIfsc != null) fields.bankIfsc = String(body.bankIfsc).trim().toUpperCase();
  if (body.bankBranchName !== undefined) fields.bankBranchName = body.bankBranchName;
  if (body.bankAccountType !== undefined) fields.bankAccountType = body.bankAccountType;
  if (body.upiId !== undefined) fields.upiId = body.upiId;
  if (body.accountNumber != null) {
    const accountNumber = String(body.accountNumber).replace(/\s/g, "");
    fields.bankAccountNumberEncrypted = encryptBankAccountNumber(accountNumber);
    fields.bankAccountNumberLast4 = last4(accountNumber);
  }

  await Repo.updateBankAccount(bankAccountId, fields);
  return maskBankAccount(await Repo.findBankAccountById(bankAccountId));
};

export const deleteBankAccount = async (caller: Caller, targetUserId: number, bankAccountId: number) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "bank-account", "manage");
  await loadOwnedBankAccount(targetUserId, bankAccountId);

  // Soft delete — deliberately does NOT auto-promote another account to
  // primary. Leaving zero primary accounts is safer than silently guessing
  // which one should replace it; the caller/admin picks explicitly via
  // set-primary.
  await Repo.updateBankAccount(bankAccountId, { status: "inactive", isPrimary: false, updatedBy: caller.callerId });
  return { id: bankAccountId, status: "inactive" };
};

export const setPrimaryBankAccount = async (caller: Caller, targetUserId: number, bankAccountId: number) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "bank-account", "manage");

  return sequelize.transaction(async (t) => {
    const row = await Repo.findBankAccountByIdForUpdate(bankAccountId, t);
    if (!row || row.userId !== targetUserId) {
      throw new ServiceError("Bank account not found.", 404);
    }
    if (row.status !== "active") {
      throw new ServiceError("Cannot make an inactive bank account primary.");
    }

    await Repo.unsetOtherPrimaryAccounts(targetUserId, bankAccountId, t);
    await Repo.updateBankAccount(bankAccountId, { isPrimary: true, updatedBy: caller.callerId }, t);
    return maskBankAccount(await Repo.findBankAccountById(bankAccountId, t));
  });
};

// Separate, more tightly-scoped from the normal list/get path — the only
// place a full, decrypted account number ever leaves the server. Access is
// logged (masked) rather than silently returned, matching this codebase's
// existing console-logging conventions (no dedicated audit-log table for
// this feature).
export const revealBankAccount = async (caller: Caller, targetUserId: number, bankAccountId: number) => {
  await assertTargetInScope(targetUserId);
  await assertAccess(caller, targetUserId, "bank-account", "manage");
  const row = await loadOwnedBankAccount(targetUserId, bankAccountId);

  const accountNumber = decryptBankAccountNumber(row.bankAccountNumberEncrypted);
  console.log(
    `[bank-account:reveal] caller=${caller.callerId} target=${targetUserId} bankAccountId=${bankAccountId} ` +
      `accountNumberMasked=****${row.bankAccountNumberLast4}`
  );
  return { id: row.id, accountNumber };
};
