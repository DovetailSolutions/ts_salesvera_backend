import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// ============================================================
// employee_extra_details — one row per user (PK = userId), holding the
// SalaryBox bulk-import spreadsheet's fields that have no home anywhere in
// the existing `users` table or any other normalized table. Scoped in
// practice to admin/manager/sale_person (the only roles this feature's
// UI/API ever writes for) but not role-enforced at the schema level — that
// happens in modules/employeeProfile's service layer, same as every other
// company-scoped table in this codebase.
//
// Deliberately explicit typed columns, not a generic key-value/EAV table —
// matches how the rest of this codebase already models additive data (see
// schemaExtensions.ts) and keeps validation/querying simple. `staff`,
// `stationary`, `worker`, `laptops`, `juniorManager` have no description in
// the source spreadsheet — stored as plain nullable text pending
// clarification, deliberately not given special typing/validation.
//
// Bank details are NOT here — see employeeBankAccount.ts's one-to-many
// employee_bank_accounts table instead.
// ============================================================

export interface EmployeeExtraDetailsAttributes {
  userId: number;
  companyId: number | null;
  countryCode: string | null;
  personalEmail: string | null;
  officialEmail: string | null;
  dateOfJoining: string | null;
  // The spreadsheet's own "Employee ID" — a free-text client-facing value,
  // distinct from `users.employeeCode` (Postgres-generated "EMP00001").
  employeeIdExternal: string | null;
  jobTitle: string | null;
  employeeType: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  gender: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  pfAccountNumber: string | null;
  esiAccountNumber: string | null;
  uan: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  guardianName: string | null;
  emergencyContactName: string | null;
  emergencyContactCountryCode: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactAddress: string | null;
  educationalQualification: string | null;
  incrementAmount: number | null;
  grade: string | null;
  maintenanceFee: number | null;
  laptopSerialNumber: string | null;
  mobileSerialNumber: string | null;
  houseNumber: string | null;
  lockerNumber: string | null;
  // No description in the source spreadsheet — see file header comment.
  staff: string | null;
  stationary: string | null;
  worker: string | null;
  laptops: string | null;
  juniorManager: string | null;
  upiDetails: string | null;
  contractVendorName: string | null;
  businessUnit: string | null;
  assets: string | null;
  simOperatorName: string | null;
  registrationNumber: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type EmployeeExtraDetailsCreationAttributes = Optional<
  EmployeeExtraDetailsAttributes,
  Exclude<keyof EmployeeExtraDetailsAttributes, "userId">
>;

export class EmployeeExtraDetails
  extends Model<EmployeeExtraDetailsAttributes, EmployeeExtraDetailsCreationAttributes>
  implements EmployeeExtraDetailsAttributes
{
  public userId!: number;
  public companyId!: number | null;
  public countryCode!: string | null;
  public personalEmail!: string | null;
  public officialEmail!: string | null;
  public dateOfJoining!: string | null;
  public employeeIdExternal!: string | null;
  public jobTitle!: string | null;
  public employeeType!: string | null;
  public currentAddress!: string | null;
  public permanentAddress!: string | null;
  public gender!: string | null;
  public maritalStatus!: string | null;
  public bloodGroup!: string | null;
  public pfAccountNumber!: string | null;
  public esiAccountNumber!: string | null;
  public uan!: string | null;
  public aadhaarNumber!: string | null;
  public panNumber!: string | null;
  public guardianName!: string | null;
  public emergencyContactName!: string | null;
  public emergencyContactCountryCode!: string | null;
  public emergencyContactPhone!: string | null;
  public emergencyContactRelationship!: string | null;
  public emergencyContactAddress!: string | null;
  public educationalQualification!: string | null;
  public incrementAmount!: number | null;
  public grade!: string | null;
  public maintenanceFee!: number | null;
  public laptopSerialNumber!: string | null;
  public mobileSerialNumber!: string | null;
  public houseNumber!: string | null;
  public lockerNumber!: string | null;
  public staff!: string | null;
  public stationary!: string | null;
  public worker!: string | null;
  public laptops!: string | null;
  public juniorManager!: string | null;
  public upiDetails!: string | null;
  public contractVendorName!: string | null;
  public businessUnit!: string | null;
  public assets!: string | null;
  public simOperatorName!: string | null;
  public registrationNumber!: string | null;
  public createdBy!: number | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof EmployeeExtraDetails {
    EmployeeExtraDetails.init(
      {
        userId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: true },
        countryCode: { type: DataTypes.TEXT, allowNull: true },
        personalEmail: { type: DataTypes.TEXT, allowNull: true },
        officialEmail: { type: DataTypes.TEXT, allowNull: true },
        dateOfJoining: { type: DataTypes.DATEONLY, allowNull: true },
        employeeIdExternal: { type: DataTypes.TEXT, allowNull: true },
        jobTitle: { type: DataTypes.TEXT, allowNull: true },
        employeeType: { type: DataTypes.TEXT, allowNull: true },
        currentAddress: { type: DataTypes.TEXT, allowNull: true },
        permanentAddress: { type: DataTypes.TEXT, allowNull: true },
        gender: { type: DataTypes.TEXT, allowNull: true },
        maritalStatus: { type: DataTypes.TEXT, allowNull: true },
        bloodGroup: { type: DataTypes.TEXT, allowNull: true },
        pfAccountNumber: { type: DataTypes.TEXT, allowNull: true },
        esiAccountNumber: { type: DataTypes.TEXT, allowNull: true },
        uan: { type: DataTypes.TEXT, allowNull: true },
        aadhaarNumber: { type: DataTypes.TEXT, allowNull: true },
        panNumber: { type: DataTypes.TEXT, allowNull: true },
        guardianName: { type: DataTypes.TEXT, allowNull: true },
        emergencyContactName: { type: DataTypes.TEXT, allowNull: true },
        emergencyContactCountryCode: { type: DataTypes.TEXT, allowNull: true },
        emergencyContactPhone: { type: DataTypes.TEXT, allowNull: true },
        emergencyContactRelationship: { type: DataTypes.TEXT, allowNull: true },
        emergencyContactAddress: { type: DataTypes.TEXT, allowNull: true },
        educationalQualification: { type: DataTypes.TEXT, allowNull: true },
        incrementAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        grade: { type: DataTypes.TEXT, allowNull: true },
        maintenanceFee: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        laptopSerialNumber: { type: DataTypes.TEXT, allowNull: true },
        mobileSerialNumber: { type: DataTypes.TEXT, allowNull: true },
        houseNumber: { type: DataTypes.TEXT, allowNull: true },
        lockerNumber: { type: DataTypes.TEXT, allowNull: true },
        staff: { type: DataTypes.TEXT, allowNull: true },
        stationary: { type: DataTypes.TEXT, allowNull: true },
        worker: { type: DataTypes.TEXT, allowNull: true },
        laptops: { type: DataTypes.TEXT, allowNull: true },
        juniorManager: { type: DataTypes.TEXT, allowNull: true },
        upiDetails: { type: DataTypes.TEXT, allowNull: true },
        contractVendorName: { type: DataTypes.TEXT, allowNull: true },
        businessUnit: { type: DataTypes.TEXT, allowNull: true },
        assets: { type: DataTypes.TEXT, allowNull: true },
        simOperatorName: { type: DataTypes.TEXT, allowNull: true },
        registrationNumber: { type: DataTypes.TEXT, allowNull: true },
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
      },
      {
        sequelize,
        tableName: "employee_extra_details",
        timestamps: true,
        indexes: [{ fields: ["companyId"], name: "idx_employee_extra_details_company" }],
      }
    );

    return EmployeeExtraDetails;
  }
}
