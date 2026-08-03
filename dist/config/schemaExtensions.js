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
exports.ensureNotificationPreferences = exports.ensureEmployeeCode = exports.ensureLeaveTypeSchema = void 0;
// ============================================================
// Additive, standalone schema changes for the dynamic per-company
// leave-type wiring (attendance/leave records linked to the specific
// CompanyLeave type that caused them, plus a per-type balance table).
//
// Deliberately NOT folded into ensureColumns/fixConstraints/
// ensureDataIntegrity/connectDB in dbConnection.ts — those bodies are
// frozen (interleaved with Tally-table DDL). This runs as its own step,
// called from server.ts after connectDB() resolves, so it can evolve
// independently without touching frozen code. Every statement is
// idempotent (IF NOT EXISTS) so it's safe to run on every boot.
// ============================================================
const ensureLeaveTypeSchema = (sequelize) => __awaiter(void 0, void 0, void 0, function* () {
    yield sequelize.query(`
    ALTER TABLE "attendance"
      ADD COLUMN IF NOT EXISTS "companyLeaveId" INTEGER REFERENCES "company_leaves"("id") ON DELETE SET NULL;
  `);
    yield sequelize.query(`
    ALTER TABLE "leave_requests"
      ADD COLUMN IF NOT EXISTS "companyLeaveId" INTEGER REFERENCES "company_leaves"("id") ON DELETE SET NULL;
  `);
    yield sequelize.query(`
    CREATE TABLE IF NOT EXISTS "employee_leave_type_balances" (
      "id" SERIAL PRIMARY KEY,
      "employeeId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "companyLeaveId" INTEGER NOT NULL REFERENCES "company_leaves"("id") ON DELETE CASCADE,
      "year" INTEGER NOT NULL,
      "allocated" INTEGER NOT NULL DEFAULT 0,
      "used" INTEGER NOT NULL DEFAULT 0,
      "assignedBy" INTEGER REFERENCES "users"("id"),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("employeeId", "companyLeaveId", "year")
    );
  `);
    // Days rolled over from the prior year's unused balance, capped at that
    // leave type's own CompanyLeave.carryForwardLimit — kept separate from
    // "allocated" so it stays visible (and isn't silently overwritten) when an
    // admin later re-assigns this year's allocation. Computed once, lazily,
    // the first time a given (employee, type, year) balance row is created —
    // see resolveLeaveTypeBalance in leave.service.ts.
    yield sequelize.query(`
    ALTER TABLE "employee_leave_type_balances"
      ADD COLUMN IF NOT EXISTS "carriedForward" INTEGER NOT NULL DEFAULT 0;
  `);
    console.log("Leave-type schema extensions ensured (companyLeaveId columns + employee_leave_type_balances table + carriedForward)");
});
exports.ensureLeaveTypeSchema = ensureLeaveTypeSchema;
// ============================================================
// Human-facing employee code ("EMP00001") for every user (sale_person,
// manager, admin, and "user"/company-owner alike) — a Postgres GENERATED
// ALWAYS column derived from the row's own `id`, so it's automatically
// present for every existing user (computed once when this column is added)
// and every future one (computed at insert time), with zero backend code
// needed at any of the app's several User.create() call sites to set it —
// there's nothing to forget to wire up. Purely a display/lookup alias
// (bulk attendance CSV, employee tables); internal FKs keep using `id`.
// ============================================================
const ensureEmployeeCode = (sequelize) => __awaiter(void 0, void 0, void 0, function* () {
    yield sequelize.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "employeeCode" VARCHAR(20)
      GENERATED ALWAYS AS ('EMP' || LPAD(id::text, 5, '0')) STORED;
  `);
    yield sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_employee_code_idx" ON "users" ("employeeCode");
  `);
    console.log("Employee code ensured (users.employeeCode, generated from id)");
});
exports.ensureEmployeeCode = ensureEmployeeCode;
// ============================================================
// Per-user notification mute preferences — the Settings module's "My
// Preferences" tab. Only chat/task/meeting are individually mutable;
// "system"/"other" notifications (e.g. security/account alerts) always go
// through, so there's no notifySystem/notifyOther column.
// ============================================================
const ensureNotificationPreferences = (sequelize) => __awaiter(void 0, void 0, void 0, function* () {
    yield sequelize.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "notifyChat" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "notifyTask" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "notifyMeeting" BOOLEAN NOT NULL DEFAULT true;
  `);
    console.log("Notification preferences ensured (users.notifyChat/notifyTask/notifyMeeting)");
});
exports.ensureNotificationPreferences = ensureNotificationPreferences;
