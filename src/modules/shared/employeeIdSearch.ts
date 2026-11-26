import { Op, Sequelize } from "sequelize";
import { sequelize } from "../../config/dbConnection";

// "Employee ID" search conditions for people lists: matches the system code
// (users.employeeCode, e.g. EMP00045) and the company's own Employee ID
// (employee_extra_details.employeeIdExternal, e.g. DVT160 — the one the web
// shows where set). Drop the returned conditions into an existing [Op.or]
// list on a User query; the value is escaped, never interpolated raw.
export const employeeIdSearchConditions = (search: unknown): any[] => {
  const term = String(search ?? "").trim();
  if (!term) return [];
  const pattern = sequelize.escape(`%${term}%`);
  return [
    { employeeCode: { [Op.iLike]: `%${term}%` } },
    {
      id: {
        [Op.in]: Sequelize.literal(
          `(SELECT "userId" FROM "employee_extra_details" WHERE "employeeIdExternal" ILIKE ${pattern})`
        ),
      },
    },
  ];
};
