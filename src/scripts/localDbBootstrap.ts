/**
 * One-time LOCAL DEV bootstrap: creates the full set of base tables on a
 * brand-new, empty database from the (unmodified) Sequelize model
 * definitions in dbConnection.ts.
 *
 * Why this exists: the normal boot path (connectDB -> ensureColumns/
 * fixConstraints/ensureDataIntegrity in src/config/dbConnection.ts) only
 * ALTERs tables that already exist, plus a short explicit CREATE TABLE IF
 * NOT EXISTS list for a handful of tables — it assumes it's running against
 * an already-populated database (e.g. the shared cloud instance) and was
 * never meant to create a schema from scratch. On a fresh local database
 * most tables (users, companies, meeting_companies, chat_rooms, etc.) don't
 * exist yet, so that boot path errors out on every ALTER TABLE.
 *
 * This script only calls sequelize.sync() — standard Sequelize table
 * creation from the existing model definitions — and does not modify
 * dbConnection.ts or any model file. It is NOT wired into server startup;
 * run it manually, once, against a fresh local database only.
 *
 * Run with:
 *   npx ts-node src/scripts/localDbBootstrap.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../config/dbConnection";

async function bootstrap() {
  if (process.env.DB_HOST !== "127.0.0.1" && process.env.DB_HOST !== "localhost") {
    console.error(
      "❌ Refusing to run: DB_HOST is not localhost/127.0.0.1. " +
        "This script is for bootstrapping a fresh LOCAL dev database only."
    );
    process.exit(1);
  }

  await sequelize.authenticate();
  console.log("✅ Connected to local database:", process.env.DB_NAME);

  console.log("Creating tables from model definitions (sync, no alter)...");
  await sequelize.sync();
  console.log("✅ Base schema created. You can now run `npm run dev` normally.");

  await sequelize.close();
}

bootstrap().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});
