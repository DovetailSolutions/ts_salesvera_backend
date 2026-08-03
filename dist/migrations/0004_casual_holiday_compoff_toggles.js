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
 * Adds the three approval/carry-forward toggles Step5.jsx's "Casual Holiday
 * Settings" and "Comp Off" sections present — previously plain local
 * useState in the component, not even part of the submitted form data.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "casualHolidayApprovalRequired" BOOLEAN DEFAULT true;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "casualHolidayCarryForward" BOOLEAN DEFAULT false;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "compOffApprovalRequired" BOOLEAN DEFAULT true;
  `);
    });
}
