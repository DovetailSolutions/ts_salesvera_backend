import { Sequelize } from "sequelize";

/**
 * Attendance Security: per-user photo/device/punch-out-geofence toggles,
 * single-trusted-device binding (replace-on-approval policy — approving a
 * new device automatically supersedes the old one, no multi-device support),
 * a device-change approval queue, and an append-only security audit log.
 *
 * All new users.* toggles default FALSE (opt-in) so no existing user's
 * attendance behavior changes until an admin explicitly turns something on
 * for them — mirrors user_geo_fencing.enabled's default-false convention.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    -- One row per user — single trusted device, "replace on approval" policy.
    CREATE TABLE IF NOT EXISTS "attendance_trusted_devices" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "companyId" INTEGER,
      "deviceId" TEXT NOT NULL,
      "deviceName" TEXT,
      "deviceType" VARCHAR(20),
      "registeredAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_trusted_devices_user_unique" UNIQUE ("userId")
    );

    CREATE TABLE IF NOT EXISTS "attendance_device_change_requests" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "companyId" INTEGER,
      "requestedDeviceId" TEXT NOT NULL,
      "requestedDeviceName" TEXT,
      "requestedDeviceType" VARCHAR(20),
      "previousDeviceId" TEXT,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "reviewedBy" INTEGER,
      "reviewedAt" TIMESTAMP WITH TIME ZONE,
      "reviewNote" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_adcr_user_device" ON "attendance_device_change_requests" ("userId", "requestedDeviceId");
    CREATE INDEX IF NOT EXISTS "idx_adcr_company_status" ON "attendance_device_change_requests" ("companyId", "status");

    CREATE TABLE IF NOT EXISTS "attendance_audit_logs" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "companyId" INTEGER,
      "actorId" INTEGER,
      "eventType" VARCHAR(50) NOT NULL,
      "attendanceId" INTEGER,
      "deviceChangeRequestId" INTEGER,
      "message" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "attendance_audit_logs" ("userId", "createdAt");
    CREATE INDEX IF NOT EXISTS "idx_audit_company_event" ON "attendance_audit_logs" ("companyId", "eventType");

    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "attendancePhoto" TEXT;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "punchInDeviceId" TEXT;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "punchOutDeviceId" TEXT;

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAttendancePhotoRequired" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDeviceSecurityRequired" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isPunchOutGeofenceRequired" BOOLEAN NOT NULL DEFAULT false;
  `);
}
