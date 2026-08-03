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
 * New task_comments table backing the Task Management "Comments" tab —
 * this app had zero comment/discussion infrastructure on tasks before now.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize.query(`
    CREATE TABLE IF NOT EXISTS "task_comments" (
      "id" SERIAL PRIMARY KEY,
      "taskId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
        yield sequelize.query(`
    CREATE INDEX IF NOT EXISTS "task_comments_task_id_idx" ON "task_comments" ("taskId");
  `);
    });
}
