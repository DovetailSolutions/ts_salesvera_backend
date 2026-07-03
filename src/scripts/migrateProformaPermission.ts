/**
 * One-time migration: move users holding the old "invoice:proforma" permission
 * (from before proforma invoice was split into its own "proformainvoice" module)
 * over to the new "proformainvoice:create" permission, then remove the old row.
 *
 * Run with:
 *   npx ts-node src/scripts/migrateProformaPermission.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../config/dbConnection";
import { Permission } from "../app/model/permission";
import { UserPermission } from "../app/model/userPermission";
import { invalidatePermissionCache } from "../config/permissionCache";

async function migrate() {
  await sequelize.authenticate();
  console.log("Connected to database.\n");

  const oldPerm = await Permission.findOne({ where: { module: "invoice", action: "proforma" } });
  const newPerm = await Permission.findOne({ where: { module: "proformainvoice", action: "create" } });

  if (!oldPerm) {
    console.log("No old 'invoice:proforma' permission found — nothing to migrate.");
    await sequelize.close();
    return;
  }
  if (!newPerm) {
    throw new Error("'proformainvoice:create' not found — run seedPermissions first.");
  }

  const oldAssignments = await UserPermission.findAll({ where: { permissionId: oldPerm.id } });

  const uniqueUserIds = [...new Set(oldAssignments.map((a: any) => a.userId))];
  console.log(`Found ${oldAssignments.length} assignment row(s) across ${uniqueUserIds.length} unique user(s).`);

  // Preserve each row's companyId scope (nullable, part of the unique index) —
  // a user can hold both a null-scoped and one or more company-scoped grants.
  let granted = 0;
  for (const row of oldAssignments as any[]) {
    const [, wasCreated] = await UserPermission.findOrCreate({
      where: { userId: row.userId, permissionId: newPerm.id, companyId: row.companyId ?? null },
      defaults: {
        userId: row.userId,
        permissionId: newPerm.id,
        companyId: row.companyId ?? null,
        grantedBy: row.grantedBy,
      },
    });
    if (wasCreated) granted++;
  }
  for (const userId of uniqueUserIds) {
    invalidatePermissionCache(userId as number);
  }
  console.log(`✅ Granted 'proformainvoice:create' to ${granted} new row(s) (${oldAssignments.length - granted} already existed).`);

  const deleted = await UserPermission.destroy({ where: { permissionId: oldPerm.id } });
  console.log(`✅ Removed ${deleted} old 'invoice:proforma' assignment row(s).`);

  await oldPerm.destroy();
  console.log("✅ Deleted the old 'invoice:proforma' permission definition.");

  await sequelize.close();
  console.log("\nMigration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
