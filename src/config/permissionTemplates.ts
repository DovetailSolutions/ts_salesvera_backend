// ============================================================
// Default permission bundles per role — applied as a starting point when
// onboarding a new user during company registration, instead of a blank
// permission matrix the admin has to hand-check module by module every
// time. These are only a starting point: the existing permission matrix
// UI still lets an admin add/remove anything afterward.
//
// Deliberately excludes quotation/invoice/proformainvoice (Tally-linked
// modules) — those stay a deliberate opt-in via the existing UI rather
// than an automatic grant, since they carry real accounting consequences.
// ============================================================

type ModuleAction = [module: string, action: string];

const ADMIN_TEMPLATE: ModuleAction[] = [
  ["attendance", "view"], ["attendance", "create"], ["attendance", "update"], ["attendance", "delete"],
  ["expense", "view"], ["expense", "create"], ["expense", "update"], ["expense", "approve"], ["expense", "reject"],
  ["leave", "view"], ["leave", "apply"], ["leave", "approve"], ["leave", "reject"], ["leave", "delete"], ["leave", "manage"],
  ["meeting", "view"], ["meeting", "schedule"], ["meeting", "join"], ["meeting", "update"], ["meeting", "delete"],
  ["chat", "read"], ["chat", "send"],
  ["report", "view"], ["report", "export"],
  ["task", "create"], ["task", "view"], ["task", "update"], ["task", "delete"],
  ["notification", "view"], ["notification", "mark_read"], ["notification", "delete"],
  ["profile", "view"],
];

export const PERMISSION_TEMPLATES: Record<string, ModuleAction[]> = {
  // "user" is the tenant root created during super_admin onboarding — needs
  // the same breadth as admin since every admin they later create inherits
  // from this set (see admin.ts Register — new admins inherit their
  // creator's permissions).
  user: ADMIN_TEMPLATE,
  admin: ADMIN_TEMPLATE,

  manager: [
    ["attendance", "view"], ["attendance", "create"], ["attendance", "update"],
    ["expense", "view"], ["expense", "approve"], ["expense", "reject"],
    ["leave", "view"], ["leave", "apply"], ["leave", "approve"], ["leave", "reject"],
    ["meeting", "view"], ["meeting", "schedule"], ["meeting", "join"], ["meeting", "update"],
    ["chat", "read"], ["chat", "send"],
    ["report", "view"],
    ["task", "create"], ["task", "view"], ["task", "update"],
    ["notification", "view"], ["notification", "mark_read"],
    ["profile", "view"],
  ],

  sale_person: [
    // "update" is required alongside "create" because punch-out (like
    // punch-in) is a self-service action a sale_person performs on their
    // own attendance record — without it they could punch in but never out.
    ["attendance", "view"], ["attendance", "create"], ["attendance", "update"],
    ["expense", "view"], ["expense", "create"],
    ["leave", "view"], ["leave", "apply"],
    ["meeting", "view"], ["meeting", "schedule"], ["meeting", "join"],
    ["chat", "read"], ["chat", "send"],
    ["task", "view"], ["task", "update"],
    ["notification", "view"], ["notification", "mark_read"],
    ["profile", "view"],
  ],
};
