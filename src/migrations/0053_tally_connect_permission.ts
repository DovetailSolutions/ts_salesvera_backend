import { Sequelize } from "sequelize";

/**
 * tally:connect — new permission for connecting Tally (saving the Tally
 * company GUID on the profile) and pushing data from Tally (/admin/bulk/*).
 * Before this, any admin/manager could do both, so the permission is
 * backfilled to everyone who actually uses Tally today, so nothing that works
 * now stops working:
 *
 *   - users with a Tally GUID saved on their profile;
 *   - users who own Tally-synced records (invoices / quotations with a Tally
 *     guid, outstanding-report rows, Tally masters) — i.e. the accounts the
 *     Tally connector pushes as;
 *   - owners of tenants with an ACTIVE Tally add-on, so they can grant it to
 *     their admins from the permissions screen (you can only grant what you
 *     hold).
 *
 * Additive and idempotent: the permission row is inserted once, and a grant is
 * added only where the user doesn't already have it. seedPermissions also
 * creates the permission on boot; whichever runs first wins.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    INSERT INTO "permissions" ("module", "action", "description", "createdAt", "updatedAt")
    VALUES ('tally', 'connect', 'Connect Tally (save the Tally company GUID) and sync data from Tally', NOW(), NOW())
    ON CONFLICT ("module", "action") DO NOTHING;

    WITH perm AS (
      SELECT id FROM "permissions" WHERE "module" = 'tally' AND "action" = 'connect'
    ),
    targets AS (
      SELECT u.id FROM "users" u WHERE u."tallyGuid" IS NOT NULL AND u."tallyGuid" <> ''
      UNION SELECT i."userId" FROM "invoices" i WHERE i."guid" IS NOT NULL
      UNION SELECT q."userId" FROM "quotations" q WHERE q."guid" IS NOT NULL
      UNION SELECT r."userId" FROM "repost" r
      UNION SELECT m."user_id" FROM "tally_masters" m
      UNION SELECT a."userId" FROM "subscription_addons" a
              JOIN "users" o ON o.id = a."userId" AND o."role" = 'user'
              WHERE a."addonCode" = 'TALLY' AND a."status" = 'ACTIVE'
    ),
    -- Recorded as granted by the platform (first super admin); grantedBy is NOT NULL.
    grantor AS (
      SELECT id FROM "users" WHERE "role" = 'super_admin' ORDER BY id LIMIT 1
    )
    INSERT INTO "user_permissions" ("userId", "permissionId", "companyId", "grantedBy", "createdAt", "updatedAt")
    SELECT t.id, perm.id, NULL, COALESCE((SELECT id FROM grantor), t.id), NOW(), NOW()
    FROM targets t
    CROSS JOIN perm
    WHERE t.id IS NOT NULL
      AND EXISTS (SELECT 1 FROM "users" x WHERE x.id = t.id)
      AND NOT EXISTS (
        SELECT 1 FROM "user_permissions" up WHERE up."userId" = t.id AND up."permissionId" = perm.id
      );
  `);
}
