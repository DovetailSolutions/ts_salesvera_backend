"use strict";
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
const dbConnection_1 = require("../config/dbConnection");
const sequelize_1 = require("sequelize");
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbConnection_1.sequelize.authenticate();
        console.log("Connected to database.\n");
        // ── Step 1: Give every user (tenant root) tenantId = their own id ──
        const tenantRoots = yield dbConnection_1.User.findAll({
            where: { role: "user" },
            attributes: ["id", "tenantId"],
        });
        const rootsToUpdate = tenantRoots.filter((u) => !u.tenantId);
        if (rootsToUpdate.length > 0) {
            for (const root of rootsToUpdate) {
                yield dbConnection_1.User.update({ tenantId: root.id }, { where: { id: root.id } });
            }
            console.log(`✅ Set tenantId=self.id for ${rootsToUpdate.length} tenant root(s).`);
        }
        else {
            console.log("ℹ️  All tenant roots already have tenantId set.");
        }
        // ── Step 2: Walk down from each tenant root via createdBy ──────────
        const allRoots = yield dbConnection_1.User.findAll({
            where: { role: "user" },
            attributes: ["id"],
        });
        let totalUpdated = 0;
        for (const root of allRoots) {
            const tenantId = root.id;
            const queue = [root.id];
            const visited = new Set([root.id]);
            while (queue.length > 0) {
                const parentId = queue.shift();
                // Find all direct children of this node that don't have tenantId yet
                const children = yield dbConnection_1.User.findAll({
                    where: {
                        createdBy: parentId,
                        role: { [sequelize_1.Op.ne]: "super_admin" },
                    },
                    attributes: ["id", "tenantId"],
                });
                for (const child of children) {
                    if (visited.has(child.id))
                        continue;
                    visited.add(child.id);
                    if (!child.tenantId) {
                        yield dbConnection_1.User.update({ tenantId }, { where: { id: child.id } });
                        totalUpdated++;
                    }
                    queue.push(child.id);
                }
            }
        }
        console.log(`✅ Updated tenantId for ${totalUpdated} descendant user(s).\n`);
        // ── Step 3: Report any remaining users with no tenantId ───────────
        const orphans = yield dbConnection_1.User.findAll({
            where: {
                tenantId: null,
                role: { [sequelize_1.Op.notIn]: ["super_admin", "user"] },
            },
            attributes: ["id", "email", "role", "createdBy"],
        });
        if (orphans.length > 0) {
            console.warn(`⚠️  ${orphans.length} user(s) could not be assigned a tenantId (no createdBy chain leads to a tenant root):`);
            orphans.forEach((u) => {
                console.warn(`   id=${u.id} role=${u.role} email=${u.email} createdBy=${u.createdBy}`);
            });
            console.warn("   These users were likely created before the hierarchy was set up. Update their tenantId manually.\n");
        }
        else {
            console.log("✅ All non-super_admin users now have a tenantId.");
        }
        yield dbConnection_1.sequelize.close();
        console.log("\nMigration complete.");
    });
}
migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
