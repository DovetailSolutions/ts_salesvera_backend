import { Permission } from "../app/model/permission";

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
