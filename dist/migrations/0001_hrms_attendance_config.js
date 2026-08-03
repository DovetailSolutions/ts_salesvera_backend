"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
/**
 * Adds the company-wide attendance policy toggles the registration wizard
 * (Step3.jsx) already collects but were never persisted
 * (geoFencingRequired, officeLocationRequired, overtimeAllowed,
 * companyWorkingDays, altSaturday) — lateMarkAfter/autoHalfDayAfter already
 * existed. Also adds per-employee shift/department assignment (User had
 * neither), needed so the attendance engine can resolve "this employee's
 * assigned shift" instead of using hardcoded defaults for everyone.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
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
        yield sequelize.query(`
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT users_shiftid_fkey
        FOREIGN KEY ("shiftId") REFERENCES shifts(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
        yield sequelize.query(`
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT users_departmentid_fkey
        FOREIGN KEY ("departmentId") REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
    });
}
