import { Sequelize } from "sequelize";

/**
 * Adds Task.completedAt, set only when a task's status transitions to
 * "completed" — needed to distinguish "done today" (shown on the active
 * board) from older completed tasks (task history), which previously had
 * no way to be told apart (only the generic updatedAt timestamp existed,
 * which changes on any edit, not just completion).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE;
  `);
}
