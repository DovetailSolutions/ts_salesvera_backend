import { Sequelize } from "sequelize";

/**
 * Web login refresh-token architecture — see app/model/refreshSession.ts,
 * modules/auth/{webToken,refreshSession}.service.ts, and auth.routes.ts's
 * /admin/login, /admin/refreshtoken, /admin/logout.
 *
 * Only the SHA-256 hash of each refresh token is stored, never the raw
 * value. Rotation (see refreshSession.service.ts) revokes the row being
 * used and inserts a new one rather than updating in place, so a stolen,
 * already-rotated token can be detected (its hash simply won't match any
 * non-revoked row) — this table is therefore an append-heavy history, not a
 * single mutable slot per user like the legacy users.refreshToken column
 * (which mobile's /api/login flow keeps using, unmodified).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "refresh_sessions" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "tokenHash" VARCHAR(128) NOT NULL,
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "revokedAt" TIMESTAMP WITH TIME ZONE,
      "deviceId" VARCHAR(255),
      "userAgent" TEXT,
      "ipAddress" VARCHAR(64),
      "lastUsedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "idx_refresh_sessions_token_hash" ON "refresh_sessions" ("tokenHash");
    CREATE INDEX IF NOT EXISTS "idx_refresh_sessions_user" ON "refresh_sessions" ("userId");
    CREATE INDEX IF NOT EXISTS "idx_refresh_sessions_expires" ON "refresh_sessions" ("expiresAt");
  `);
}
