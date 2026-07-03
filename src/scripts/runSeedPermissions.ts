/**
 * One-off runner: seed the permissions table without booting the full server.
 *
 * Run with:
 *   npx ts-node src/scripts/runSeedPermissions.ts
 *
 * Safe to re-run — seedPermissions() uses findOrCreate per module+action.
 */

import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../config/dbConnection";
import { seedPermissions } from "../config/seedPermissions";

async function run() {
  await sequelize.authenticate();
  console.log("Connected to database.\n");

  await seedPermissions();

  await sequelize.close();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
