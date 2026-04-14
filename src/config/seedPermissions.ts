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

  // ── Meeting ──────────────────────────────────────────────
  { module: "meeting", action: "view",     description: "View meetings" },
  { module: "meeting", action: "schedule", description: "Schedule / create meetings" },
  { module: "meeting", action: "join",     description: "Join meetings" },
  { module: "meeting", action: "update",   description: "Edit meeting details" },
  { module: "meeting", action: "delete",   description: "Delete meetings" },

  // ── Chat ─────────────────────────────────────────────────
  { module: "chat", action: "read", description: "Read chat messages" },
  { module: "chat", action: "send", description: "Send chat messages" },

  // ── Reports ──────────────────────────────────────────────
  { module: "report", action: "view",     description: "View reports" },
  { module: "report", action: "export",   description: "Export reports" },

  // ── Quotation ────────────────────────────────────────────
  { module: "quotation", action: "view",   description: "View quotations" },
  { module: "quotation", action: "create", description: "Create quotations" },
  { module: "quotation", action: "update", description: "Edit quotations" },
  { module: "quotation", action: "delete", description: "Delete quotations" },

  // ── Invoice ──────────────────────────────────────────────
  { module: "invoice", action: "view",   description: "View invoices" },
  { module: "invoice", action: "create", description: "Create invoices" },
  { module: "invoice", action: "update", description: "Edit invoices" },
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
