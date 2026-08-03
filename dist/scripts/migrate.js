"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dbConnection_1 = require("../config/dbConnection");
const MIGRATIONS_DIR = path_1.default.join(__dirname, "..", "migrations");
function ensureMigrationsTable() {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbConnection_1.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "name" VARCHAR(255) PRIMARY KEY,
      "appliedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
    });
}
function getAppliedMigrations() {
    return __awaiter(this, void 0, void 0, function* () {
        const [rows] = yield dbConnection_1.sequelize.query(`SELECT "name" FROM "schema_migrations";`);
        return new Set(rows.map((r) => r.name));
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbConnection_1.sequelize.authenticate();
        console.log("✅ Connected to database:", process.env.DB_NAME);
        yield ensureMigrationsTable();
        const applied = yield getAppliedMigrations();
        const files = fs_1.default
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
            const migration = require(path_1.default.join(MIGRATIONS_DIR, file));
            yield migration.up(dbConnection_1.sequelize);
            yield dbConnection_1.sequelize.query(`INSERT INTO "schema_migrations" ("name") VALUES (:name);`, {
                replacements: { name },
            });
            console.log(`✅ ${name} applied`);
            ranCount++;
        }
        console.log(ranCount === 0 ? "Nothing to migrate — up to date." : `Done — ${ranCount} migration(s) applied.`);
        yield dbConnection_1.sequelize.close();
    });
}
run().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
