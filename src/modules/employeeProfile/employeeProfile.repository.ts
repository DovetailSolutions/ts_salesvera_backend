import { Op, Transaction } from "sequelize";
import { User, EmployeeExtraDetails, EmployeeBankAccount } from "../../config/dbConnection";

// ============================================================
// Thin Sequelize wrappers — no business logic or authorization here, that
// lives in employeeProfile.service.ts. Same style as
// attendanceRegularization.repository.ts.
// ============================================================

export const findUserSafeById = (userId: number) =>
  (User as any).findByPk(userId, {
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "phone",
      "role",
      "status",
      "dob",
      "profile",
      "employeeCode",
      "businessCode",
      "branchId",
      "shiftId",
      "departmentId",
    ],
  });

// ── Extra details (1:1) ─────────────────────────────────────────────────
export const findExtraDetails = (userId: number) =>
  (EmployeeExtraDetails as any).findByPk(userId);

export const upsertExtraDetails = async (userId: number, fields: Record<string, any>) => {
  const existing = await (EmployeeExtraDetails as any).findByPk(userId);
  if (existing) {
    await existing.update(fields);
    return existing;
  }
  return (EmployeeExtraDetails as any).create({ userId, ...fields });
};

// ── Bank accounts (1:many) ──────────────────────────────────────────────
export const findBankAccountsForUser = (userId: number, includeInactive = false) =>
  (EmployeeBankAccount as any).findAll({
    where: includeInactive ? { userId } : { userId, status: "active" },
    order: [
      ["isPrimary", "DESC"],
      ["createdAt", "ASC"],
    ],
  });

export const findBankAccountById = (id: number, transaction?: Transaction) =>
  (EmployeeBankAccount as any).findByPk(id, { transaction });

export const findBankAccountByIdForUpdate = (id: number, transaction: Transaction) =>
  (EmployeeBankAccount as any).findByPk(id, { transaction, lock: Transaction.LOCK.UPDATE });

export const createBankAccount = (row: Record<string, any>, transaction?: Transaction) =>
  (EmployeeBankAccount as any).create(row, { transaction });

export const updateBankAccount = (id: number, fields: Record<string, any>, transaction?: Transaction) =>
  (EmployeeBankAccount as any).update(fields, { where: { id }, transaction });

// Unsets every OTHER active primary account for this user inside the given
// transaction — the caller is responsible for then setting the new one.
export const unsetOtherPrimaryAccounts = (userId: number, exceptId: number, transaction: Transaction) =>
  (EmployeeBankAccount as any).update(
    { isPrimary: false },
    { where: { userId, id: { [Op.ne]: exceptId } }, transaction }
  );
