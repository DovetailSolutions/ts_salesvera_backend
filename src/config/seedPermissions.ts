import { Permission } from "../app/model/permission";
import { User, UserPermission, sequelize } from "./dbConnection";
import { Op } from "sequelize";

// ============================================================
// Permission Seeder
// Seeds all module+action combinations into the `permissions` table.
// Uses findOrCreate so it's SAFE to run on every server start.
// Add new modules/actions here as the app grows.
// ============================================================

export const PERMISSION_SEEDS = [
  // ── Attendance ──────────────────────────────────────────
  { module: "attendance", action: "view",   description: "View attendance records" },
  { module: "attendance", action: "create", description: "Mark / create attendance" },
  { module: "attendance", action: "update", description: "Edit attendance records" },
  { module: "attendance", action: "delete", description: "Delete attendance records" },

  // ── Expense ─────────────────────────────────────────────
  { module: "expense", action: "view",    description: "View expense reports" },
  { module: "expense", action: "create",  description: "Submit expense reports" },
  { module: "expense", action: "update",  description: "Edit expense reports" },
  { module: "expense", action: "approve", description: "Approve expense reports" },
  { module: "expense", action: "reject",  description: "Reject expense reports" },

  // ── Leave ────────────────────────────────────────────────
  { module: "leave", action: "view",    description: "View leave requests" },
  { module: "leave", action: "apply",   description: "Apply for leave" },
  { module: "leave", action: "approve", description: "Approve leave requests" },
  { module: "leave", action: "reject",  description: "Reject leave requests" },
  { module: "leave", action: "delete",  description: "Delete leave requests" },
  // FIX: added leave:manage for admin-level policy CRUD (add/view company leave types)
  { module: "leave", action: "manage",  description: "Manage company leave policies (types, rules)" },

  // ── Meeting ──────────────────────────────────────────────
  { module: "meeting", action: "view",     description: "View meetings" },
  { module: "meeting", action: "schedule", description: "Schedule / create meetings" },
  { module: "meeting", action: "join",     description: "Join meetings" },
  { module: "meeting", action: "update",   description: "Edit meeting details" },
  { module: "meeting", action: "delete",   description: "Delete meetings" },

  // ── Chat ─────────────────────────────────────────────────
  { module: "chat", action: "read", description: "Read chat messages" },
  { module: "chat", action: "send", description: "Send chat messages" },

  // ── Reports (Tally proforma/sales — frozen feature) ──────
  { module: "report", action: "view",     description: "View reports" },
  { module: "report", action: "export",   description: "Export reports" },

  // ── Insights (attendance/leave/meeting/KPI download reports —
  // deliberately a separate module from "report" above, which is fully
  // owned by the Tally proforma/sales-report feature) ─────
  { module: "insights", action: "view", description: "View and download attendance/leave/meeting/KPI reports" },

  // ── Quotation ────────────────────────────────────────────
  { module: "quotation", action: "view",   description: "View quotations" },
  { module: "quotation", action: "create", description: "Create quotations" },
  { module: "quotation", action: "update", description: "Edit quotations" },
  { module: "quotation", action: "delete", description: "Delete quotations" },

  // ── Invoice ──────────────────────────────────────────────
  { module: "invoice", action: "view",   description: "View invoices" },
  { module: "invoice", action: "create", description: "Create invoices" },
  { module: "invoice", action: "update", description: "Edit invoices" },

  // ── Proforma Invoice ────────────────────────────────────
  // Separate module (not nested under "invoice") so it can be managed/assigned
  // independently in the permission matrix. Used when addinvoice is called
  // with status "draft" (or no status, which also defaults to draft).
  { module: "proformainvoice", action: "create", description: "Create proforma invoice (status: draft)" },
  // ── Proforma Invoice ────────────────────────────────────
{
  module: "proformainvoice",
  action: "view",
  status: "draft",
  description: "View proforma invoices (status: draft)",
},

{
  module: "proformainvoice",
  action: "update",
  status: "draft",
  description: "Edit proforma invoices (status: draft)",
},
{
  module: "proformainvoice",
  action: "delete",
  status: "draft",
  description: "Delete proforma invoices (status: draft)",
},
  // ── Task ─────────────────────────────────────────────────
  { module: "task", action: "create", description: "Create tasks" },
  { module: "task", action: "view",   description: "View task list and task details" },
  { module: "task", action: "update", description: "Update tasks" },
  { module: "task", action: "delete", description: "Delete tasks" },

  // ── Notification ─────────────────────────────────────────
  { module: "notification", action: "view",      description: "View notifications and unread count" },
  { module: "notification", action: "mark_read", description: "Mark notifications as read (single or all)" },
  { module: "notification", action: "delete",    description: "Delete notifications (single or all)" },

  // ── Profile ──────────────────────────────────────────────
  { module: "profile", action: "view",   description: "View own profile" },

  // ── Attendance Security (photo capture, device binding, punch-out
  // geofencing — see modules/attendanceSecurity) ───────────
  { module: "attendance-security", action: "view", description: "View attendance security settings, device requests, and audit log" },
  { module: "attendance-security", action: "update", description: "Update per-user or bulk attendance security settings" },
  { module: "attendance-security", action: "device-review", description: "Approve, reject, or revoke attendance device-change requests" },

  // ── Announcement ─────────────────────────────────────────
  { module: "announcement", action: "create", description: "Create and send announcements to team members below you in the hierarchy" },
  { module: "announcement", action: "view",   description: "View sent and received announcements" },
  { module: "announcement", action: "cancel", description: "Cancel a draft/scheduled announcement before delivery" },

  // ── Attendance Regularization (missed punch / client visit / WFH
  // correction requests — see modules/attendanceRegularization) ─────
  { module: "attendance-regularization", action: "view", description: "View attendance regularization requests and their audit trail" },
  { module: "attendance-regularization", action: "review", description: "Approve or reject attendance regularization requests" },

  // ── Employee Profile (SalaryBox-derived additional details — job title,
  // addresses, government IDs, emergency contact, education, etc. — see
  // modules/employeeProfile). Editing your OWN record needs no permission
  // (self-service, same as attendance-regularization's /my routes); these
  // gate viewing/editing SOMEONE ELSE's record. ─────
  { module: "employee-profile", action: "view",   description: "View another team member's additional employee details" },
  { module: "employee-profile", action: "update", description: "Edit another team member's additional employee details" },

  // ── Bank Account (per-employee bank accounts — see
  // modules/employeeProfile). Kept separate from employee-profile so a
  // company can grant profile access without exposing bank data. ─────
  { module: "bank-account", action: "view",   description: "View another team member's bank accounts (masked)" },
  { module: "bank-account", action: "manage", description: "Add, edit, deactivate, or reveal another team member's bank accounts" },

  // ── Sale Person (manager managing their own team roster) — previously
  // role-gated only (every manager could always do this, unconditionally,
  // with no way for admin to revoke it per manager). "view" covers both
  // listing the team and viewing one member's details — they are the same
  // underlying endpoint (GET /admin/mysaleperson), not two separate
  // features. Admin/super_admin/user are never gated by this — see
  // authorizeManagerSalePersonAction in app/controller/admin.ts.
  { module: "sale-person", action: "create",      description: "Register a new Sale Person account reporting to this Manager" },
  { module: "sale-person", action: "bulk_create", description: "Register multiple Sale Persons at once via CSV upload" },
  { module: "sale-person", action: "view",        description: "View the list and details of Sale Persons reporting to this Manager" },
];

