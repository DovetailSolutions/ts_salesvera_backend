import { Sequelize } from "sequelize";

/**
 * Business ID system — a human-readable, prefixed, tightly-sequential
 * identifier (CMP001, ADM001, MGR001, SAL001, ATT001...) kept separate from
 * the database primary key (`id`). See businessId.service.ts for the
 * generation logic and app/model/{company,user,attendance}.ts for the
 * beforeCreate hooks that call it.
 *
 * Scope of this rollout (agreed): company, admin, manager, sale_person
 * (role-scoped prefixes on the shared `users` table), and attendance. Other
 * entity types mentioned in the wider spec (meeting, travel, device,
 * device-change-request, announcement, notification, geo-fence,
 * department, branch, subscription, payment, root user/tenant) are
 * intentionally NOT included here — see the QA report for why.
 *
 * Existing rows are backfilled in `id` order (their original creation
 * order) so CMP001 is genuinely the first company ever created, not an
 * arbitrary one — then each sequence's `nextNumber` is advanced past the
 * backfilled count so new rows continue the same numbering with no gaps
 * and no possibility of colliding with a backfilled value.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "business_id_sequences" (
      "entityType" VARCHAR(30) PRIMARY KEY,
      "prefix" VARCHAR(10) NOT NULL,
      "nextNumber" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
    VALUES
      ('company', 'CMP', 1),
      ('admin', 'ADM', 1),
      ('manager', 'MGR', 1),
      ('sale_person', 'SAL', 1),
      ('attendance', 'ATT', 1)
    ON CONFLICT ("entityType") DO NOTHING;

    -- ── companies ─────────────────────────────────────────────────────────
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "businessCode" VARCHAR(20);

    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM "companies" WHERE "businessCode" IS NULL
    )
    UPDATE "companies" c SET "businessCode" = 'CMP' || LPAD(numbered.rn::text, GREATEST(3, LENGTH(numbered.rn::text)), '0')
    FROM numbered WHERE c.id = numbered.id;

    UPDATE "business_id_sequences" SET "nextNumber" = (SELECT COUNT(*) + 1 FROM "companies"), "updatedAt" = NOW()
    WHERE "entityType" = 'company';

    CREATE UNIQUE INDEX IF NOT EXISTS "companies_business_code_idx" ON "companies" ("businessCode");

    -- ── users (admin / manager / sale_person — each numbered independently) ─
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "businessCode" VARCHAR(20);

    WITH numbered AS (
      SELECT id, role, ROW_NUMBER() OVER (PARTITION BY role ORDER BY id) AS rn
      FROM "users" WHERE role IN ('admin', 'manager', 'sale_person') AND "businessCode" IS NULL
    )
    UPDATE "users" u SET "businessCode" =
      (CASE numbered.role WHEN 'admin' THEN 'ADM' WHEN 'manager' THEN 'MGR' ELSE 'SAL' END)
      || LPAD(numbered.rn::text, GREATEST(3, LENGTH(numbered.rn::text)), '0')
    FROM numbered WHERE u.id = numbered.id;

    UPDATE "business_id_sequences" SET "nextNumber" = (SELECT COUNT(*) + 1 FROM "users" WHERE role = 'admin'), "updatedAt" = NOW()
    WHERE "entityType" = 'admin';
    UPDATE "business_id_sequences" SET "nextNumber" = (SELECT COUNT(*) + 1 FROM "users" WHERE role = 'manager'), "updatedAt" = NOW()
    WHERE "entityType" = 'manager';
    UPDATE "business_id_sequences" SET "nextNumber" = (SELECT COUNT(*) + 1 FROM "users" WHERE role = 'sale_person'), "updatedAt" = NOW()
    WHERE "entityType" = 'sale_person';

    CREATE UNIQUE INDEX IF NOT EXISTS "users_business_code_idx" ON "users" ("businessCode");

    -- ── attendance ────────────────────────────────────────────────────────
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "businessCode" VARCHAR(20);

    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM "attendance" WHERE "businessCode" IS NULL
    )
    UPDATE "attendance" a SET "businessCode" = 'ATT' || LPAD(numbered.rn::text, GREATEST(3, LENGTH(numbered.rn::text)), '0')
    FROM numbered WHERE a.id = numbered.id;

    UPDATE "business_id_sequences" SET "nextNumber" = (SELECT COUNT(*) + 1 FROM "attendance"), "updatedAt" = NOW()
    WHERE "entityType" = 'attendance';

    CREATE UNIQUE INDEX IF NOT EXISTS "attendance_business_code_idx" ON "attendance" ("businessCode");
  `);
}
