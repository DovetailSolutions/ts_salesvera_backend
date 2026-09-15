import { Sequelize } from "sequelize";

/**
 * Half-day leave takes 0.5 day from the Casual Leave balance, so the balance
 * columns must hold fractions. INTEGER -> DOUBLE PRECISION keeps every
 * existing value unchanged.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "employee_leave_type_balances" ALTER COLUMN "allocated" TYPE DOUBLE PRECISION;
    ALTER TABLE "employee_leave_type_balances" ALTER COLUMN "used" TYPE DOUBLE PRECISION;
    ALTER TABLE "employee_leave_type_balances" ALTER COLUMN "carriedForward" TYPE DOUBLE PRECISION;
  `);
}
