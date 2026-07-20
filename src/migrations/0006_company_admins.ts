import { Sequelize } from "sequelize";

/**
 * Junction table for many-to-many company <-> admin assignment, mirroring
 * the existing company_managers table — lets the same admin account
 * administer multiple companies (previously Company.adminId only allowed
 * one admin per company, with no way to add a second).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "company_admins" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "adminId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "company_admins_unique" UNIQUE ("companyId", "adminId")
    );
  `);
}
