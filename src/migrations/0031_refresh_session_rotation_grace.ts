import { Sequelize } from "sequelize";

/**
 * Adds refresh_sessions."replacedById" — the session row that superseded
 * this one when it was rotated (see refreshSession.service.ts's
 * rotateSession).
 *
 * Why: rotation revokes the presented row and inserts a new one, and ANY
 * later presentation of a revoked token was treated as a stolen-token
 * replay, which revokes every session the user has. That is the right
 * response to a genuine replay, but it also fired on a completely benign
 * race the app itself produces: two refreshes with the SAME cookie at the
 * same moment (several restored tabs bootstrapping together, or the
 * startup bootstrap racing the 401 interceptor). One request won, the
 * other tripped the sweep, and the sweep also killed the winner's
 * brand-new session — so reopening the browser dropped the user back on
 * the login page.
 *
 * "Revoked because it was rotated" and "revoked because the user logged
 * out / a sweep ran" are indistinguishable from revokedAt alone. This
 * column records the successor, so a short grace window can be granted to
 * the first case only — a logged-out token still never works.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "refresh_sessions" ADD COLUMN IF NOT EXISTS "replacedById" INTEGER;
  `);
}

export async function down(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "refresh_sessions" DROP COLUMN IF EXISTS "replacedById";
  `);
}
