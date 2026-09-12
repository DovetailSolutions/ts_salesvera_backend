import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// employee_bank_accounts — one-to-many: a user (admin/manager/sale_person)
// may have several bank accounts, at most one marked primary. Deliberately
// a SEPARATE table from CompanyBank/company_banks (app/model/bank.ts) —
// that table is a company-owned bank account (keyed by companyId, `userId`
// there just records who added it), not a specific employee's own personal
// account. Reusing it would conflate the two concepts and collide with its
// already-taken /admin/get-bank, /admin/update-bank, /admin/delete-bank
// routes (see modules/company).
//
// bankAccountNumberEncrypted stores "iv.authTag.ciphertext" (each base64,
// dot-separated) via config/bankAccountCrypto.ts's AES-256-GCM helpers — the
// only reversible copy of the account number. bankAccountNumberLast4 is
// derived once at write time purely for display, so masked responses never
// need to touch the encrypted value at all. bankIfsc is a public bank/
// branch code (not a secret), stored and returned in plain text.
//
// The partial unique index below enforces "at most one PRIMARY, ACTIVE
// account per user" at the database level — the service layer additionally
// wraps set-primary in a transaction (unset old -> set new) as defense in
// depth, but this index is what actually prevents two concurrent requests
// from both landing a primary account.
// ============================================================

export type EmployeeBankAccountStatus = "active" | "inactive";

export interface EmployeeBankAccountAttributes {
  id: number;
  userId: number;
  companyId: number | null;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumberEncrypted: string;
  bankAccountNumberLast4: string;
  bankIfsc: string;
  bankBranchName: string | null;
  bankAccountType: string | null;
  upiId: string | null;
  isPrimary: boolean;
  status: EmployeeBankAccountStatus;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type EmployeeBankAccountCreationAttributes = Optional<
  EmployeeBankAccountAttributes,
  | "id"
  | "companyId"
  | "bankBranchName"
  | "bankAccountType"
  | "upiId"
  | "isPrimary"
  | "status"
  | "createdBy"
  | "updatedBy"
>;

export class EmployeeBankAccount
  extends Model<EmployeeBankAccountAttributes, EmployeeBankAccountCreationAttributes>
  implements EmployeeBankAccountAttributes
{
  public id!: number;
  public userId!: number;
  public companyId!: number | null;
  public bankAccountHolder!: string;
  public bankName!: string;
  public bankAccountNumberEncrypted!: string;
  public bankAccountNumberLast4!: string;
  public bankIfsc!: string;
  public bankBranchName!: string | null;
  public bankAccountType!: string | null;
  public upiId!: string | null;
  public isPrimary!: boolean;
  public status!: EmployeeBankAccountStatus;
  public createdBy!: number | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof EmployeeBankAccount {
    EmployeeBankAccount.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: true },
        bankAccountHolder: { type: DataTypes.STRING, allowNull: false },
        bankName: { type: DataTypes.STRING, allowNull: false },
        bankAccountNumberEncrypted: { type: DataTypes.TEXT, allowNull: false },
        bankAccountNumberLast4: { type: DataTypes.STRING(4), allowNull: false },
        bankIfsc: { type: DataTypes.STRING(11), allowNull: false },
        bankBranchName: { type: DataTypes.STRING, allowNull: true },
        bankAccountType: { type: DataTypes.STRING, allowNull: true },
        upiId: { type: DataTypes.STRING, allowNull: true },
        isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
      },
      {
        sequelize,
        tableName: "employee_bank_accounts",
        timestamps: true,
        indexes: [
          { fields: ["userId"], name: "idx_employee_bank_accounts_user" },
          { fields: ["companyId"], name: "idx_employee_bank_accounts_company" },
          { fields: ["status"], name: "idx_employee_bank_accounts_status" },
        ],
      }
    );

    return EmployeeBankAccount;
  }
}
