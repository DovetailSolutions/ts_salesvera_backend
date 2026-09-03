import { Sequelize } from "sequelize";

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
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "vehicleAllowanceRatePerKm" DOUBLE PRECISION;

    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "lastMeetingId" INTEGER;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "finalLegDistanceKm" DOUBLE PRECISION;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "totalTravelDistanceKm" DOUBLE PRECISION;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "vehicleAllowanceRateApplied" DOUBLE PRECISION;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "vehicleAllowance" DOUBLE PRECISION;
    -- 'calculated' | 'failed' | 'no_meetings' | null (not yet computed, e.g. pre-migration rows)
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "distanceCalculationStatus" VARCHAR(20);
  `);
}
