// ============================================================
// Role-Based Capability Catalog — for the Admin-only "Manager Capabilities"
// audit page (see managerCapabilities.service.ts) ONLY. This is NOT a second
// permission system: every entry below documents an action that the
// application already gates purely by ROLE (authorizeRoles / a role-hierarchy
// constant), with no corresponding row in the `permissions` table — the
// `evidence` field cites the exact existing file/route this was verified
// against. Nothing here is enforced anywhere; it exists solely so the audit
// page can report an accurate "effective capability" for actions the real
// permissions table doesn't cover, per the same convention checkPermission.ts
// already documents for its attendance-security/attendance-regularization
// fallbacks.
//
// If a genuinely new role-gated route is added to the app, add an entry here
// too (with real evidence) — do not let this list drift from the code.
// ============================================================

export interface RoleCapability {
  key: string;
  module: string;
  label: string;
  description: string;
  // Roles the underlying route/service actually allows today. Empty array +
  // status "not_available" means the feature doesn't exist in the app at all.
  allowedRoles: string[];
  evidence: string;
  api?: string;
  status?: "not_available";
}

export const ROLE_CAPABILITY_CATALOG: RoleCapability[] = [
  {
    key: "role:sale_person:add",
    module: "Sale Person",
    label: "Add Sale Person",
    description: "Register a new Sale Person account reporting to this Manager",
    allowedRoles: ["super_admin", "user", "admin", "manager"],
    evidence:
      'auth.service.ts ROLE_CREATABLE (mirrors permission.ts ASSIGNABLE_ROLES) — manager: ["sale_person"]',
    api: "POST /admin/register or POST /api/register",
  },
  {
    key: "role:sale_person:bulk_add",
    module: "Sale Person",
    label: "Bulk Add Sale Person (CSV)",
    description: "Register multiple Sale Persons at once via CSV upload",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence: "app/router/admin.ts POST /bulk-add-saleperson — authorizeRoles(...ADMIN_AND_MANAGER)",
    api: "POST /admin/bulk-add-saleperson",
  },
  {
    key: "role:sale_person:view_team",
    module: "Sale Person",
    label: "View My Sale Persons / Team",
    description: "View the list of Sale Persons reporting to this Manager",
    allowedRoles: ["super_admin", "user", "admin", "manager", "sale_person"],
    evidence:
      "app/router/admin.ts GET /mysaleperson — tokenCheck only (self-scoped by hierarchy inside the controller)",
    api: "GET /admin/mysaleperson",
  },
  {
    key: "role:sale_person:view_details",
    module: "Sale Person",
    label: "View Sale Person Details",
    description: "View individual Sale Person profile, assignment, and status",
    allowedRoles: ["super_admin", "user", "admin", "manager"],
    evidence: "app/router/admin.ts GET /mysaleperson and GET /client-details/:id",
    api: "GET /admin/mysaleperson",
  },
  {
    key: "role:sale_person:manage_attendance",
    module: "Sale Person",
    label: "Manage Sale Person Attendance",
    description: "Oversee, mark present, and review attendance for assigned Sale Persons",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence: "modules/attendance/attendance.routes.ts team attendance APIs (scoped by manager hierarchy)",
    api: "GET /admin/user-attendance, POST /admin/bulk-mark-attendance",
  },
  {
    key: "role:sale_person:manage_leave",
    module: "Sale Person",
    label: "Manage Sale Person Leave",
    description: "Review, approve/reject, and allocate leave balance for assigned Sale Persons",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence: "modules/leave/leave.routes.ts team leave APIs (scoped by manager hierarchy)",
    api: "GET /admin/get-leave-list, POST /admin/assign-leave-balance",
  },
  {
    key: "role:sale_person:reports",
    module: "Sale Person",
    label: "View Sale Person Reports",
    description: "View performance, visits, and activity reports for assigned Sale Persons",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence: "app/controller/report.ts scoped by user hierarchy for managers",
    api: "GET /admin/reports",
  },
  {
    key: "role:sale_person:edit",
    module: "Sale Person",
    label: "Edit Sale Person",
    description: "Edit an existing Sale Person's personal account credentials or profile",
    allowedRoles: [],
    evidence: "No edit-sale-person account endpoint exists anywhere in the current application.",
    api: "N/A (Feature not in application)",
    status: "not_available",
  },
  {
    key: "role:sale_person:deactivate",
    module: "Sale Person",
    label: "Delete / Deactivate Sale Person",
    description: "Deactivate or remove a Sale Person account",
    allowedRoles: [],
    evidence: "No deactivate/delete-sale-person endpoint exists anywhere in the current application.",
    api: "N/A (Feature not in application)",
    status: "not_available",
  },
  {
    key: "role:attendance:assign_shift",
    module: "Attendance",
    label: "Assign Employee Shift",
    description: "Assign a work shift to a team member",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence: "app/router/admin.ts PATCH /assign-employee-shift — authorizeRoles(...ADMIN_AND_MANAGER)",
    api: "PATCH /admin/assign-employee-shift",
  },
  {
    key: "role:geofencing:manage",
    module: "Geofencing",
    label: "View / Configure Team Geofencing",
    description: "View or edit a team member's geofencing requirement",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence:
      'modules/geoFencing/geoFencing.routes.ts GET & PUT /geo-fencing/:userId — authorizeRoles("super_admin","admin","manager")',
    api: "GET /admin/geo-fencing/:userId, PUT /admin/geo-fencing/:userId",
  },
  {
    key: "role:sale_person:branch_visibility",
    module: "Sale Person",
    label: "Toggle Sale Person Branch Visibility",
    description: "Allow a Sale Person to view every company branch (not just their own)",
    allowedRoles: ["super_admin", "admin"],
    evidence:
      'app/router/admin.ts PATCH /users/:userId/branch-visibility — authorizeRoles("super_admin","admin") — manager is not in this list',
    api: "PATCH /admin/users/:userId/branch-visibility",
  },
  {
    key: "role:travel:mileage_logs",
    module: "Travel / Mileage",
    label: "View Team Daily Mileage Logs",
    description: "View daily distance traveled, GPS logs, and meeting routes for team members",
    allowedRoles: ["super_admin", "admin", "manager", "user", "sale_person"],
    evidence: "modules/salesTravel/salesTravel.routes.ts GET /sales-travel/logs",
    api: "GET /admin/sales-travel/logs",
  },
  {
    key: "role:travel:rates_view",
    module: "Travel / Mileage",
    label: "View Vehicle Allowance Rates",
    description: "View per-km vehicle allowance reimbursement rates for car, bike, etc.",
    allowedRoles: ["super_admin", "admin", "manager"],
    evidence: "modules/company/company.routes.ts GET /company-policy (vehicleAllowanceRatePerKm)",
    api: "GET /admin/company-policy",
  },
  {
    key: "role:travel:rates_edit",
    module: "Travel / Mileage",
    label: "Edit Vehicle Allowance Rates",
    description: "Configure company-wide vehicle allowance rates (Admin only)",
    allowedRoles: ["super_admin", "admin"],
    evidence: "modules/company/company.routes.ts PATCH /updatecompany/:id — authorizeRoles(...ADMIN_ONLY)",
    api: "PATCH /admin/updatecompany/:id",
  },
  {
    key: "role:department:manage",
    module: "Departments",
    label: "Create / Edit Departments",
    description: "Add, update, or remove company departments (Admin only)",
    allowedRoles: ["super_admin", "admin"],
    evidence: "app/router/admin.ts POST/PATCH/DELETE department routes — Admin only",
    api: "POST /admin/department",
  },
  {
    key: "role:branch:manage",
    module: "Branches",
    label: "Create / Edit Branches",
    description: "Add, update, or remove company office branches and geofences (Admin only)",
    allowedRoles: ["super_admin", "admin"],
    evidence: "app/router/admin.ts POST/PATCH/DELETE branch routes — Admin only",
    api: "POST /admin/branch",
  },
  {
    key: "role:shift:manage",
    module: "Shifts",
    label: "Create / Edit Shifts",
    description: "Define work shift schedules, punch windows, and grace periods (Admin only)",
    allowedRoles: ["super_admin", "admin"],
    evidence: "app/router/admin.ts POST/PATCH/DELETE shift routes — Admin only",
    api: "POST /admin/shift",
  },
];

