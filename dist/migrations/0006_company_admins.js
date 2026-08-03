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
 * Junction table for many-to-many company <-> admin assignment, mirroring
 * the existing company_managers table — lets the same admin account
 * administer multiple companies (previously Company.adminId only allowed
 * one admin per company, with no way to add a second).
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    CREATE TABLE IF NOT EXISTS "company_admins" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "adminId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "company_admins_unique" UNIQUE ("companyId", "adminId")
    );
  `);
    });
}
