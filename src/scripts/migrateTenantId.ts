/**
 * One-time migration: populate tenantId for all existing users.
 *
 * Run once with:
 *   npx ts-node src/scripts/migrateTenantId.ts
 *
 * Safe to re-run — skips users that already have a tenantId set.
 *
 * Hierarchy assumed:
 *   super_admin  → creates → user (tenant root)
 *   user         → creates → admin
 *   admin        → creates → manager / sale_person
 */

import dotenv from "dotenv";
dotenv.config();

import { sequelize, User } from "../config/dbConnection";
import { Op } from "sequelize";

async function migrate() {
  await sequelize.authenticate();
  console.log("Connected to database.\n");

  // ── Step 1: Give every user (tenant root) tenantId = their own id ──
  const tenantRoots = await User.findAll({
    where: { role: "user" },
    attributes: ["id", "tenantId"],
  }) as any[];

  const rootsToUpdate = tenantRoots.filter((u) => !u.tenantId);
  if (rootsToUpdate.length > 0) {
    for (const root of rootsToUpdate) {
      await User.update({ tenantId: root.id }, { where: { id: root.id } });
    }
    console.log(`✅ Set tenantId=self.id for ${rootsToUpdate.length} tenant root(s).`);
  } else {
    console.log("ℹ️  All tenant roots already have tenantId set.");
  }

  // ── Step 2: Walk down from each tenant root via createdBy ──────────
  const allRoots = await User.findAll({
    where: { role: "user" },
    attributes: ["id"],
  }) as any[];

  let totalUpdated = 0;

  for (const root of allRoots) {
    const tenantId = root.id;
    const queue: number[] = [root.id];
    const visited = new Set<number>([root.id]);

    while (queue.length > 0) {
      const parentId = queue.shift()!;

      // Find all direct children of this node that don't have tenantId yet
      const children = await User.findAll({
        where: {
          createdBy: parentId,
          role: { [Op.ne]: "super_admin" },
        },
        attributes: ["id", "tenantId"],
      }) as any[];

      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);

        if (!child.tenantId) {
          await User.update({ tenantId }, { where: { id: child.id } });
          totalUpdated++;
        }

        queue.push(child.id);
      }
    }
  }

  console.log(`✅ Updated tenantId for ${totalUpdated} descendant user(s).\n`);

  // ── Step 3: Report any remaining users with no tenantId ───────────
  const orphans = await User.findAll({
    where: {
      tenantId: null,
      role: { [Op.notIn]: ["super_admin", "user"] },
    },
    attributes: ["id", "email", "role", "createdBy"],
  }) as any[];

  if (orphans.length > 0) {
    console.warn(`⚠️  ${orphans.length} user(s) could not be assigned a tenantId (no createdBy chain leads to a tenant root):`);
    orphans.forEach((u: any) => {
      console.warn(`   id=${u.id} role=${u.role} email=${u.email} createdBy=${u.createdBy}`);
    });
    console.warn("   These users were likely created before the hierarchy was set up. Update their tenantId manually.\n");
  } else {
    console.log("✅ All non-super_admin users now have a tenantId.");
  }

  await sequelize.close();
  console.log("\nMigration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