// A handful of Permission-table rows are worth surfacing under the more
// specific, task-relevant labels admins actually ask about (e.g. "Bulk Mark
// Attendance", "Assign/Edit Leave Balance") even though the underlying app
// gates them with the SAME module:action as another action. These are
// display aliases only — never a separate grantable permission — each
// clearly says which real permission it shares.
export interface CapabilityAlias {
  module: string;
  action: string;
  label: string;
  description: string;
  api: string;
}

export const CAPABILITY_ALIASES: CapabilityAlias[] = [
  {
    module: "attendance",
    action: "update",
    label: "Bulk Mark Attendance",
    description: "Upload a spreadsheet (.xlsx/.csv) to bulk-mark attendance for team members (shares the same permission as Edit Attendance)",
    api: "POST /admin/bulk-mark-attendance",
  },
  {
    module: "attendance",
    action: "view",
    label: "View Team Attendance",
    description: "View daily attendance, punch times, and monthly attendance book for team members",
    api: "GET /admin/user-attendance, GET /admin/attendance-book",
  },
  {
    module: "attendance",
    action: "create",
    label: "Mark Team Attendance",
    description: "Mark attendance present on behalf of a team member",
    api: "POST /admin/mark-attendance-present",
  },
  {
    module: "attendance",
    action: "view",
    label: "View Sale Person Attendance History",
    description: "View full date-range attendance logs and punch history for individual team members",
    api: "GET /admin/user-attendance",
  },
  {
    module: "leave",
    action: "view",
    label: "View Leave Balance",
    description: "View team members' leave balances and quota allocations",
    api: "GET /admin/leave-balance-list, GET /admin/leave-balance/:employeeId",
  },
  {
    module: "leave",
    action: "manage",
    label: "Assign Leave Balance",
    description: "Allocate/assign leave balances to team members (shares the same permission as managing leave policies)",
    api: "POST /admin/assign-leave-balance",
  },
  {
    module: "leave",
    action: "manage",
    label: "Edit Leave Balance",
    description: "Modify an employee's existing leave quota or balance (shares leave:manage with Assign Leave Balance)",
    api: "POST /admin/assign-leave-balance",
  },
  {
    module: "leave",
    action: "manage",
    label: "Increase Leave Balance",
    description: "Grant additional leave credits to an employee (via leave balance assignment)",
    api: "POST /admin/assign-leave-balance",
  },
  {
    module: "leave",
    action: "manage",
    label: "Decrease Leave Balance",
    description: "Reduce or deduct leave credits from an employee (via leave balance assignment)",
    api: "POST /admin/assign-leave-balance",
  },
  {
    module: "leave",
    action: "view",
    label: "View Team Leave Requests",
    description: "View pending, approved, and rejected leave requests from reporting team members",
    api: "GET /admin/get-leave-list",
  },
  {
    module: "leave",
    action: "view",
    label: "View Own Leave & Balance",
    description: "View own leave history, quota balances, and personal leave applications",
    api: "GET /api/user-leave, GET /api/leave/my-balances",
  },
  {
    module: "leave",
    action: "approve",
    label: "Approve Sale Person Leave",
    description: "Approve pending leave requests submitted by reporting team members",
    api: "POST /admin/approved-leave",
  },
  {
    module: "leave",
    action: "reject",
    label: "Reject Sale Person Leave",
    description: "Reject pending leave requests submitted by reporting team members",
    api: "POST /admin/rejected-leave",
  },
];
