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
 * Per-user attendance geo-fencing (super_admin -> admin -> manager/sale_person
 * hierarchy) plus an audit trail of what was actually checked on each
 * attendance punch. Independent of the existing company/branch-wide
 * geoFencingRequired + branches.geoRadius geofence — this one is per person,
 * not per office.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
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
    });
}
