import { EmployeeExtraDetails } from "../../config/dbConnection";

// The "Job & Personal" group of employee_extra_details (same keys as the web
// Employee Details form). Both profile endpoints (GET /admin/getprofile and
// GET /api/getprofile) merge these onto the profile so clients don't need a
// second call.
export const JOB_PERSONAL_FIELDS = [
  "jobTitle",
  "employeeType",
  "dateOfJoining",
  "employeeIdExternal",
  "gender",
  "maritalStatus",
  "bloodGroup",
  "personalEmail",
  "officialEmail",
  "countryCode",
] as const;

// Every field is always present; null when the user has no saved details.
export const getJobPersonalDetails = async (userId: number): Promise<Record<string, any>> => {
  const row: any = await EmployeeExtraDetails.findByPk(userId, {
    attributes: [...JOB_PERSONAL_FIELDS],
    raw: true,
  });
  return Object.fromEntries(JOB_PERSONAL_FIELDS.map((k) => [k, row?.[k] ?? null]));
};
