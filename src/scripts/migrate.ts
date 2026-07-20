/**
 * Minimal, tracked migration runner for all NEW schema needs going forward.
 *
 * Why this exists: the legacy boot path (connectDB/ensureColumns in
 * src/config/dbConnection.ts) runs a fixed set of hand-written ALTER/CREATE
 * statements unconditionally on every server start, with no history table
 * and no way to know what's already been applied. That function is frozen
 * (it interleaves Tally-table DDL) — this migration system is deliberately
 * separate from it and never touches it. Every migration file here is
 * idempotent (safe to re-run) and tracked in a `schema_migrations` table so
 * it only actually runs once.
 *
 * Migration files live in src/migrations/, named NNNN_description.ts, each
 * exporting `up(sequelize): Promise<void>`.
 *
 * Run with:
 *   npx ts-node src/scripts/migrate.ts
 */

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { sequelize } from "../config/dbConnection";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "name" VARCHAR(255) PRIMARY KEY,
      "appliedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const [rows]: any = await sequelize.query(`SELECT "name" FROM "schema_migrations";`);
  return new Set(rows.map((r: any) => r.name));
}

async function run() {
  await sequelize.authenticate();
  console.log("✅ Connected to database:", process.env.DB_NAME);

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.ts$/.test(f))
    .sort();

  let ranCount = 0;
  for (const file of files) {
    const name = file.replace(/\.ts$/, "");
    if (applied.has(name)) {
      console.log(`⏭  ${name} — already applied`);
      continue;
    }

    console.log(`▶  Running ${name}...`);
    const migration = require(path.join(MIGRATIONS_DIR, file));
    await migration.up(sequelize);
    await sequelize.query(`INSERT INTO "schema_migrations" ("name") VALUES (:name);`, {
      replacements: { name },
    });
    console.log(`✅ ${name} applied`);
    ranCount++;
  }

  console.log(ranCount === 0 ? "Nothing to migrate — up to date." : `Done — ${ranCount} migration(s) applied.`);
  await sequelize.close();
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
