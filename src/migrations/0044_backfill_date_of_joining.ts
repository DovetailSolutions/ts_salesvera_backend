import { Sequelize } from "sequelize";

/**
 * Date of joining for admins / managers / employees added before the add-user
 * forms asked for it: the (IST) date the account was created. Only fills a
 * missing date — a date already entered on the employee profile is kept.
 * Users without an employee_extra_details row get one holding just this date.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    INSERT INTO "employee_extra_details" ("userId", "dateOfJoining", "createdAt", "updatedAt")
    SELECT u."id", (u."createdAt" AT TIME ZONE 'Asia/Kolkata')::date, NOW(), NOW()
      FROM "users" u
     WHERE u."role" IN ('admin', 'manager', 'employee') AND u."createdAt" IS NOT NULL
    ON CONFLICT ("userId") DO UPDATE
       SET "dateOfJoining" = EXCLUDED."dateOfJoining", "updatedAt" = NOW()
     WHERE "employee_extra_details"."dateOfJoining" IS NULL;
  `);
}
