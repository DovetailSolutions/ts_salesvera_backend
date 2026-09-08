import { Sequelize } from "sequelize";

/**
 * Per-recipient delivery/read tracking for announcements. Normalized (one
 * row per recipient) rather than a JSON array on the announcement itself,
 * matching this repo's existing junction-table convention (company_managers,
 * task_comments, etc.) — needed for read-receipt breakdowns and per-user
 * unread counts.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "announcement_recipients" (
      "id" SERIAL PRIMARY KEY,
      "announcementId" INTEGER NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
      "recipientId" INTEGER NOT NULL,
      "recipientRole" VARCHAR(20) NOT NULL,
      "companyId" INTEGER NOT NULL,
      "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
      "readAt" TIMESTAMP WITH TIME ZONE,
      "deliveredAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "announcement_recipients_unique_idx" ON "announcement_recipients" ("announcementId","recipientId");
    CREATE INDEX IF NOT EXISTS "announcement_recipients_recipient_idx" ON "announcement_recipients" ("recipientId","isRead");
  `);
}
