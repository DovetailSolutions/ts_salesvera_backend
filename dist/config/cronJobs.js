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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("./dbConnection");
const attendance_service_1 = require("../modules/attendance/attendance.service");
/**
 * ─────────────────────────────────────────────
 *  AUTO PUNCH-OUT CRON JOB
 *  Schedule : Every day at 11:59 PM (IST)
 *  Purpose  : Find all attendance records that
 *             are still "present" (punch-in done,
 *             punch-out NOT done) and auto close
 *             them with punch_out = 23:59:00 IST
 *             of their respective date.
 * ─────────────────────────────────────────────
 */
const startCronJobs = () => {
    // ──────────────────────────────────────────────
    // Cron: "59 23 * * *"  → runs at 23:59 every day
    // timezone: "Asia/Kolkata" ensures it fires at
    // 11:59 PM IST regardless of server timezone
    // ──────────────────────────────────────────────
    node_cron_1.default.schedule("59 23 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            // Today's date string (yyyy-mm-dd)
            const todayStr = new Date().toISOString().slice(0, 10);
            // ── Step 1: Find all un-punched-out records up to today ──
            const missed = yield dbConnection_1.Attendance.findAll({
                where: {
                    status: "present", // punched in, not yet punched out
                    punch_out: null, // safety double-check
                    date: {
                        [sequelize_1.Op.lte]: todayStr, // today or any earlier forgotten date
                    },
                },
            });
            if (missed.length === 0) {
                return;
            }
            // ── Step 1b: Batch-resolve each employee's shift + company, same
            // "Shift > Company > hardcoded" precedence used by every interactive
            // attendance endpoint (mark-present, punch-out, bulk upload) — this
            // job previously always applied overtime with a hardcoded 8h
            // baseline regardless of whether the company had even enabled
            // overtime tracking at registration (Company.overtimeAllowed), and
            // never set dayType at all. Batched (not per-record) to keep this a
            // fixed number of queries regardless of how many records are missed.
            const employeeIds = [...new Set(missed.map((r) => r.employee_id))];
            const employees = yield dbConnection_1.User.findAll({
                where: { id: { [sequelize_1.Op.in]: employeeIds } },
                attributes: ["id", "shiftId"],
            });
            const shiftIdByEmployee = new Map(employees.map((e) => { var _a; return [e.id, (_a = e.shiftId) !== null && _a !== void 0 ? _a : null]; }));
            const shiftIds = [...new Set(employees.map((e) => e.shiftId).filter((id) => !!id))];
            const shifts = shiftIds.length ? yield dbConnection_1.Shift.findAll({ where: { id: { [sequelize_1.Op.in]: shiftIds } } }) : [];
            const shiftById = new Map(shifts.map((s) => [s.id, s]));
            const companyIds = [...new Set(shifts.map((s) => s.companyId).filter((id) => !!id))];
            const companies = companyIds.length ? yield dbConnection_1.Company.findAll({ where: { id: { [sequelize_1.Op.in]: companyIds } } }) : [];
            const companyById = new Map(companies.map((c) => [c.id, c]));
            // ── Step 2: Auto punch-out each record ──
            let successCount = 0;
            let skipCount = 0;
            for (const record of missed) {
                try {
                    // Get the attendance date string (e.g. "2026-04-14")
                    const dateStr = record.date instanceof Date
                        ? record.date.toISOString().slice(0, 10)
                        : String(record.date).slice(0, 10);
                    // Set auto punch-out at 23:59:00 IST of the attendance date
                    // "+05:30" = IST offset so DB stores the correct UTC equivalent
                    const autoPunchOut = new Date(`${dateStr}T23:59:00+05:30`);
                    const punchIn = new Date(record.punch_in);
                    // Skip if punch_in is somehow after auto punch-out (data anomaly)
                    if (autoPunchOut <= punchIn) {
                        console.warn(`[CRON] ⚠️  Skipping employee ${record.employee_id} (date: ${dateStr}) — punch_in is after 23:59`);
                        skipCount++;
                        continue;
                    }
                    // ── Calculate working hours ──
                    const diffMs = autoPunchOut.getTime() - punchIn.getTime();
                    const workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
                    const shiftId = shiftIdByEmployee.get(record.employee_id);
                    const shift = shiftId ? shiftById.get(shiftId) : null;
                    const company = (shift === null || shift === void 0 ? void 0 : shift.companyId) ? companyById.get(shift.companyId) : null;
                    // ── Overtime — only counted if this employee's company actually
                    // opted into overtime tracking at registration; baseline from
                    // their shift's own working hours, falling back to 8h.
                    const officeHours = (shift === null || shift === void 0 ? void 0 : shift.workingHours) && shift.workingHours > 0 ? shift.workingHours : 8;
                    const overtimeAllowed = (_a = company === null || company === void 0 ? void 0 : company.overtimeAllowed) !== null && _a !== void 0 ? _a : false;
                    const overtime = overtimeAllowed && workingHours > officeHours
                        ? Number((workingHours - officeHours).toFixed(2))
                        : 0;
                    const dayType = (0, attendance_service_1.getDayTypeFromWorkingHours)(workingHours, shift, company);
                    // ── Update the record ──
                    yield record.update({
                        punch_out: autoPunchOut,
                        working_hours: workingHours,
                        overtime,
                        dayType,
                        status: "out",
                    });
                    successCount++;
                }
                catch (recordError) {
                    console.error(`[CRON] ❌ Failed to auto punch-out employee ${record.employee_id}:`, recordError);
                }
            }
            console.log(`[CRON] 🏁 Job done — Success: ${successCount}, Skipped: ${skipCount}, Total: ${missed.length}`);
        }
        catch (error) {
            console.error("[CRON] ❌ Auto punch-out job failed with error:", error);
        }
    }), {
        // scheduled: true,
        timezone: "Asia/Kolkata", // 11:59 PM IST
    });
};
exports.startCronJobs = startCronJobs;
