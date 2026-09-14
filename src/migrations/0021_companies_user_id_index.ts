import { Sequelize } from "sequelize";

/**
 * Index on companies.userId — the "user" (tenant-owner) role's company
 * switcher (getMyCompanies/switchCompany/resolveLoginCompanyId/
 * resolveCompanyId) now queries Company by userId on a moderately hot path
 * (Topbar menu-open, plus every login/refresh). No index existed on this
 * column before (only composite uniques on the junction tables).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "companies_user_id_idx" ON "companies" ("userId");
  `);
}
