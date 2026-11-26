import { Sequelize } from "sequelize";

/**
 * Per-user login channel (web / mobile app / both).
 *
 *   users."loginAccess"  'both' (default) | 'web' | 'mobile'
 *
 * Set by an admin / owner for their own managers and employees (Employee
 * Management → "Login Access"). Enforced at web login (/admin/login,
 * /admin/refreshtoken), mobile login (/api/login, /api/refreshtoken) and on
 * every request (tokenCheck, via the token's "ch" claim) — see
 * modules/shared/loginAccess.ts. Default 'both' = nobody's access changes
 * until an admin restricts it.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginAccess" VARCHAR(10) NOT NULL DEFAULT 'both';
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_login_access_check') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_login_access_check" CHECK ("loginAccess" IN ('both', 'web', 'mobile'));
      END IF;
    END $$;
  `);
}
