import { Sequelize } from "sequelize";

/**
 * Department and branch codes must NOT be unique across the whole database.
 *
 * Bug: Register Company → Departments → "Save & Next" failed with a bare
 * "Validation error". A department can be assigned to several branches, and
 * the wizard saves one row per branch with the SAME deptCode — the second row
 * hit a database-wide UNIQUE("deptCode"). Any code another company already
 * used failed the same way, and branches had the identical problem with
 * UNIQUE("branchCode") (e.g. two companies both using "HO").
 *
 * The app already intends these to allow duplicates: connectDB() drops
 * "departments_deptCode_key" / "branches_branchCode_key" on every boot. But
 * the live constraints were named "..._key1" (a second copy created by an
 * earlier schema sync), so that drop never matched. This removes every
 * single-column UNIQUE constraint on those two columns, whatever its name.
 *
 * Relaxing only — no data changes. Idempotent.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT con.conrelid::regclass AS tbl, con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
        WHERE con.contype = 'u'
          AND array_length(con.conkey, 1) = 1
          AND (
            (con.conrelid = 'departments'::regclass AND att.attname = 'deptCode') OR
            (con.conrelid = 'branches'::regclass    AND att.attname = 'branchCode')
          )
      LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
        RAISE NOTICE 'dropped % on %', r.conname, r.tbl;
      END LOOP;
    END $$;
  `);
}
