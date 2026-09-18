// ============================================================
// Asset Management — the single source of truth for status/condition values
// on the application side. The database enforces the same sets via CHECK
// constraints (migration 0030_asset_management.ts); the frontend reads them
// from GET /admin/assets/meta instead of keeping its own copy.
// ============================================================

export const ASSET_STATUSES = ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "LOST", "DAMAGED", "RETIRED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const ASSIGNMENT_STATUSES = ["ACTIVE", "RETURNED"] as const;

// Statuses an admin may set through the generic edit form. ASSIGNED is only
// ever reached through the assign workflow, and an asset that is currently
// ASSIGNED can only leave that state through the return workflow.
export const EDITABLE_STATUSES: AssetStatus[] = ["AVAILABLE", "MAINTENANCE", "LOST", "DAMAGED", "RETIRED"];

// Only an AVAILABLE asset can be assigned — MAINTENANCE/LOST/DAMAGED/RETIRED
// must first be moved back to AVAILABLE explicitly.
export const ASSIGNABLE_STATUS: AssetStatus = "AVAILABLE";

// Roles an asset can be assigned to. One person can hold many assets; one
// asset has at most one ACTIVE holder.
export const ASSIGNEE_ROLES = ["employee", "manager"] as const;

export const ASSET_AUDIT_ACTIONS = [
  "ASSET_CREATED",
  "ASSET_UPDATED",
  "ASSET_ASSIGNED",
  "ASSET_RETURNED",
  "ASSET_RETIRED",
  "ASSET_DELETED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DELETED",
] as const;
export type AssetAuditAction = (typeof ASSET_AUDIT_ACTIONS)[number];

// Notification `data.kind` values — carried on the existing "system"
// notification type, same as attendance-regularization notifications.
export const ASSET_NOTIFICATION_KINDS = {
  ASSIGNED: "asset_assigned",
  RETURNED: "asset_returned",
} as const;

export const ASSET_CODE_SEQUENCE = "asset";
export const ASSET_CODE_PAD_WIDTH = 6;
