import { Sequelize } from "sequelize";

/**
 * Adds "in_review" to the tasks.status enum — the frontend board (kanban
 * columns) now has an "In Review" column, but the DB enum only had
 * todo/in_progress/completed/cancelled, so moving a task into that column
 * would fail with an invalid-enum-value error until this runs.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TYPE "enum_tasks_status" ADD VALUE IF NOT EXISTS 'in_review';
  `);
}
