import { Sequelize } from "sequelize";

/**
 * Adds the company-wide attendance policy toggles the registration wizard
 * (Step3.jsx) already collects but were never persisted
 * (geoFencingRequired, officeLocationRequired, overtimeAllowed,
 * companyWorkingDays, altSaturday) — lateMarkAfter/autoHalfDayAfter already
 * existed. Also adds per-employee shift/department assignment (User had
 * neither), needed so the attendance engine can resolve "this employee's
 * assigned shift" instead of using hardcoded defaults for everyone.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "geoFencingRequired" BOOLEAN DEFAULT true;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "officeLocationRequired" BOOLEAN DEFAULT true;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "overtimeAllowed" BOOLEAN DEFAULT false;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "companyWorkingDays" JSONB;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "altSaturday" BOOLEAN DEFAULT false;

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shiftId" INTEGER;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;
  `);

  // FKs added separately (and guarded) so a failure here doesn't roll back
  // the column adds above — mirrors the defensive style already used by the
  // legacy ensureColumns function for similar constraint additions.
  await sequelize.query(`
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT users_shiftid_fkey
        FOREIGN KEY ("shiftId") REFERENCES shifts(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
  await sequelize.query(`
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT users_departmentid_fkey
        FOREIGN KEY ("departmentId") REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
}
