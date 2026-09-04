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
 * Sale Person daily travel distance + vehicle allowance.
 *
 * Meeting-to-meeting leg distances already exist (meetings.legDistance/
 * totalDistance, computed via Google Distance Matrix in
 * app/middlewear/comman.ts's getDistance) — this migration only adds what's
 * missing: the final "last meeting -> attendance out" leg, the resulting
 * whole-day total, and the per-company allowance rate + calculated amount.
 * Deliberately extends the existing attendance/companies tables rather than
 * introducing a parallel travel-segment table, since every segment is
 * already derivable from attendance.latitude_in/longitude_in +
 * meetings.latitude_in/out/longitude_in/out/legDistance/totalDistance.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "vehicleAllowanceRatePerKm" DOUBLE PRECISION;

    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "lastMeetingId" INTEGER;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "finalLegDistanceKm" DOUBLE PRECISION;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "totalTravelDistanceKm" DOUBLE PRECISION;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "vehicleAllowanceRateApplied" DOUBLE PRECISION;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "vehicleAllowance" DOUBLE PRECISION;
    -- 'calculated' | 'failed' | 'no_meetings' | null (not yet computed, e.g. pre-migration rows)
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "distanceCalculationStatus" VARCHAR(20);
  `);
    });
}
