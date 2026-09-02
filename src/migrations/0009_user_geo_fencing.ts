import { Sequelize } from "sequelize";

/**
 * Per-user attendance geo-fencing (super_admin -> admin -> manager/sale_person
 * hierarchy) plus an audit trail of what was actually checked on each
 * attendance punch. Independent of the existing company/branch-wide
 * geoFencingRequired + branches.geoRadius geofence — this one is per person,
 * not per office.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "user_geo_fencing" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "companyId" INTEGER,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "latitude" DOUBLE PRECISION,
      "longitude" DOUBLE PRECISION,
      "radius" DOUBLE PRECISION,
      "radiusUnit" VARCHAR(4) NOT NULL DEFAULT 'm',
      "createdBy" INTEGER,
      "updatedBy" INTEGER,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_geo_fencing_user_unique" UNIQUE ("userId")
    );

    CREATE INDEX IF NOT EXISTS "idx_user_geo_fencing_company" ON "user_geo_fencing" ("companyId");

    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "geoFencingEnabled" BOOLEAN;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "geoFencingVerified" BOOLEAN;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "geoFenceDistance" DOUBLE PRECISION;
  `);
}
