import { Sequelize } from "sequelize";

/**
 * Asset Management — a new, independent module (see src/modules/asset/).
 * Adds four NEW tables and one business_id_sequences row; no existing table
 * is altered.
 *
 * 1. asset_categories — asset types (Laptop, Monitor, ...). Rows with
 *    companyId NULL are the shared defaults seeded below; a company can add
 *    its own. Names are unique per scope, case-insensitively.
 *
 * 2. assets — one row per physical asset, always owned by exactly one
 *    company. status/condition are constrained at the database level (CHECK)
 *    so no code path can store a value outside the allowed set. Serial
 *    numbers are unique within a company (case-insensitive, when present).
 *
 * 3. asset_assignments — append-only assignment history. A row is ACTIVE
 *    while the asset is with someone and becomes RETURNED (never deleted or
 *    overwritten) when it comes back, so reassignment keeps full history.
 *    The partial unique index "asset_assignments_one_active_per_asset" is
 *    what guarantees ONE ACTIVE HOLDER PER ASSET even under concurrent
 *    assign requests — the application check alone can't. One person may
 *    hold any number of assets.
 *
 * 4. asset_audit_log — append-only trail of asset actions (created, updated,
 *    assigned, returned, retired, deleted, category changes).
 *
 * Idempotent (IF NOT EXISTS / ON CONFLICT) like every other migration here.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
    VALUES ('asset', 'AST-', 1)
    ON CONFLICT ("entityType") DO NOTHING;
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "asset_categories" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER REFERENCES "companies"("id") ON DELETE CASCADE,
      "name" VARCHAR(80) NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "asset_categories_global_name_uq"
      ON "asset_categories" (LOWER("name")) WHERE "companyId" IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "asset_categories_company_name_uq"
      ON "asset_categories" ("companyId", LOWER("name")) WHERE "companyId" IS NOT NULL;

    INSERT INTO "asset_categories" ("companyId", "name")
    SELECT NULL, v.name FROM (VALUES
      ('Laptop'), ('Desktop'), ('Monitor'), ('Keyboard'), ('Mouse'), ('Mobile Phone'),
      ('Tablet'), ('Headset'), ('Printer'), ('ID Card'), ('SIM Card'), ('Charger'), ('Other')
    ) AS v(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM "asset_categories" c WHERE c."companyId" IS NULL AND LOWER(c."name") = LOWER(v.name)
    );
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "assets" (
      "id" SERIAL PRIMARY KEY,
      "assetCode" VARCHAR(20) NOT NULL,
      "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
      "categoryId" INTEGER NOT NULL REFERENCES "asset_categories"("id") ON DELETE RESTRICT,
      "name" VARCHAR(150) NOT NULL,
      "brand" VARCHAR(100),
      "model" VARCHAR(100),
      "serialNumber" VARCHAR(100),
      "purchaseDate" DATE,
      "purchasePrice" NUMERIC(12, 2) CHECK ("purchasePrice" IS NULL OR "purchasePrice" >= 0),
      "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK ("status" IN ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'DAMAGED', 'RETIRED')),
      "condition" VARCHAR(20) NOT NULL DEFAULT 'GOOD'
        CHECK ("condition" IN ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED')),
      "description" TEXT,
      "createdBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "updatedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "assets_asset_code_uq" ON "assets" ("assetCode");
    CREATE UNIQUE INDEX IF NOT EXISTS "assets_company_serial_uq"
      ON "assets" ("companyId", LOWER("serialNumber")) WHERE "serialNumber" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "assets_company_status_idx" ON "assets" ("companyId", "status");
    CREATE INDEX IF NOT EXISTS "assets_company_category_idx" ON "assets" ("companyId", "categoryId");
    CREATE INDEX IF NOT EXISTS "assets_company_created_idx" ON "assets" ("companyId", "createdAt" DESC);
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "asset_assignments" (
      "id" SERIAL PRIMARY KEY,
      "assetId" INTEGER NOT NULL REFERENCES "assets"("id") ON DELETE RESTRICT,
      "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
      "assignedToId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
      "assignedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "returnedAt" TIMESTAMP WITH TIME ZONE,
      "returnedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'RETURNED')),
      "conditionAtAssignment" VARCHAR(20)
        CHECK ("conditionAtAssignment" IS NULL OR "conditionAtAssignment" IN ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED')),
      "conditionAtReturn" VARCHAR(20)
        CHECK ("conditionAtReturn" IS NULL OR "conditionAtReturn" IN ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED')),
      "remarks" TEXT,
      "returnRemarks" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "asset_assignments_return_consistency" CHECK (
        ("status" = 'ACTIVE' AND "returnedAt" IS NULL) OR
        ("status" = 'RETURNED' AND "returnedAt" IS NOT NULL AND "returnedAt" >= "assignedAt")
      )
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "asset_assignments_one_active_per_asset"
      ON "asset_assignments" ("assetId") WHERE "status" = 'ACTIVE';
    CREATE INDEX IF NOT EXISTS "asset_assignments_asset_history_idx" ON "asset_assignments" ("assetId", "assignedAt" DESC);
    CREATE INDEX IF NOT EXISTS "asset_assignments_holder_idx" ON "asset_assignments" ("assignedToId", "status");
    CREATE INDEX IF NOT EXISTS "asset_assignments_company_status_idx" ON "asset_assignments" ("companyId", "status", "assignedAt" DESC);
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "asset_audit_log" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
      "assetId" INTEGER,
      "action" VARCHAR(30) NOT NULL,
      "actorId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "actorRole" VARCHAR(20),
      "targetUserId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "detail" JSONB,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "asset_audit_log_asset_idx" ON "asset_audit_log" ("assetId", "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS "asset_audit_log_company_idx" ON "asset_audit_log" ("companyId", "createdAt" DESC);
  `);
}

/**
 * Reverses this migration. The runner (scripts/migrate.ts) only ever calls
 * up(); this exists so the module can be removed deliberately by hand.
 */
export async function down(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    DROP TABLE IF EXISTS "asset_audit_log";
    DROP TABLE IF EXISTS "asset_assignments";
    DROP TABLE IF EXISTS "assets";
    DROP TABLE IF EXISTS "asset_categories";
    DELETE FROM "business_id_sequences" WHERE "entityType" = 'asset';
  `);
}
