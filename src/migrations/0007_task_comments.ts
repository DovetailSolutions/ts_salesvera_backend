import { Sequelize } from "sequelize";

/**
 * New task_comments table backing the Task Management "Comments" tab —
 * this app had zero comment/discussion infrastructure on tasks before now.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "task_comments" (
      "id" SERIAL PRIMARY KEY,
      "taskId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "task_comments_task_id_idx" ON "task_comments" ("taskId");
  `);
}
