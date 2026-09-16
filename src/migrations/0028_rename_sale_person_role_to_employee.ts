import { Sequelize } from "sequelize";

/**
 * Renames the "sale_person" role to "employee" everywhere it's stored.
 *
 * users.role is a real Postgres ENUM ("enum_users_role") — renaming the
 * label in place (ALTER TYPE ... RENAME VALUE) instantly updates every
 * existing row's effective value with no per-row UPDATE and no table
 * rewrite; it's the correct tool for renaming an enum value in Postgres
 * (supported since PG10). Confirmed via the live schema that
 * "enum_users_role" is the ONLY enum type containing "sale_person", and
 * users.role is the only column using it.
 *
 * permissions.module is a plain VARCHAR (not an enum), seeded with
 * "sale-person" as the module name for the Manager Capabilities
 * create/bulk_create/view permissions (config/seedPermissions.ts). Renamed
 * to "employee" here too, IN PLACE on the original rows (same ids), so
 * every existing user_permissions grant (86 managers x 3 actions on this
 * install) keeps pointing at a valid, correctly-named permission via its
 * unchanged permissionId — never re-created, never re-granted.
 *
 * Defensive DELETE first: renaming the code's seed definitions ahead of
 * this migration meant a server boot in between auto-ran seedPermissions()
 * with the NEW "employee" module name already in the source, and
 * findOrCreate() found no existing "employee"/create|bulk_create|view row
 * yet — so it created three brand new, ungranted duplicate rows. Those
 * would collide with (and must not survive) the rename below; deleting them
 * first (they have zero grants — confirmed before writing this migration)
 * makes the rename below apply cleanly to the real, actually-granted rows.
 *
 * This does not touch permission_backfills.key ("sale-person-v1"), which is
 * a historical, already-run idempotency marker and must stay as originally
 * recorded (see the comment on BACKFILL_KEY in seedPermissions.ts).
 *
 * Everything else that said "sale_person" was TypeScript source (role
 * comparisons, RBAC arrays, comments) — updated directly in the codebase
 * alongside this migration, not something a DB migration can reach.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'sale_person'
      ) THEN
        ALTER TYPE "enum_users_role" RENAME VALUE 'sale_person' TO 'employee';
      END IF;
    END $$;
  `);

  // Remove only a duplicate "employee" permission row that has ZERO grants
  // AND an identical (action, description) counterpart still sitting under
  // "sale-person" — i.e. exactly the accidental re-seed described above,
  // never a real, in-use "employee" permission.
  await sequelize.query(`
    DELETE FROM "permissions" p
    WHERE p."module" = 'employee'
      AND NOT EXISTS (SELECT 1 FROM "user_permissions" up WHERE up."permissionId" = p.id)
      AND EXISTS (
        SELECT 1 FROM "permissions" sp
        WHERE sp."module" = 'sale-person'
          AND sp."action" = p."action"
          AND sp."description" = p."description"
      );
  `);

  await sequelize.query(`
    UPDATE "permissions" SET "module" = 'employee' WHERE "module" = 'sale-person';
  `);
}
