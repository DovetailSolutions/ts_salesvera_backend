import { Sequelize } from "sequelize";

/**
 * Attendance Security — duplicate device-change request prevention.
 *
 * checkDeviceSecurity (attendanceSecurity.service.ts) already checks "is
 * there a pending request for this (userId, requestedDeviceId) pair" before
 * creating a new one, but that check-then-insert isn't atomic: two
 * near-simultaneous punch attempts from the same unrecognized device (a
 * double-tap, or a client retry) can both pass the check before either
 * insert lands, producing two PENDING rows for the same device instead of
 * one. A partial unique index makes the "at most one pending request per
 * (userId, requestedDeviceId)" rule a DB-level guarantee — the second insert
 * fails with a unique-violation, which attendanceSecurity.service.ts catches
 * and falls back to the row that won the race, exactly as if it had found it
 * via the normal check.
 *
 * Partial (WHERE status = 'pending') rather than a plain unique constraint
 * because approved/rejected history for the same device must be allowed to
 * accumulate (see attendance_device_change_requests' audit/history use) —
 * only one row may be pending at a time, not one row ever.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_adcr_one_pending_per_device"
      ON "attendance_device_change_requests" ("userId", "requestedDeviceId")
      WHERE "status" = 'pending';
  `);
}
