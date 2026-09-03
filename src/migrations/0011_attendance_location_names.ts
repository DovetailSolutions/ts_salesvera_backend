import { Sequelize } from "sequelize";

/**
 * Human-readable location names for Attendance In/Out, resolved once at
 * punch time (branch-match first, then reverse geocode — see
 * modules/attendance/locationName.service.ts) and persisted here so the
 * travel timeline never re-calls Google's Geocoding API on every read.
 * Meeting locations need no equivalent column — they already carry a real
 * customer name/address via MeetingUser, which is always a better label
 * than a geocoded street address.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "locationNameIn" TEXT;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "locationNameOut" TEXT;
  `);
}
