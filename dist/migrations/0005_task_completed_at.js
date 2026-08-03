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
 * Adds Task.completedAt, set only when a task's status transitions to
 * "completed" — needed to distinguish "done today" (shown on the active
 * board) from older completed tasks (task history), which previously had
 * no way to be told apart (only the generic updatedAt timestamp existed,
 * which changes on any edit, not just completion).
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE;
  `);
    });
}
