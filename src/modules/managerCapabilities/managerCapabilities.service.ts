import { Op } from "sequelize";
import { User, Company, Permission, UserPermission, CompanyManager } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getOrgWideUserIdsForCaller } from "../shared/userHierarchy";
import { ROLE_CAPABILITY_CATALOG, CAPABILITY_ALIASES } from "./roleCapabilityCatalog";

// ============================================================
// Manager Capabilities — Admin-only audit/visibility feature.
//
// Source of truth (nothing here is a second permission system):
//   - permissions / user_permissions tables — same models
//     app/controller/permission.ts's getAllPermissions/getUserPermissions
//     already read, via the exact same Sequelize query shape.
//   - checkPermission.ts's own attendance-security / attendance-regularization
//     fallback rules — reimplemented here (isEffectivelyGranted) so "does the
//     manager actually get through the gate" matches production exactly,
//     not just "does a matching permissions row exist".
//   - roleCapabilityCatalog.ts — a small, evidence-cited list of actions the
//     app gates purely by role (authorizeRoles), which the permissions table
//     doesn't cover at all.
//
// Company scoping mirrors getUserPermissions in app/controller/permission.ts
// exactly: getOrgWideUserIdsForCaller(callerId, role, callerCompanyId) must include
// the target manager, or super_admin.
// ============================================================

const MODULE_LABELS: Record<string, string> = {
  attendance: "Attendance",
  expense: "Expense",
  leave: "Leave",
  meeting: "Meetings",
  chat: "Chat",
  report: "Reports",
  insights: "Insights",
  quotation: "Quotations",
  invoice: "Invoices",
  proformainvoice: "Proforma Invoices",
  task: "Tasks",
  notification: "Notifications",
  profile: "Profile",
  "attendance-security": "Attendance Security",
  announcement: "Announcements",
  "attendance-regularization": "Attendance Regularization",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  approve: "Approve",
  reject: "Reject",
  apply: "Apply",
  manage: "Manage",
  schedule: "Schedule",
  join: "Join",
  read: "Read",
  send: "Send",
  export: "Export",
  mark_read: "Mark as Read",
  "device-review": "Review Device Requests",
  review: "Review",
  cancel: "Cancel",
};

const PERMISSION_API_MAP: Record<string, string> = {
  "attendance:view": "GET /admin/user-attendance, GET /admin/attendance-book",
  "attendance:create": "POST /admin/mark-attendance-present",
  "attendance:update": "POST /admin/bulk-mark-attendance",
  "attendance:delete": "DELETE /admin/attendance/:id",
  "attendance-regularization:view": "GET /api/attendance-regularization",
  "attendance-regularization:review": "PATCH /api/attendance-regularization/:id/review",
  "attendance-security:view": "GET /api/attendance-security/device-change-requests",
  "attendance-security:update": "PATCH /api/attendance-security/update",
  "attendance-security:device-review": "PATCH /api/attendance-security/device-change-requests/:id/review",
  "leave:view": "GET /admin/get-leave-list, GET /admin/leave-balance-list",
  "leave:apply": "POST /admin/add-leave",
  "leave:approve": "POST /admin/approved-leave",
  "leave:reject": "POST /admin/rejected-leave",
  "leave:delete": "DELETE /admin/delete-leave/:id",
  "leave:manage": "POST /admin/assign-leave-balance",
  "expense:view": "GET /admin/getexpense",
  "expense:create": "POST /admin/addexpense, POST /admin/addexpance",
  "expense:update": "PATCH /admin/update-expense",
  "expense:approve": "PATCH /admin/approved-expense",
  "expense:reject": "PATCH /admin/approved-expense (status: reject)",
  "meeting:view": "GET /admin/get-meeting",
  "meeting:schedule": "POST /admin/assign-meeting",
  "meeting:join": "WebSocket /meeting or meeting room link",
  "meeting:update": "PATCH /admin/update-meeting/:id",
  "meeting:delete": "DELETE /admin/delete-meeting/:id",
  "chat:read": "WebSocket /chat message history",
  "chat:send": "WebSocket /chat send message",
  "announcement:create": "POST /api/announcements",
  "announcement:view": "GET /api/announcements",
  "announcement:cancel": "PATCH /api/announcements/:id/cancel",
  "task:view": "GET /admin/task",
  "task:create": "POST /admin/task",
  "task:update": "PATCH /admin/task/:id",
  "task:delete": "DELETE /admin/task/:id",
  "report:view": "GET /admin/reports",
  "report:export": "GET /admin/reports/export",
  "insights:view": "GET /admin/insights",
  "quotation:view": "GET /admin/getquotation",
  "quotation:create": "POST /admin/add/quotation",
  "quotation:update": "PATCH /admin/update/quotation/:id",
  "quotation:delete": "DELETE /admin/delete/quotation/:id",
  "invoice:view": "GET /admin/getinvoice",
  "invoice:create": "POST /admin/add-invoice",
  "invoice:update": "PATCH /admin/update-invoice/:id",
  "proformainvoice:view": "GET /admin/getinvoice (status: draft)",
  "proformainvoice:create": "POST /admin/add-invoice (status: draft)",
  "proformainvoice:update": "PATCH /admin/update-invoice/:id (draft)",
  "proformainvoice:delete": "DELETE /admin/delete-invoice/:id",
  "notification:view": "GET /admin/notifications",
  "notification:mark_read": "PATCH /admin/notifications/mark-read",
  "notification:delete": "DELETE /admin/notifications/:id",
  "profile:view": "GET /api/getprofile",
};

