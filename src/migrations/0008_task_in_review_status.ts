import { Sequelize } from "sequelize";

/**
 * Adds "in_review" to the tasks.status enum — the frontend board (kanban
 * columns) now has an "In Review" column, but the DB enum only had
 * todo/in_progress/completed/cancelled, so moving a task into that column
 * would fail with an invalid-enum-value error until this runs.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  // tasks.status is a Postgres ENUM only on environments where Sequelize
  // created the table via sync(); elsewhere (e.g. hand-migrated DBs) it's a
  // plain VARCHAR, which needs no DDL to accept a new string value.
  await sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tasks_status') THEN
        ALTER TYPE "enum_tasks_status" ADD VALUE IF NOT EXISTS 'in_review';
      END IF;
    END $$;
  `);
}