export const seedPermissions = async (): Promise<void> => {
  console.log("🌱 Seeding permissions table...");
  let created = 0;
  let existing = 0;

  for (const seed of PERMISSION_SEEDS) {
    const [, wasCreated] = await Permission.findOrCreate({
      where: { module: seed.module, action: seed.action },
      defaults: { module: seed.module, action: seed.action, description: seed.description },
    });
    wasCreated ? created++ : existing++;
  }

  console.log(
    `✅ Permissions seeded: ${created} new, ${existing} already existed (total=${PERMISSION_SEEDS.length})`
  );
};

// ============================================================
// One-time backfill: "sale-person" create/bulk_create/view used to be pure
// role gates (every manager could always do these, unconditionally — see
// the former roleCapabilityCatalog.ts entries). Now that
// authorizeManagerSalePersonAction actually checks these permissions,
// every EXISTING manager needs them granted here so nobody loses access
// they already had on deploy — only NEW managers created after this ships
// start with a clean slate an admin can configure via Manager
// Capabilities.
//
// Also backfills every existing admin/super_admin/user account — their OWN
// create/bulk_create/view access was never gated by this permission (see
// authorizeManagerSalePersonAction — it only ever checks role==="manager"),
// but the permission-assign endpoint refuses to let anyone delegate a
// permission they don't hold themselves, so without this an admin could
// never grant/revoke these for a manager via Manager Capabilities at all.
//
// Runs at most ONCE per installation, tracked via "permission_backfills"
// (not "on every boot" — unlike this file's idempotent-by-construction
// PERMISSION_SEEDS loop above, this is a one-time DATA migration, not a
// standing invariant. If it re-ran on every boot it would silently UNDO
// any admin's later, deliberate revoke of these permissions the next time
// the server restarts — the exact opposite of making them revocable).
// ============================================================
const BACKFILL_KEY = "sale-person-v1";

