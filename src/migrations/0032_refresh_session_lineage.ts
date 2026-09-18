import { Sequelize } from "sequelize";

/**
 * Adds refresh_sessions."lineageId" — a per-login chain id shared by every
 * session row that descends from one login on one device/browser.
 *
 * Why: rotation replaces a session row with a new one on every refresh, and
 * the rotation grace window (migration 0031) can additionally create a
 * sibling row when the app refreshes twice at once. Logout used to revoke
 * only the row whose token was presented, so a sibling/newer row from the
 * same browser could survive an explicit logout — the user would still be
 * signed in. Revoking by lineage logs that browser out completely, while a
 * different device's login (its own lineage) is untouched, which is the
 * existing logout behavior.
 *
 * Existing rows are backfilled with their own id, so every current session
 * becomes its own single-row lineage and nothing changes for them.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "refresh_sessions" ADD COLUMN IF NOT EXISTS "lineageId" INTEGER;
    UPDATE "refresh_sessions" SET "lineageId" = "id" WHERE "lineageId" IS NULL;
    CREATE INDEX IF NOT EXISTS "idx_refresh_sessions_lineage" ON "refresh_sessions" ("lineageId");
  `);
}

export async function down(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    DROP INDEX IF EXISTS "idx_refresh_sessions_lineage";
    ALTER TABLE "refresh_sessions" DROP COLUMN IF EXISTS "lineageId";
  `);
}
