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
 * Human-readable location names for Attendance In/Out, resolved once at
 * punch time (branch-match first, then reverse geocode — see
 * modules/attendance/locationName.service.ts) and persisted here so the
 * travel timeline never re-calls Google's Geocoding API on every read.
 * Meeting locations need no equivalent column — they already carry a real
 * customer name/address via MeetingUser, which is always a better label
 * than a geocoded street address.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "locationNameIn" TEXT;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "locationNameOut" TEXT;
  `);
    });
}