export const backfillManagerSalePersonPermissions = async (): Promise<void> => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "permission_backfills" (
      "key" VARCHAR(100) PRIMARY KEY,
      "ranAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const [alreadyRan] = await sequelize.query(
    `SELECT 1 FROM "permission_backfills" WHERE "key" = :key`,
    { replacements: { key: BACKFILL_KEY } }
  );
  if ((alreadyRan as any[]).length > 0) return;

  const perms = await Permission.findAll({ where: { module: "sale-person" } });
  if (perms.length === 0) return;

  const users = await User.findAll({
    where: { role: { [Op.in]: ["manager", "admin", "super_admin", "user"] } },
    attributes: ["id"],
  });
  if (users.length === 0) return;

  const userIds = users.map((u: any) => u.id);
  const permIds = perms.map((p: any) => p.id);

  const existing = await UserPermission.findAll({
    where: { userId: { [Op.in]: userIds }, permissionId: { [Op.in]: permIds } },
    attributes: ["userId", "permissionId"],
  });
  const existingKeys = new Set((existing as any[]).map((r) => `${r.userId}:${r.permissionId}`));

  // grantedBy is NOT NULL at the DB level despite the model's allowNull:
  // true (schema drift) — self-referential (each user "grants it to
  // themselves") is a reasonable audit value for a system backfill; it's
  // never read by enforcement (loadUserPermissionsFromDB doesn't select
  // it), only shown in permission-management UI history.
  const rows: any[] = [];
  for (const userId of userIds) {
    for (const permId of permIds) {
      if (!existingKeys.has(`${userId}:${permId}`)) {
        rows.push({ userId, permissionId: permId, companyId: null, grantedBy: userId });
      }
    }
  }

  if (rows.length > 0) {
    await UserPermission.bulkCreate(rows);
  }

  await sequelize.query(
    `INSERT INTO "permission_backfills" ("key") VALUES (:key) ON CONFLICT DO NOTHING`,
    { replacements: { key: BACKFILL_KEY } }
  );

  console.log(
    `✅ Sale Person permissions backfilled (one-time): ${rows.length} grant(s) added for ${userIds.length} existing manager/admin/super_admin/user account(s)`
  );
};
