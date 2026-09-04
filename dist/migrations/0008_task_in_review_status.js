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
 * Adds "in_review" to the tasks.status enum — the frontend board (kanban
 * columns) now has an "In Review" column, but the DB enum only had
 * todo/in_progress/completed/cancelled, so moving a task into that column
 * would fail with an invalid-enum-value error until this runs.
 */
function up(sequelize) {
    return __awaiter(this, void 0, void 0, function* () {
        // tasks.status is a Postgres ENUM only on environments where Sequelize
        // created the table via sync(); elsewhere (e.g. hand-migrated DBs) it's a
        // plain VARCHAR, which needs no DDL to accept a new string value.
        yield sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tasks_status') THEN
        ALTER TYPE "enum_tasks_status" ADD VALUE IF NOT EXISTS 'in_review';
      END IF;
    END $$;
  `);
    });
}
