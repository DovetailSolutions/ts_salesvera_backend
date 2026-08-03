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
 * Adds per-department working-day overrides. Step4.jsx already collects
 * these (a department can inherit the company-wide working days from Step3,
 * or set its own custom days) and the wizard already sends them, but the
 * Department model/table had no matching columns — silently discarded.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "workingDays" JSONB;
    ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "customWorkingDays" BOOLEAN DEFAULT false;
  `);
    });
}