const humanizeModule = (m: string) => MODULE_LABELS[m] || m;
const humanizeAction = (a: string) => ACTION_LABELS[a] || a;

// Mirrors checkPermission.ts's own fallback rules exactly — a manager with
// attendance:view/attendance:update effectively passes the
// attendance-security / attendance-regularization gates too, even with no
// explicit grant for those modules. Reporting plain "not allowed" here
// (i.e. only checking for an exact row) would make the audit page disagree
// with what the API actually does.
const isEffectivelyGranted = (granted: Set<string>, module: string, action: string): boolean => {
  if (granted.has(`${module}:${action}`)) return true;
  if (module === "attendance-security" || module === "attendance-regularization") {
    return (
      granted.has(`attendance:${action}`) || granted.has("attendance:view") || granted.has("attendance:update")
    );
  }
  return false;
};

/**
 * Returns managers belonging strictly to the caller's company.
 * Super Admin sees all active managers. Admin sees only managers assigned or
 * created within their company.
 */
export const getCompanyManagers = async (
  loggedInId: number,
  role: string | undefined,
  callerCompanyId: number | null
) => {
  if (role !== "super_admin" && !callerCompanyId) {
    return [];
  }

  if (role === "super_admin") {
    const allManagers: any[] = await User.findAll({
      where: { role: "manager", status: { [Op.ne]: "delete" } },
      attributes: ["id", "firstName", "lastName", "email", "phone", "status", "employeeCode"],
      order: [["firstName", "ASC"]],
    });
    return allManagers.map((m) => ({
      id: m.id,
      name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email,
      email: m.email,
      phone: m.phone,
      status: m.status === "active" ? "Active" : m.status === "deActive" ? "Inactive" : m.status,
      employeeCode: m.employeeCode || null,
    }));
  }

  // 1. Managers explicitly linked via company_managers table
  const assignments: any[] = await (CompanyManager as any).findAll({
    where: { companyId: callerCompanyId },
    include: [
      {
        model: User,
        as: "manager",
        attributes: ["id", "firstName", "lastName", "email", "phone", "status", "employeeCode"],
      },
    ],
  });

  const assignedManagers = assignments
    .map((a) => a.manager)
    .filter(Boolean)
    .filter((m) => m.status !== "delete");

  // 2. Managers within the company-scoped org hierarchy
  const orgIds = await getOrgWideUserIdsForCaller(loggedInId, String(role), callerCompanyId);
  const orgManagers: any[] = await User.findAll({
    where: {
      id: { [Op.in]: orgIds },
      role: "manager",
      status: { [Op.ne]: "delete" },
    },
    attributes: ["id", "firstName", "lastName", "email", "phone", "status", "employeeCode"],
  });

  // Deduplicate by user ID
  const map = new Map<number, any>();
  for (const m of [...assignedManagers, ...orgManagers]) {
    map.set(m.id, {
      id: m.id,
      name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email,
      email: m.email,
      phone: m.phone,
      status: m.status === "active" ? "Active" : m.status === "deActive" ? "Inactive" : m.status,
      employeeCode: m.employeeCode || null,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const getManagerCapabilities = async (
  loggedInId: number,
  role: string | undefined,
  callerCompanyId: number | null,
  managerId: number
) => {
  if (!managerId || Number.isNaN(managerId)) {
    throw new ServiceError("A valid managerId is required");
  }

  const targetUser: any = await User.findOne({
    where: { id: managerId },
    attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status", "employeeCode", "createdAt"],
  });

  if (!targetUser || targetUser.role !== "manager") {
    throw new ServiceError("Manager not found", 404);
  }

  // Same company-isolation convention as getUserPermissions in
  // app/controller/permission.ts — super_admin is exempt (platform-wide by
  // design), everyone else must have this manager inside their own
  // company-scoped org, never trusting anything the client sent beyond the
  // JWT-resolved role/companyId.
  if (role !== "super_admin") {
    const orgIds = await getOrgWideUserIdsForCaller(loggedInId, String(role), callerCompanyId);
    if (!orgIds.includes(managerId)) {
      throw new ServiceError("You are not authorized to view this manager's capabilities", 403);
    }
  }

  const companyName = callerCompanyId
    ? ((await Company.findByPk(callerCompanyId, { attributes: ["companyName"] })) as any)?.companyName ?? null
    : null;

  const [allPermissions, grantedRecords] = await Promise.all([
    Permission.findAll({ order: [["module", "ASC"], ["action", "ASC"]] }),
    UserPermission.findAll({
      where: { userId: managerId },
      include: [{ model: Permission, as: "permission", attributes: ["module", "action"] }],
    }),
  ]);

  const granted = new Set(
    (grantedRecords as any[]).map((r) => `${r.permission.module}:${r.permission.action}`)
  );

  type CapabilityRow = {
    key: string;
    permissionId: number | null;
    module: string;
    action: string;
    label: string;
    description: string | null;
    permissionKey: string | null;
    source: "Permission" | "Role Authorization";
    allowed: boolean;
    editable: boolean;
    evidence: string;
    api: string;
  };

  const capabilities: CapabilityRow[] = [];

  // ── 1. Every real Permission-table row — the primary, data-driven part
  // of the audit. Nothing here is hand-picked; it's every module+action the
  // application actually has registered.
  for (const p of allPermissions as any[]) {
    const key = `${p.module}:${p.action}`;
    capabilities.push({
      key: `perm:${key}`,
      permissionId: p.id,
      module: humanizeModule(p.module),
      action: humanizeAction(p.action),
      label: `${humanizeAction(p.action)} ${humanizeModule(p.module)}`,
      description: p.description || null,
      permissionKey: key,
      source: "Permission",
      allowed: role === "super_admin" ? true : isEffectivelyGranted(granted, p.module, p.action),
      editable: true,
      evidence: `permissions table row (module="${p.module}", action="${p.action}")`,
      api: PERMISSION_API_MAP[key] || `RBAC checked on /admin or /api routes via checkPermission("${p.module}", "${p.action}")`,
    });
  }

  // ── 2. Task-relevant display aliases (Bulk Mark Attendance, Assign/Edit
  // Leave Balance, ...) — same underlying permission, friendlier label.
  for (const alias of CAPABILITY_ALIASES) {
    const matchingPerm = (allPermissions as any[]).find(
      (p: any) => p.module === alias.module && p.action === alias.action
    );
    const key = `${alias.module}:${alias.action}`;
    capabilities.push({
      key: `alias:${alias.module}:${alias.action}:${alias.label}`,
      permissionId: matchingPerm ? matchingPerm.id : null,
      module: humanizeModule(alias.module),
      action: humanizeAction(alias.action),
      label: alias.label,
      description: alias.description,
      permissionKey: key,
      source: "Permission",
      allowed: role === "super_admin" ? true : isEffectivelyGranted(granted, alias.module, alias.action),
      editable: matchingPerm ? true : false,
      evidence: `Same permission as ${humanizeAction(alias.action)} ${humanizeModule(alias.module)} (module="${alias.module}", action="${alias.action}")`,
      api: alias.api,
    });
  }

  // ── 3. Role-gated capabilities with no permissions-table row at all.
  for (const rc of ROLE_CAPABILITY_CATALOG) {
    if (rc.status === "not_available") {
      capabilities.push({
        key: rc.key,
        permissionId: null,
        module: rc.module,
        action: "Not Implemented",
        label: rc.label,
        description: rc.description,
        permissionKey: null,
        source: "Role Authorization",
        allowed: false,
        editable: false,
        evidence: rc.evidence,
        api: rc.api || "N/A",
      });
      continue;
    }
    capabilities.push({
      key: rc.key,
      permissionId: null,
      module: rc.module,
      action: rc.label,
      label: rc.label,
      description: rc.description,
      permissionKey: null,
      source: "Role Authorization",
      allowed: rc.allowedRoles.includes("manager"),
      editable: false,
      evidence: rc.evidence,
      api: rc.api || "Route role-gated via authorizeRoles()",
    });
  }

  const totalCapabilities = capabilities.length;
  const allowedCount = capabilities.filter((c) => c.allowed).length;

  const byModuleMap = new Map<string, { module: string; allowed: number; total: number }>();
  for (const c of capabilities) {
    if (!byModuleMap.has(c.module)) byModuleMap.set(c.module, { module: c.module, allowed: 0, total: 0 });
    const entry = byModuleMap.get(c.module)!;
    entry.total += 1;
    if (c.allowed) entry.allowed += 1;
  }

  return {
    manager: {
      id: targetUser.id,
      name: `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() || targetUser.email,
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      employeeCode: targetUser.employeeCode || null,
      status: targetUser.status === "active" ? "Active" : targetUser.status === "deActive" ? "Inactive" : targetUser.status,
      companyId: callerCompanyId,
      companyName,
      createdAt: targetUser.createdAt,
    },
    summary: {
      totalCapabilities,
      allowed: allowedCount,
      notAllowed: totalCapabilities - allowedCount,
      byModule: Array.from(byModuleMap.values()).sort((a, b) => a.module.localeCompare(b.module)),
    },
    capabilities,
  };
};

/**
 * Overview endpoint: returns company managers list and optionally details of the selected
 * manager (defaults to first manager in the company).
 */
export const getManagerCapabilitiesOverview = async (
  loggedInId: number,
  role: string | undefined,
  callerCompanyId: number | null,
  requestedManagerId?: number
) => {
  const managers = await getCompanyManagers(loggedInId, role, callerCompanyId);

  if (managers.length === 0) {
    return {
      managers: [],
      selectedManagerId: null,
      manager: null,
      summary: null,
      capabilities: [],
    };
  }

  const targetManagerId = requestedManagerId || managers[0].id;
  const details = await getManagerCapabilities(loggedInId, role, callerCompanyId, targetManagerId);

  return {
    managers,
    selectedManagerId: targetManagerId,
    ...details,
  };
};
