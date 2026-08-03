# SalesVera — Manager API Documentation

**For:** Android Developer
**Audience:** Endpoints usable by the **Manager** role only
**Source of truth:** Live backend code (`ts_salesvera_backend`) — every endpoint below is already implemented and running; nothing in this document requires new backend work.

## Table of Contents

1. [Base URLs](#1-base-urls)
2. [Authentication](#2-authentication) — Login, Profile, Password, My Permissions
3. [Common Error Format Reference](#3-common-error-format-reference)
4. [Manager's Default Permissions](#4-managers-default-permissions-reference)
5. [Attendance & Team Management](#attendance--team-management) — 17 endpoints (team attendance, punch in/out, sales team, shift assignment, dashboard)
6. [Expense Management](#expense-management) — 5 endpoints
7. [Leave Management](#leave-management) — 14 endpoints
8. [Meeting Management](#meeting-management) — 5 endpoints (schedule, reschedule, dashboard)
9. [Task Management](#task-management) — 5 endpoints
10. [Reports & Insights](#reports--insights) — 3 endpoints
11. [Notifications](#notifications) — 6 endpoints
12. [My Preferences](#my-preferences) — 2 endpoints
13. [Permission Management (Manager → Sales Person)](#permission-management-manager--sales-person) — 9 endpoints
14. [Reference / Lookup Data](#reference--lookup-data-branch-shift-department-holiday) — 8 endpoints (Branch, Shift, Department, Holiday)
15. [Company Context](#company-context) — 4 endpoints (my-companies, switch-company, company-policy)

**Total: ~88 documented API calls, all currently live.**

---

## 1. Base URLs

The backend exposes two route groups. A Manager account can call endpoints in **both**:

| Group | Base Path | Used for |
|---|---|---|
| Admin / Team-management | `https://<host>/admin` | Everything a Manager does for their team: attendance, leave, expense approvals, meetings, tasks, reports, branch/shift/department lookups, permission delegation to Sales Persons. |
| Mobile self-service | `https://<host>/api` | The Manager's own actions: login, punch in/out, own leave/expense, notifications, quotations/invoices (if granted). |

Replace `<host>` with the deployed API domain.

## 2. Authentication

All endpoints except `login`, `register`, `forgot-password`, `verify-otp`, and `reset-password` require a JWT **Bearer token** obtained from login.

**Header on every authenticated request:**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <accessToken>` |
| `Content-Type` | `application/json` (unless the endpoint uploads a file — see that endpoint's Headers table) |

The token is checked two ways depending on which base path you're calling:
- `/admin/*` routes accept roles: `user`, `admin`, `super_admin`, `manager`.
- `/api/*` routes accept roles: `user`, `manager`, `sale_person` (a few, like attendance self-service, also allow `admin`).

A Manager token works on both, so no separate login is needed for `/admin` vs `/api` calls.

### 2.1 Login

**Purpose:** Authenticate a Manager and receive the access token used for every subsequent call.

- **Method:** `POST`
- **Endpoint:** `/admin/login`
- **Authentication:** None (public)

**Headers**

| Header | Value |
|---|---|
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "email": "manager@example.com",
  "password": "SecurePass123",
  "tenantId": null,
  "deviceType": "mobile"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | Yes | Registered email address |
| password | string | Yes | Account password |
| tenantId | number | No | Only needed when the same email exists under multiple tenants; omit for normal mobile login |
| deviceType | string | No | Pass `"mobile"` (or omit). `"exe"` is reserved for the desktop app and is rejected for non-admin roles |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "companyId": 12,
    "user": {
      "id": 45,
      "firstName": "Ravi",
      "lastName": "Sharma",
      "email": "manager@example.com",
      "role": "manager",
      "tallyGuid": null,
      "tallyName": null,
      "tallyStartDate": null
    },
    "permissions": [
      "attendance:view", "attendance:create", "attendance:update",
      "expense:view", "expense:approve", "expense:reject",
      "leave:view", "leave:apply", "leave:approve", "leave:reject",
      "meeting:view", "meeting:schedule", "meeting:join", "meeting:update",
      "chat:read", "chat:send",
      "report:view",
      "insights:view",
      "task:create", "task:view", "task:update",
      "notification:view", "notification:mark_read",
      "profile:view"
    ]
  }
}
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "code": 400, "message": "Email and password are required", "data": {} }
```
```json
// 400 - wrong credentials
{ "success": false, "code": 400, "message": "Invalid email or password", "data": {} }
```
```json
// 400 - role not allowed to log in this way
{ "success": false, "code": 400, "message": "Access restricted. Only admin, manager & user can login.", "data": {} }
```

**Validation Rules**
- `email` and `password` are required.
- Password is checked with bcrypt against the stored hash.
- `sale_person` accounts cannot use this endpoint at all (`Access restricted...`) — Sales Person login is a separate flow, out of scope for this document.

**Notes**
- The `permissions` array in the response is the definitive list of what this Manager can actually do — the Android app should use it to show/hide screens rather than hard-coding role checks, since an admin can grant/revoke individual permissions per manager (see §7 Permission Management).
- `companyId` is resolved server-side from the Manager's company assignment — never send `companyId` yourself in later requests; it's read from the token.
- An identical `/api/login` endpoint also exists (legacy mobile path) and behaves the same way; `/admin/login` is the current canonical one — either works, but standardize on one.
- Store `accessToken` for the `Authorization` header and `refreshToken` for silent re-auth (`GET /api/refreshtoken`, Bearer token still required — send the current, possibly-expiring, access token).

---

### 2.2 Get Profile

- **Method:** `GET`
- **Endpoint:** `/admin/getProfile`
- **Authentication:** Bearer Token — any authenticated role

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "User profile fetched successfully",
  "data": {
    "user": {
      "id": 45,
      "firstName": "Ravi",
      "lastName": "Sharma",
      "email": "manager@example.com",
      "phone": "9876543210",
      "role": "manager",
      "profile": "https://.../profile.jpg",
      "company": { "id": 12, "name": "Acme Pvt Ltd", "...": "..." }
    },
    "permissions": ["attendance:view", "..."],
    "matrix": { "attendance": { "view": true, "create": true, "update": true }, "...": {} }
  }
}
```

**Notes**
- For a Manager, the response's `user.company` is populated from their **currently active** company (resolved from the token) — useful for a company-switcher UI (see §8.2 Switch Company).

---

### 2.3 Update Profile

- **Method:** `PATCH`
- **Endpoint:** `/admin/updateProfile`
- **Authentication:** Bearer Token — any authenticated role

**Headers**

| Header | Value |
|---|---|
| Content-Type | `multipart/form-data` (only if uploading a new profile photo; otherwise `application/json` works too since all fields are optional form fields) |

**Request Payload**

| Field | Type | Required | Description |
|---|---|---|---|
| firstName | string | No | |
| lastName | string | No | |
| phone | string | No | |
| dob | string (date) | No | |
| tallyGuid | string | No | Tally integration field |
| tallyName | string | No | Tally integration field |
| tallyStartDate | string (date) | No | Tally integration field |
| profile | file | No | Multipart field name for the new profile image |

At least one field must be provided.

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Profile updated successfully", "data": { "user": { "id": 45, "firstName": "Ravi", "...": "..." } } }
```

**Sample Error Responses**

```json
// 400 - nothing to update
{ "success": false, "code": 400, "message": "No fields provided to update", "data": {} }
```

---

### 2.4 Update Password

- **Method:** `PATCH`
- **Endpoint:** `/admin/updatepassword`
- **Authentication:** Bearer Token

**Request Payload**

```json
{ "oldPassword": "OldPass123", "newPassword": "NewPass456" }
```

| Field | Type | Required | Description |
|---|---|---|---|
| oldPassword | string | Yes | Current password |
| newPassword | string | Yes | New password — must differ from old |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Password updated successfully", "data": {} }
```

**Sample Error Responses**

```json
// 400 - same password
{ "success": false, "code": 400, "message": "New password must be different from the old password", "data": {} }
```
```json
// 400 - wrong old password
{ "success": false, "code": 400, "message": "Old password is incorrect", "data": {} }
```

---

### 2.5 Forgot Password / Verify OTP / Reset Password

Three-step flow, all public (no Bearer token):

**Step 1 — `POST /admin/forgot-password`**
```json
{ "email": "manager@example.com", "tenantId": null }
```
→ `{ "success": true, "code": 200, "message": "OTP sent to your email", "data": {} }`
Emails a 6-digit OTP valid for 10 minutes.

**Step 2 — `POST /admin/verify-otp`**
```json
{ "email": "manager@example.com", "otp": "482913", "tenantId": null }
```
→ `{ "success": true, "code": 200, "message": "OTP verified successfully", "data": {} }`
Errors: `"Invalid OTP"`, `"OTP has expired"`.

**Step 3 — `POST /admin/reset-password`**
```json
{ "email": "manager@example.com", "newPassword": "NewPass456", "tenantId": null }
```
→ `{ "success": true, "code": 200, "message": "Password changed successfully", "data": {} }`

**Notes**
- `tenantId` is optional in all three — only needed for accounts sharing an email across multiple tenants.
- Step 3 does not re-check the OTP itself (OTP was already consumed/verified in Step 2) — call these in order.

---

### 2.6 Logout

- **Method:** `POST`
- **Endpoint:** `/admin/logout`
- **Authentication:** Bearer Token

**Request Payload**

```json
{ "lastLoginCompanyId": 12 }
```

| Field | Type | Required | Description |
|---|---|---|---|
| lastLoginCompanyId | number \| null | No | Persists the active company so next login restores it. Send `{}` if there's no active company context. |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Logout successful", "data": {} }
```

---

### 2.7 My Permissions

- **Method:** `GET`
- **Endpoint:** `/admin/permissions/my`
- **Authentication:** Bearer Token

**Sample Success Response**

```json
{
  "success": true,
  "data": {
    "role": "manager",
    "companyId": 12,
    "permissions": ["attendance:view", "attendance:create", "..."],
    "matrix": { "attendance": { "view": true, "create": true, "update": true } },
    "allPermissions": { "attendance": ["view", "create", "update", "delete"], "...": [] }
  }
}
```

**Notes**
- Call this after login (or on app resume) to refresh which features to show — permissions can change if an Admin edits the Manager's permission matrix from the web dashboard.
- An identical alias exists at `GET /api/my-permissions`.

---

## 3. Common Error Format Reference

Use this table across every endpoint in this document — these come from shared middleware, not per-endpoint code:

| Status | When | Body shape |
|---|---|---|
| 401 | No `Authorization` header, or it's not `Bearer <token>` | `{ "code": 401, "success": false, "errorMessage": "Please provide bearer token" }` |
| 401 | Token present but invalid/expired | `{ "code": "401", "success": false, "message": "Unauthorized — invalid or expired token" }` |
| 403 | Token valid but role not allowed on this route, or user inactive | `{ "code": "403", "success": false, "message": "Forbidden — user not found, inactive, or insufficient role" }` |
| 403 | Role allowed, but missing the specific permission | `{ "success": false, "message": "You don't have '<module>:<action>' permission" }` |
| 403 | Route restricted to a fixed role list (not permission-based) | `{ "success": false, "message": "Forbidden — requires one of: admin, super_admin, manager, user" }` |
| 500 | Unhandled server error | `{ "code": "500", "success": false, "message": "Internal server error" }` |

Most business-logic errors (validation, not-found, etc.) return **HTTP 400** with:
```json
{ "success": false, "code": 400, "message": "<specific reason>", "data": {} }
```

---

## 4. Manager's Default Permissions (reference)

A newly onboarded Manager is granted this permission set out of the box (an Admin can add/remove individual permissions afterward from the web dashboard — always trust the `permissions` array from Login/GetProfile/My-Permissions over this table):

| Module | Actions granted by default |
|---|---|
| attendance | view, create, update |
| expense | view, approve, reject |
| leave | view, apply, approve, reject |
| meeting | view, schedule, join, update |
| chat | read, send |
| report | view |
| insights | view |
| task | create, view, update |
| notification | view, mark_read |
| profile | view |

Endpoints requiring a permission **outside** this default set (e.g. `expense:create`, `leave:manage`, `report:export`) are marked accordingly in their Authentication line below — they still work for a Manager once an Admin grants that specific permission.

---
## Attendance & Team Management

### 1. Get Team Attendance (Today)

**Purpose:** Returns today's attendance rows for everyone on the manager's team (their direct + indirect reports).

- **Method:** `GET`
- **Endpoint:** `/admin/get-attendance`
- **Authentication:** Bearer Token — requires `attendance:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Page number, default `1` |
| limit | number | No | Rows per page, default `10` |

**Request Payload**

_None (GET request, no body)._

**Sample Success Response**

```json
{
  "success": true,
  "message": "Attendance fetched successfully",
  "data": [
    {
      "id": 501,
      "employee_id": 42,
      "date": "2026-07-30",
      "status": "present",
      "punch_in": "2026-07-30T03:31:00.000Z",
      "punch_out": null,
      "working_hours": null,
      "late": false
    }
  ],
  "pagination": { "totalRecords": 18, "totalPages": 2, "currentPage": 1, "limit": 10 }
}
```

**Sample Error Responses**

```json
// 403 - missing attendance:view permission
{ "success": false, "message": "You don't have 'attendance:view' permission" }
```
```json
// 401 - invalid/expired token
{ "code": "401", "success": false, "message": "Unauthorized — invalid or expired token" }
```

**Validation Rules**
- None on input — always scoped server-side to the caller's own team (`childIds`), never client-supplied.

**Notes**
- Only returns **today's** rows, and excludes the manager's own attendance row (team only).
- Use `/admin/user-attendance` for history of a specific employee, or `/admin/attendance-book` for a monthly matrix view.
---

### 2. Mark Attendance Present (Manual Correction)

**Purpose:** Manager manually sets an attendance outcome (present/half-day/absent/leave) for one team member on a given date — e.g. correcting a missed punch.

- **Method:** `POST`
- **Endpoint:** `/admin/mark-attendance-present`
- **Authentication:** Bearer Token — requires `attendance:update` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "employeeId": 42,
  "date": "2026-07-29",
  "status": "present",
  "punchIn": "2026-07-29T09:00:00.000Z",
  "companyLeaveId": null
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| employeeId | number | Yes | Team member's user id. Must be a descendant of the caller. |
| date | string (`YYYY-MM-DD`) | No | Defaults to today if omitted. |
| status | string | No | One of `present`, `half_day`, `absent`, `leave`. Defaults to `present`. |
| punchIn | ISO datetime | No | Optional explicit punch-in time; otherwise derived from the employee's shift. |
| companyLeaveId | number | Conditional | **Required when `status = "leave"`** — id of a company-configured leave type. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Attendance updated",
  "data": {
    "id": 501,
    "employee_id": 42,
    "date": "2026-07-29",
    "status": "present",
    "punch_in": "2026-07-29T09:00:00.000Z",
    "punch_out": "2026-07-29T17:00:00.000Z",
    "working_hours": 8,
    "dayType": "full_day"
  }
}
```

**Sample Error Responses**

```json
// 400 - employeeId missing
{ "success": false, "code": 400, "message": "employeeId is required", "data": {} }
```
```json
// 400 - not a team member
{ "success": false, "code": 400, "message": "You can only mark attendance for your own team members", "data": {} }
```
```json
// 400 - leave without a type
{ "success": false, "code": 400, "message": "companyLeaveId is required when marking a specific leave type", "data": {} }
```
```json
// 400 - marking too early relative to shift start
{ "success": false, "code": 400, "message": "<Employee>'s shift starts at 09:00 — attendance can only be marked from 08:30 onward.", "data": {} }
```
```json
// 400 - existing leave-status row blocks a routine correction
{ "success": false, "code": 400, "message": "This employee is marked \"leaveApproved\" on 2026-07-29. Reject/cancel the leave first before marking present.", "data": {} }
```

**Validation Rules**
- `employeeId` required and must be within the caller's own team hierarchy (children/grandchildren only — not arbitrary users).
- `status` must be one of `present | half_day | absent | leave`; anything else silently falls back to `present`.
- `companyLeaveId` mandatory when `status = "leave"`, and must belong to the caller's own company's configured leave types.
- For "showed up" outcomes (`present`/`half_day`) dated **today**, the call is rejected until 30 minutes before the employee's shift start (no gate if the employee has no assigned shift, or the date is in the past).
- Cannot silently overwrite a row already in a leave-related status (`leave`/`leaveApproved`/`leaveReject`) unless the new status is itself `leave`.

**Notes**
- Never overwrites a real self-punch already recorded for that day (punch fields stay as-is when re-marking `present`/`half_day` if a genuine punch already exists).
- Punch-in/out and working hours are auto-derived from the employee's assigned shift when not explicitly supplied.
---

### 3. Bulk Mark Attendance (CSV/XLSX Upload)

**Purpose:** Upload a spreadsheet (one row per employee, one column per date) to mark attendance for the manager's whole team over a date range in one call.

- **Method:** `POST`
- **Endpoint:** `/admin/bulk-mark-attendance`
- **Authentication:** Bearer Token — requires `attendance:update` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `multipart/form-data` |

**Request Payload** (multipart form fields)

| Field | Type | Required | Description |
|---|---|---|---|
| file | file (.csv or .xlsx) | Yes | Sheet name `employee_details` if present, else the first sheet. Columns: 0 = Staff Name, 1 = Employee ID (employee code or numeric id), 2 = Job Title, 3+ = one column per date. |
| fromDate | string (`YYYY-MM-DD`) | No | Restricts/overrides which dates are processed (max 366-day span). |
| toDate | string (`YYYY-MM-DD`) | No | Used together with `fromDate`. |
| shiftId | number | No | If given, only employees assigned to this exact shift are processed; others are skipped. |

Each date-column cell may contain a status word (`Present`, `Absent`, `Week Off`, `Half Day`, a company-configured leave type name/code, etc.) or a clock time like `09:15` to backfill a real punch-in. A blank cell defaults to `present`.

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Bulk attendance applied successfully",
  "data": {
    "applied": 62,
    "created": 40,
    "updated": 22,
    "skippedNonNumericEmployeeId": [],
    "skippedNotInTeam": [],
    "skippedUnknownStatus": [],
    "skippedWrongShift": [],
    "skippedTooEarly": []
  }
}
```

**Sample Error Responses**

```json
// 400 - no file
{ "success": false, "code": 400, "message": "Attendance file (.csv or .xlsx) is required", "data": {} }
```
```json
// 400 - bad range
{ "success": false, "code": 400, "message": "fromDate must be before toDate", "data": {} }
```
```json
// 400 - nothing to apply
{ "success": true, "code": 200, "message": "No valid attendance rows to apply", "data": { "applied": 0, "skippedNonNumericEmployeeId": [], "skippedNotInTeam": [], "skippedUnknownStatus": [], "skippedWrongShift": [], "skippedTooEarly": [] } }
```

**Validation Rules**
- File is required; must contain at least a header row + 1 data row.
- `fromDate`/`toDate`, if given, must both parse and span ≤ 366 days.
- Rows are matched against the caller's own team only (by employee code, falling back to numeric id) — anyone else is silently skipped into `skippedNotInTeam`.
- Unrecognized status words (not a status keyword and not a valid clock time) are skipped into `skippedUnknownStatus`, not rejected — the request itself still succeeds.
- Same 30-minutes-before-shift-start gate as single mark, but only for `present` rows dated today (collected into `skippedTooEarly`, not a hard failure).

**Notes**
- The response always returns per-category skip arrays even on success — the Android app should surface these as a "N rows skipped, see details" summary rather than treating any skip as a failure.
- This is a synchronous request/response call (no background job/polling).
---

### 4. Get Employee Attendance History

**Purpose:** Attendance history for one specific team member, paginated and optionally date-filtered.

- **Method:** `GET`
- **Endpoint:** `/admin/user-attendance`
- **Authentication:** Bearer Token — requires `attendance:view` permission (granted to Manager by default)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| userId | number | **Yes** | Target employee's user id. Must be the caller themself or one of their team members. |
| page | number | No | Default `1`. |
| limit | number | No | Default `10`. |
| startDate | string (`YYYY-MM-DD`) | No | Inclusive range start. |
| endDate | string (`YYYY-MM-DD`) | No | Inclusive range end. |
| lastDays | number | No | Shortcut: last N days instead of start/end. |
| today | `"true"` | No | Shortcut: only today's row. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "User attendance fetched successfully",
  "data": {
    "attendance": [ { "id": 501, "date": "2026-07-29", "status": "present", "punch_in": "...", "punch_out": "..." } ],
    "pagination": { "totalRecords": 24, "totalPages": 3, "currentPage": 1, "limit": 10 }
  }
}
```

**Sample Error Responses**

```json
// 400 - missing userId
{ "success": false, "code": 400, "message": "UserId is required", "data": {} }
```
```json
// 403 - not your team member
{ "success": false, "code": 400, "message": "You can only view attendance of your own team members", "data": {} }
```
*(Note: this particular check is thrown as a `ServiceError(..., 403)` but the shared error handler for this endpoint currently routes it through `badRequest`, so it renders with HTTP 400 in practice — flag this to the Android team as a known quirk rather than branching UI logic on the status code alone; match on the message text if needed.)*

**Validation Rules**
- `userId` required, must be a non-negative integer, and must be within the caller's own team (or the caller's own id).

**Notes**
- Prefer this over `/admin/get-attendance` when drilling into one employee's history/timeline.
---

### 5. Attendance Book (Monthly Calendar View)

**Purpose:** Per-employee day-by-day attendance matrix for a given month — powers a calendar/grid view of the whole team.

- **Method:** `GET`
- **Endpoint:** `/admin/attendance-book`
- **Authentication:** Bearer Token — requires `attendance:view` permission (granted to Manager by default)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| month | number (1-12) | No | Defaults to current month. |
| year | number | No | Defaults to current year. |
| search | string | No | Filter by employee first/last name. |
| page | number | No | Default `1`. |
| limit | number | No | Default `10`. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Attendance loaded",
  "data": {
    "page": 1,
    "limit": 10,
    "totalCount": 12,
    "totalPages": 2,
    "users": [
      {
        "id": 42,
        "employeeCode": "EMP00007",
        "name": "Ravi Kumar",
        "email": "ravi@example.com",
        "role": "sale_person",
        "days": { "1": "present", "2": "present", "3": "-", "...": "..." },
        "dayTypes": { "1": "full_day" },
        "leaveTypes": {}
      }
    ]
  }
}
```

**Sample Error Responses**

```json
// 400 - manager has no team yet
{ "success": false, "code": 400, "message": "No child users found", "data": {} }
```

**Validation Rules**
- Fails if the manager currently has zero team members.

**Notes**
- `days` is keyed by day-of-month (`"1"`..`"31"`) with `"-"` meaning no record for that day.
---

### 6. Export Attendance Report (Excel)

**Purpose:** Downloads an `.xlsx` file — one row per attendance record — for the manager's team over a date range (defaults to current month).

- **Method:** `GET`
- **Endpoint:** `/admin/attendance-report/export`
- **Authentication:** Bearer Token — requires `attendance:view` permission (granted to Manager by default)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| userId | number | No | Restrict to one team member (must be caller's own team member). |
| startDate / endDate / lastDays / today | see above | No | Same date-filter shortcuts as `/admin/user-attendance`. Defaults to the current calendar month if none given. |

**Request Payload**

_None (GET)._

**Sample Success Response**

Binary response — `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename=attendance-report-2026-07-30.xlsx`. No JSON envelope; the Android client should stream/save the response body directly as a file.

**Sample Error Responses**

```json
// 400 - no team
{ "success": false, "code": 400, "message": "No child users found", "data": {} }
```
```json
// 400 - userId not on caller's team
{ "success": false, "code": 400, "message": "You can only export attendance of your own team members", "data": {} }
```

**Validation Rules**
- Same team-scoping rule as endpoint 4.

**Notes**
- This is a file download, not a JSON API — set the `Accept` header appropriately and handle the binary stream (e.g. `ResponseBody` in Retrofit) rather than parsing JSON.
---

### 7. Punch In (Self)

**Purpose:** Manager punches themself in for the day (managers can use their own self-service attendance, same as any employee).

- **Method:** `POST`
- **Endpoint:** `/api/attendance/punch-in`
- **Authentication:** Bearer Token — requires `attendance:create` permission (granted to Manager by default). Note: this router uses a token check that allows `user, admin, manager, sale_person`.

**Request Payload**

```json
{
  "punch_in": "2026-07-30T09:02:00.000Z",
  "latitude_in": 28.6139,
  "longitude_in": 77.2090
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| punch_in | ISO datetime | Yes | Punch-in timestamp. |
| latitude_in | number | Conditional | Required only if the company enforces geofencing and the caller's branch has geofence data configured. |
| longitude_in | number | Conditional | Same as above. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Punch-in recorded successfully",
  "data": { "id": 501, "employee_id": 7, "date": "2026-07-30", "punch_in": "2026-07-30T09:02:00.000Z", "status": "present", "late": false }
}
```

**Sample Error Responses**

```json
// 400 - missing punch_in
{ "success": false, "code": 400, "message": "Punch-in time is required", "data": {} }
```
```json
// 400 - already punched in
{ "success": false, "code": 400, "message": "You have already punched-in. Please punch-out first.", "data": {} }
```
```json
// 400 - too early for shift
{ "success": false, "code": 400, "message": "Your shift starts at 09:00 — attendance can only be marked from 08:30 onward.", "data": {} }
```
```json
// 400 - outside geofence
{ "success": false, "code": 400, "message": "Location is required to punch in for this company", "data": {} }
```
```json
// 400 - too far from branch
{ "success": false, "code": 400, "message": "You are 350m away from Main Branch — must be within 100m to punch in", "data": {} }
```

**Validation Rules**
- `punch_in` required.
- One active (not-yet-punched-out) session per day — a second punch-in without a punch-out first is rejected.
- Shift-start gate: blocked until 30 minutes before assigned shift start (skipped if no shift assigned).
- Geofencing enforced only if the company requires it and the branch has lat/long/radius configured.

**Notes**
- `late` is computed automatically from shift start + company grace period (or 09:30 with no grace if neither configured) and returned in the response — the app doesn't need to compute it client-side.
---

### 8. Punch Out (Self)

**Purpose:** Closes out the caller's own active punch-in session for today.

- **Method:** `POST`
- **Endpoint:** `/api/attendance/punch-out`
- **Authentication:** Bearer Token — requires `attendance:update` permission (granted to Manager by default)

**Request Payload**

```json
{
  "punch_out": "2026-07-30T18:05:00.000Z",
  "AttendanceId": 501,
  "latitude_out": 28.6139,
  "longitude_out": 77.2090
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| punch_out | ISO datetime | Yes | Punch-out timestamp. |
| AttendanceId | number | No | Specific attendance row id to close (falls back to today's active session if omitted). |
| latitude_out | number | No | Optional geofencing coordinate on punch-out. |
| longitude_out | number | No | Optional geofencing coordinate on punch-out. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Punch-out recorded successfully",
  "data": {
    "id": 501, "punch_in": "2026-07-30T09:02:00.000Z", "punch_out": "2026-07-30T18:05:00.000Z",
    "working_hours": 9.05, "overtime": 1.05, "dayType": "full_day", "status": "out"
  }
}
```

**Sample Error Responses**

```json
// 400 - missing punch_out
{ "success": false, "code": 400, "message": "Punch-out time is required", "data": {} }
```
```json
// 400 - nothing to close
{ "success": false, "code": 400, "message": "No active punch-in record found. Please punch-in first.", "data": {} }
```
```json
// 400 - punch-out before punch-in
{ "success": false, "code": 400, "message": "Punch-out must be after punch-in", "data": {} }
```

**Validation Rules**
- `punch_out` required and must be after the session's `punch_in`.
- Must have an active punch-in session for today (or the given `AttendanceId`).

**Notes**
- `working_hours`/`overtime`/`dayType` are all computed server-side — don't recompute client-side.
---

### 9. Get Today's Attendance (Self)

**Purpose:** Returns the caller's own attendance row for today (to render punch-in/out button state).

- **Method:** `GET`
- **Endpoint:** `/api/attendance/today`
- **Authentication:** Bearer Token — requires `attendance:view` permission (granted to Manager by default)

**Request Payload**

_None._

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Today attendance fetched successfully",
  "data": { "id": 501, "date": "2026-07-30", "punch_in": "2026-07-30T09:02:00.000Z", "punch_out": null, "status": "present" }
}
```

**Sample Error Responses**

```json
// 400 - no row yet today
{ "success": false, "code": 400, "message": "No attendance found for today", "data": {} }
```

**Validation Rules**
- None (read-only, self-scoped).

**Notes**
- A 400 "No attendance found for today" is the expected/normal response before the user has punched in — treat it as "not punched in yet", not a hard error, in the UI.
---

### 10. Get Attendance List (Self)

**Purpose:** Returns the caller's own historical attendance list (paginated).

- **Method:** `GET`
- **Endpoint:** `/api/attendancelist`
- **Authentication:** Bearer Token — requires `attendance:view` permission (granted to Manager by default)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Pagination page. |
| limit | number | No | Rows per page. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Attendance list fetched successfully",
  "data": [ { "id": 501, "date": "2026-07-30", "status": "present" } ],
  "pagination": { "totalRecords": 20, "totalPages": 2, "currentPage": 1, "limit": 10 }
}
```

**Sample Error Responses**

Standard 401/403 auth errors only — no endpoint-specific validation.

**Validation Rules**
- None beyond authentication — always scoped to the caller's own id.

**Notes**
- Functionally overlaps with `/api/attendance/today` + `/admin/user-attendance`; use whichever matches the screen (this one is the caller's own full history feed).
---

### 11. Get My Sales Team

**Purpose:** Lists the sales persons (and other users) directly created/assigned under a manager (or another manager, via `managerId`).

- **Method:** `GET`
- **Endpoint:** `/admin/mysaleperson`
- **Authentication:** Bearer Token — role-restricted to `user, admin, super_admin, manager` (any authenticated `/admin`-side role); no separate permission grant needed.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Default `1`. |
| limit | number | No | Default `10`. |
| search | string | No | Matches first name, last name, email, or phone. |
| managerId | number | No | Defaults to the caller's own id — a manager normally omits this and sees their own team. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "My sale persons",
  "data": {
    "page": 1, "limit": 10, "total": 6,
    "rows": [ { "id": 42, "employeeCode": "EMP00007", "firstName": "Ravi", "lastName": "Kumar", "email": "ravi@example.com", "phone": "9999999999", "role": "sale_person" } ]
  }
}
```

**Sample Error Responses**

```json
// 400 - manager id not found
{ "success": false, "code": 400, "message": "User not found", "data": {} }
```

**Validation Rules**
- None beyond authentication.

**Notes**
- This endpoint currently has no `checkPermission` gate — accessible to any authenticated `/admin`-side role, not just Manager.
---

### 12. Assign Salesman to a Manager

**Purpose:** Attaches one or more sale_person accounts under a specific manager (re-parents them in the team hierarchy).

- **Method:** `POST`
- **Endpoint:** `/admin/assign-salesman`
- **Authentication:** Bearer Token — role-restricted to `user, admin, super_admin, manager` (no `checkPermission` gate; business rule below effectively limits real-world use to admins managing manager rosters).

**Request Payload**

```json
{
  "managerId": 15,
  "saleId": [42, 43]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| managerId | number | Yes | Must be an existing user with `role = "manager"`. |
| saleId | number or number[] | Yes | One or more sale_person user ids to attach to this manager. **Replaces** the manager's full existing sale-person roster (not additive). |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Salesman assigned", "data": {} }
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "code": 400, "message": "managerId & saleId are required", "data": {} }
```
```json
// 400 - manager not found
{ "success": false, "code": 400, "message": "Manager not found", "data": {} }
```
```json
// 400 - target isn't a manager
{ "success": false, "code": 400, "message": "User is not a manager", "data": {} }
```

**Validation Rules**
- `managerId` and `saleId` both required.
- `managerId` must reference a user whose `role` is exactly `"manager"`.

**Notes**
- **Caution:** `setCreatedUsers(ids)` replaces the manager's entire team list with `saleId` — calling this with a partial list will unassign anyone not included. Confirm with the backend team whether the Android app is meant to call this at all (it reads as an admin console action more than a manager self-service one).
---

### 13. Get All Users (Team Hierarchy)

**Purpose:** Paginated, filterable list of every user under the caller in the org hierarchy (children + grandchildren), with optional role/shift/branch filters.

- **Method:** `GET`
- **Endpoint:** `/admin/getalluser`
- **Authentication:** Bearer Token — role-restricted to `user, admin, super_admin, manager`; no separate permission grant needed.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Default `1`. |
| limit | number | No | Default `10`. |
| search | string | No | Matches first/last name, email, phone. |
| role | string | No | Filter by exact role (e.g. `sale_person`). |
| shiftId | number | No | Filter by assigned shift. |
| branchId | number | No | Filter by assigned branch. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "page": 1, "limit": 10, "total": 6,
    "finalRows": [
      {
        "id": 42, "employeeCode": "EMP00007", "firstName": "Ravi", "lastName": "Kumar",
        "email": "ravi@example.com", "phone": "9999999999", "role": "sale_person",
        "shiftId": 3, "branchId": 1, "createdAt": "2026-05-01T00:00:00.000Z",
        "creator": { "id": 15, "firstName": "Manager", "lastName": "One", "role": "manager" }
      }
    ]
  }
}
```

**Sample Error Responses**

Standard 401/403 auth errors only.

**Validation Rules**
- None beyond authentication — result set is always scoped to the caller's own descendants.

**Notes**
- Returns an empty `finalRows: []` (HTTP 200, not an error) when the manager has no team yet.
---

### 14. Bulk Add Sale Persons (CSV Upload)

**Purpose:** Manager (or admin) uploads a CSV to create/link many sale_person accounts at once.

- **Method:** `POST`
- **Endpoint:** `/admin/bulk-add-saleperson`
- **Authentication:** Bearer Token — role-restricted to `admin, super_admin, manager, user` (`authorizeRoles(ADMIN_AND_MANAGER)`); no separate permission grant needed.

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `multipart/form-data` |

**Request Payload** (multipart form fields)

| Field | Type | Required | Description |
|---|---|---|---|
| csv | file (.csv) | Yes | Header row (case-insensitive) with columns: `firstname, lastname, email, phone, dob`. |
| role | string | Yes (form field) | Must be `"sale_person"` for this flow. |
| branchId | number | No | Applied to every created row; validated to belong to caller's own company. |
| shiftId | number | No | Same as `branchId`. |
| createdBy | number | Conditional | Required for admin/user callers (must be themself or a subordinate); **ignored for a Manager caller** — a Manager caller is always the creator. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Bulk sale person upload completed",
  "data": {
    "totalCSV": 10, "created": 7, "linkedExisting": 1,
    "skippedInvalid": 1, "skippedDuplicateInCsv": 1, "skippedDuplicate": 0, "skippedRoleMismatch": 0,
    "createdSalePersons": [ { "id": 99, "firstName": "New", "lastName": "Rep", "email": "new@example.com", "phone": "9000000000", "tempPassword": "Xk9#..." } ],
    "linkedSalePersons": []
  }
}
```

**Sample Error Responses**

```json
// 400 - no file
{ "success": false, "code": 400, "message": "CSV file is required", "data": {} }
```
```json
// 403 - createdBy outside caller's own team (admin/user callers only)
{ "success": false, "message": "createdBy must be yourself or one of your own team members" }
```

**Validation Rules**
- CSV row requires `firstname, lastname, email, phone, dob` — rows missing any of these are skipped (not a hard failure).
- Duplicate emails within the same CSV are skipped after the first occurrence.
- An email that already exists as a non-`sale_person` user is skipped (`skippedRoleMismatch`).
- An email that already exists as a `sale_person` already linked to this creator is skipped as a duplicate; if it exists but isn't yet linked to this creator, it gets linked instead of re-created.

**Notes**
- Newly created accounts get a random `tempPassword`, returned in the response **and** emailed to the new user — the Android app can display it once for the manager to relay, but should not persist it beyond that screen.
- This is synchronous (no job polling needed).
---

### 15. Assign Employee Shift / Branch / Department

**Purpose:** Updates a single team member's shift, department, and/or branch assignment.

- **Method:** `PATCH`
- **Endpoint:** `/admin/assign-employee-shift`
- **Authentication:** Bearer Token — role-restricted to `admin, super_admin, manager, user` (`authorizeRoles(ADMIN_AND_MANAGER)`); no separate permission grant needed.

**Request Payload**

```json
{
  "employeeId": 42,
  "shiftId": 3,
  "departmentId": 2,
  "branchId": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| employeeId | number | Yes | Must be the caller or one of their team members. |
| shiftId | number \| null | No | Omit to leave unchanged; pass `null` to clear. Must belong to caller's company. |
| departmentId | number \| null | No | Same rules as `shiftId`. |
| branchId | number \| null | No | Same rules as `shiftId`. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Employee shift assignment updated",
  "data": { "id": 42, "shiftId": 3, "departmentId": 2, "branchId": 1 }
}
```

**Sample Error Responses**

```json
// 400 - missing/invalid employeeId
{ "success": false, "code": 400, "message": "Valid employeeId is required", "data": {} }
```
```json
// 403 - not caller's team member
{ "success": false, "message": "You can only assign shifts to your own team members" }
```
```json
// 400 - shift/department/branch not found or wrong company
{ "success": false, "code": 400, "message": "Shift not found", "data": {} }
```

**Validation Rules**
- `employeeId` required, must be numeric, and must be caller or a descendant.
- Every `shiftId`/`departmentId`/`branchId` supplied must exist **and** belong to the caller's own resolved company — cross-company ids are rejected as "not found".

**Notes**
- Only the fields actually present in the body are updated (partial patch semantics) — omit a field entirely to leave it unchanged; explicitly send `null` to clear it.
---

### 16. Dashboard Summary

**Purpose:** Aggregate KPI dashboard for the manager's team — headcounts, pending approvals, attendance/punctuality rates, task velocity, leave utilization.

- **Method:** `GET`
- **Endpoint:** `/admin/dashboard-summary`
- **Authentication:** Bearer Token — role-restricted to `admin, super_admin, manager, user` (`authorizeRoles(ADMIN_AND_MANAGER)`); no separate permission grant needed.

**Request Payload**

_None (GET)._

**Sample Success Response**

```json
{
  "success": true,
  "message": "Dashboard summary fetched successfully",
  "data": {
    "teamMemberCount": 12,
    "presentCount": 9,
    "pendingLeaveApprovalCount": 2,
    "pendingExpenseCount": 3,
    "meetingsThisWeekCount": 5,
    "completedQuotationCount": 4,
    "completedInvoiceCount": 6,
    "kpis": {
      "attendanceRateLast7Days": 87.5,
      "punctualityRateLast30Days": 91.2,
      "taskStats": { "total": 40, "completed": 30, "overdue": 3, "completionRate": 75.0 },
      "leaveUtilizationRate": 42.0,
      "headcountByBranch": [ { "branchId": 1, "count": 8 }, { "branchId": null, "count": 4 } ]
    }
  }
}
```

**Sample Error Responses**

Standard 401/403 auth errors only.

**Validation Rules**
- None beyond authentication — always scoped to the caller's own team.

**Notes**
- Rate fields (`attendanceRateLast7Days`, `punctualityRateLast30Days`, `leaveUtilizationRate`, `taskStats.completionRate`) can be `null` when there's no data to compute a rate from (e.g. brand-new team) — handle `null` explicitly in the UI rather than assuming a number.
- Since Manager likely lacks `quotation`/`invoice` permissions by default, `completedQuotationCount`/`completedInvoiceCount` may always read `0` for a Manager whose company hasn't separately opted them into those modules — this is expected, not a bug.
---

### 17. Top Performers

**Purpose:** Ranks the manager's team by a simple score (on-time task completions + completed meetings).

- **Method:** `GET`
- **Endpoint:** `/admin/top-performers`
- **Authentication:** Bearer Token — role-restricted to `admin, super_admin, manager, user` (`authorizeRoles(ADMIN_AND_MANAGER)`); no separate permission grant needed.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| limit | number | No | Max rows returned, default `5`. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Top performers fetched successfully",
  "data": [
    { "id": 42, "firstName": "Ravi", "lastName": "Kumar", "email": "ravi@example.com", "phone": "9999999999", "role": "sale_person", "tasksCompletedOnTime": 12, "meetingsDone": 8, "score": 20 }
  ]
}
```

**Sample Error Responses**

Standard 401/403 auth errors only.

**Validation Rules**
- None beyond authentication.

**Notes**
- Returns `data: []` (HTTP 200) when the manager has no team yet, not an error.
- `score` is simply `tasksCompletedOnTime + meetingsDone` — purely a backend-side ranking heuristic, safe to display as-is.
---
## Expense Management

### 1. Get Team Expenses (Admin/Manager view)

**Purpose:** Fetch all expense records submitted by the manager's own team (all subordinates), with optional filters.

- **Method:** `GET`
- **Endpoint:** `/admin/get-expense`
- **Authentication:** Bearer Token — requires `expense:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| search | string | No | Filters by team member's firstName, lastName, email, or phone (case-insensitive partial match) |
| approvedByAdmin | string | No | Filter by manager-approval status (e.g. `accepted`, `rejected`, or unset for pending) |
| approvedBySuperAdmin | string | No | Filter by admin/super-admin-approval status |
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "message": "Expense fetched successfully",
  "data": [
    {
      "id": 12,
      "userId": 45,
      "title": "Client visit fuel",
      "total_amount": 850,
      "amount": 850,
      "date": "2026-07-20",
      "category": "Travel",
      "description": "Fuel for client site visit",
      "location": "Pune",
      "approvedByAdmin": null,
      "approvedBySuperAdmin": null,
      "createdAt": "2026-07-20T10:15:00.000Z",
      "images": [{ "id": 3, "imageUrl": "https://.../bill1.jpg" }],
      "user": { "id": 45, "firstName": "Rahul", "lastName": "Sharma", "email": "rahul@x.com", "phone": "9999999999", "role": "sale_person" }
    }
  ],
  "pagination": { "totalRecords": 1, "totalPages": 1, "currentPage": 1, "limit": 10 }
}
```

**Sample Error Responses**

```json
// 403 - missing expense:view permission
{ "success": false, "message": "You don't have 'expense:view' permission" }
```
```json
// 400 - unexpected server-side failure
{ "success": false, "code": 400, "message": "<error detail>", "data": {} }
```

**Validation Rules**
- None on input; results are always scoped to the caller's own team (childIds derived server-side from the JWT — a manager cannot see another manager's team by passing different params).

**Notes**
- This is the team/manager-facing list. For a single team member's history use "Get Single Employee's Expense History" below.
---

### 2. Approve / Reject Expense (Manager Approval Step)

**Purpose:** Manager's first-level approval or rejection of a subordinate's expense claim. Admin/super-admin approval is a separate second step gated on the manager having approved first.

- **Method:** `PATCH`
- **Endpoint:** `/admin/approved-expense`
- **Authentication:** Bearer Token — requires `expense:approve` permission for approving, `expense:reject` conceptually maps to the same call with a rejecting value (both granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "userId": 45,
  "expenseId": 12,
  "approvedByAdmin": "accepted"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| userId | number | Yes | The employee (team member) who owns the expense — must be the manager's own subordinate, or the manager's own id |
| expenseId | number | Yes | The expense record's id |
| approvedByAdmin | string | Yes (for a manager caller) | The manager's decision — code only sets whatever string is sent verbatim (e.g. `"accepted"` or `"rejected"`); it is NOT validated against an enum, so send exactly `"accepted"` or `"rejected"` to match what the UI/other endpoints expect |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Manager approval updated",
  "data": {
    "expense": {
      "id": 12,
      "userId": 45,
      "approvedByAdmin": "accepted",
      "approvedBySuperAdmin": null
    }
  }
}
```

**Sample Error Responses**

```json
// 400 - userId missing
{ "success": false, "code": 400, "message": "userId is missing", "data": {} }
```
```json
// 400 - expenseId missing
{ "success": false, "code": 400, "message": "expenseId is missing", "data": {} }
```
```json
// 403 - target employee not in the manager's own team
{ "success": false, "message": "You can only manage expenses of your own team members" }
```
```json
// 400 - no such expense for that user
{ "success": false, "code": 400, "message": "Expense record not found", "data": {} }
```

**Validation Rules**
- `userId` must equal the caller's own id or be one of the caller's subordinates (server-checked against the creator hierarchy — cannot be spoofed).
- The expense row must exist for that exact `(userId, expenseId)` pair.
- The role branch is decided from the verified JWT role, not from any field in the body — a manager caller always hits the "Manager Approval" branch (sets `approvedByAdmin` only); it can never set `approvedBySuperAdmin` (that requires an admin/super_admin token).

**Notes**
- There is no separate "reject" endpoint — reject is the same PATCH with `approvedByAdmin: "rejected"`.
- After a manager sets `approvedByAdmin: "accepted"`, an admin/super_admin must still separately approve via the same endpoint (their token) before `approvedBySuperAdmin` is set; that second step is out of scope for the Manager role.
---

### 3. Get Single Employee's Expense History

**Purpose:** Fetch one specific team member's expense history (with optional date-range filter).

- **Method:** `GET`
- **Endpoint:** `/admin/user-expense`
- **Authentication:** Bearer Token — requires `expense:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| userId | number | Yes | The team member's user id (must be the manager's own subordinate, or the manager themselves) |
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |
| startDate / endDate | string (date) | No | Date-range filter (exact query param names come from the shared `getDateFilter` helper — pass ISO `YYYY-MM-DD`) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "User expense fetched successfully",
  "data": {
    "leave": [
      { "id": 12, "userId": 45, "title": "Client visit fuel", "amount": 850, "date": "2026-07-20" }
    ],
    "pagination": { "totalRecords": 1, "totalPages": 1, "currentPage": 1, "limit": 10 }
  }
}
```
(Note: the response key is literally `leave` for the list array — a naming leftover in the existing code, not a bug in this document.)

**Sample Error Responses**

```json
// 400 - userId missing
{ "success": false, "code": 400, "message": "UserId is required", "data": {} }
```
```json
// 403 - requested userId is not the caller's own team member
{ "success": false, "message": "You can only view expenses of your own team members" }
```

**Validation Rules**
- `userId` query param is required.
- Must resolve to the caller themself or a subordinate — enforced server-side against the JWT.

**Notes**
- None.
---

### 4. Submit Expense (Self, with bill images) — *requires extra permission grant*

**Purpose:** Mobile self-service: submit one or more expense claims (with optional bill-image uploads) for the logged-in user.

- **Method:** `POST`
- **Endpoint:** `/api/expense`
- **Authentication:** Bearer Token — requires `expense:create` permission. **Manager does NOT have this permission by default** (the Manager permission template only grants `expense:view/approve/reject`); an admin must explicitly grant `expense:create` to a manager account before this call will succeed.

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `multipart/form-data` |

**Request Payload**

Multipart form fields — `expenses` is a JSON string (or JSON array if the client can send raw JSON in a multipart field) of expense objects, plus one file field per bill image named `expenses[<index>][billImage]`:

```
expenses: '[
  {
    "title": "Client visit fuel",
    "total_amount": 850,
    "amount": 850,
    "date": "2026-07-20",
    "category": "Travel",
    "description": "Fuel for client site visit",
    "location": "Pune"
  }
]'
expenses[0][billImage]: <file>
```

| Field | Type | Required | Description |
|---|---|---|---|
| expenses | array (JSON string or array) | Yes | One or more expense entries |
| expenses[i].title | string | No | Expense title |
| expenses[i].total_amount | number | No | Total amount |
| expenses[i].amount | number | No | Amount |
| expenses[i].date | string (date) | No | Expense date |
| expenses[i].category | string | No | Expense category |
| expenses[i].description | string | No | Free-text description |
| expenses[i].location | string | No | Location |
| expenses[i][billImage] | file | No | Bill/receipt image for that expense index (multiple files supported, one per index) |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Expenses created successfully",
  "data": [
    { "id": 12, "userId": 45, "title": "Client visit fuel", "amount": 850, "date": "2026-07-20" }
  ]
}
```
(HTTP status 201)

**Sample Error Responses**

```json
// 400 - "expenses" not an array after parsing
{ "success": false, "message": "Failed to create expenses", "error": "Expenses must be an array" }
```
```json
// 403 - expense:create not granted
{ "success": false, "message": "You don't have 'expense:create' permission" }
```

**Validation Rules**
- `expenses` must parse to a non-empty array (if sent as a string, it's `JSON.parse`d server-side).
- No individual field is strictly required by the server — all are inserted as-is; validate on the client for a good UX.

**Notes**
- Only relevant if the manager account has been explicitly granted `expense:create` — otherwise omit this from a Manager-only Android build.
---

### 5. Get My Own Expenses (Self)

**Purpose:** Mobile self-service: fetch the logged-in user's own expense list.

- **Method:** `GET`
- **Endpoint:** `/api/getexpense`
- **Authentication:** Bearer Token — requires `expense:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Expense list",
  "data": {
    "totalRecords": 3,
    "totalPages": 1,
    "currentPage": 1,
    "data": [
      { "id": 12, "title": "Client visit fuel", "amount": 850, "date": "2026-07-20", "images": [] }
    ]
  }
}
```

**Sample Error Responses**

```json
// 401 - invalid/expired token
{ "code": "401", "success": false, "message": "Unauthorized — invalid or expired token" }
```

**Validation Rules**
- None beyond a valid token.

**Notes**
- This always returns the CALLING user's own expenses (their `userId` from the token) — there's no way to pass a different userId here (use `/admin/user-expense` for that).
---

## Leave Management

### 6. Request Leave on Behalf of a Team Member (Manager-initiated)

**Purpose:** Manager/admin logs a leave request for themselves or one of their own team members (web/admin-side counterpart to the mobile self-service leave request).

- **Method:** `POST`
- **Endpoint:** `/admin/request-leave`
- **Authentication:** Bearer Token — requires `leave:apply` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "employeeId": 45,
  "from_date": "2026-08-01",
  "to_date": "2026-08-02",
  "reason": "Family function",
  "companyLeaveId": 3
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| employeeId | number | No | Target team member's id; defaults to the caller's own id if omitted |
| from_date | string (date) | Yes | Leave start date |
| to_date | string (date) | Yes | Leave end date (must be ≥ from_date) |
| reason | string | Yes | Reason for leave |
| companyLeaveId | number | Yes | The company-configured leave type's id (see "Get Leave Types" below to list them) |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Leave requested successfully",
  "data": {
    "id": 88, "employee_id": 45, "from_date": "2026-08-01", "to_date": "2026-08-02",
    "reason": "Family function", "status": "pending", "leave_type": "casual", "companyLeaveId": 3
  }
}
```

**Sample Error Responses**

```json
// 403 - target employee not on the caller's team
{ "success": false, "message": "You can only request leave on behalf of your own team members" }
```
```json
// 400 - missing required fields
{ "success": false, "code": 400, "message": "from_date, to_date & reason are required", "data": {} }
```
```json
// 400 - companyLeaveId missing
{ "success": false, "code": 400, "message": "companyLeaveId is required", "data": {} }
```
```json
// 400 - insufficient balance
{ "success": false, "code": 400, "message": "Insufficient Casual Leave balance (requested 2 day(s), remaining 1)", "data": {} }
```
```json
// 400 - overlapping request
{ "success": false, "code": 400, "message": "This employee already has a leave request overlapping this date range", "data": {} }
```

**Validation Rules**
- `employeeId` (if provided) must be the caller or one of their subordinates.
- `from_date`/`to_date`/`reason`/`companyLeaveId` are required; dates must be valid and `to_date >= from_date`.
- `companyLeaveId` must belong to the caller's own company.
- `half_day` leave type requires `from_date === to_date`.
- No overlapping pending/approved leave for the same employee/date range.
- Leave balance is deducted immediately at request time (restored automatically if later rejected).

**Notes**
- This is the admin/manager "log leave for someone" flow. The Android app's own self-service leave request (for the logged-in user applying for their own leave) should use `POST /api/leave` (see #16 below) instead.
---

### 7. Approve / Reject a Leave Request

**Purpose:** Manager approves or rejects a pending leave request from a team member.

- **Method:** `PATCH`
- **Endpoint:** `/admin/approved-leave`
- **Authentication:** Bearer Token — requires `leave:approve` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "employee_id": 45,
  "leaveID": 88,
  "status": "approved"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| employee_id | number | Yes | The employee who owns the leave request |
| leaveID | number | Yes | The leave request's id |
| status | string | No (but no-op without it) | `"approved"` or `"rejected"`. On `"rejected"`, the consumed balance is restored and the employee's Attendance rows for that range flip to `leaveReject`. On `"approved"`, Attendance rows flip to `leaveApproved` |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Status updated",
  "data": { "id": 88, "employee_id": 45, "status": "approved", "from_date": "2026-08-01", "to_date": "2026-08-02" }
}
```

**Sample Error Responses**

```json
// 400 - employee_id missing
{ "success": false, "code": 400, "message": "Employee id is missing", "data": {} }
```
```json
// 400 - leaveID missing
{ "success": false, "code": 400, "message": "leaveID id is missing", "data": {} }
```
```json
// 403 - not the caller's team member
{ "success": false, "message": "You can only manage leave requests of your own team members" }
```
```json
// 400 - leave not found
{ "success": false, "code": 400, "message": "Leave not found", "data": {} }
```

**Validation Rules**
- `employee_id` must be the caller or one of their subordinates.
- The `(employee_id, leaveID)` pair must resolve to an existing leave record.

**Notes**
- None.
---

### 8. Get Team Leave List

**Purpose:** List all leave requests raised by the manager's team (optionally filtered by status).

- **Method:** `GET`
- **Endpoint:** `/admin/get-leave-list`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| status | string | No | Filter by leave status (e.g. `pending`, `approved`, `rejected`) |
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "message": "Leaves fetched successfully",
  "data": [
    { "id": 88, "employee_id": 45, "from_date": "2026-08-01", "to_date": "2026-08-02", "status": "pending", "reason": "Family function" }
  ],
  "pagination": { "totalRecords": 1, "totalPages": 1, "currentPage": 1, "limit": 10 }
}
```

**Sample Error Responses**

```json
// 403 - missing leave:view
{ "success": false, "message": "You don't have 'leave:view' permission" }
```

**Validation Rules**
- None beyond a valid token/permission.

**Notes**
- Excludes the caller's own leave requests from the list (team-only view); use "Get My Own Leave" for self.
---

### 9. Get Today's Leave Activity

**Purpose:** Dashboard widget data — who applied for leave today, and who is on approved leave today, across the manager's team.

- **Method:** `GET`
- **Endpoint:** `/admin/leave-request-today`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

None (GET request, no query params).

**Sample Success Response**

```json
{
  "success": true,
  "message": "Today's leave requests fetched successfully",
  "data": {
    "appliedToday": [ { "id": 90, "employee_id": 46, "status": "pending" } ],
    "appliedTodayCount": 1,
    "onLeaveToday": [ { "id": 88, "employee_id": 45, "status": "approved" } ],
    "onLeaveTodayCount": 1
  }
}
```

**Sample Error Responses**

```json
// 403 - missing leave:view
{ "success": false, "message": "You don't have 'leave:view' permission" }
```

**Validation Rules**
- None.

**Notes**
- None.
---

### 10. Cancel Leave and Mark Present

**Purpose:** Cancels an already-requested/approved leave for a team member (restoring their balance) and immediately marks that day's attendance as present — e.g. the employee showed up despite having leave on record.

- **Method:** `POST`
- **Endpoint:** `/admin/cancel-leave-and-mark-present`
- **Authentication:** Bearer Token — requires BOTH `leave:approve` AND `attendance:update` permissions (both granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "employeeId": 45,
  "leaveID": 88,
  "date": "2026-08-01",
  "punchIn": "2026-08-01T09:05:00.000Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| employeeId | number | Yes | Team member's id (must be caller's own subordinate) |
| leaveID | number | Yes | The leave request's id to cancel |
| date | string (date) | No | The attendance date to mark present; defaults to today |
| punchIn | string (ISO datetime) | No | Punch-in time to record; defaults to now |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Leave cancelled and attendance marked present",
  "data": {
    "leave": { "id": 88, "status": "rejected" },
    "attendance": { "employee_id": 45, "date": "2026-08-01", "status": "present", "punch_in": "2026-08-01T09:05:00.000Z" }
  }
}
```

**Sample Error Responses**

```json
// 400 - employeeId missing
{ "success": false, "code": 400, "message": "employeeId is required", "data": {} }
```
```json
// 400 - leaveID missing
{ "success": false, "code": 400, "message": "leaveID is required", "data": {} }
```
```json
// 400 - not caller's team member
{ "success": false, "code": 400, "message": "You can only manage attendance/leave for your own team members", "data": {} }
```
```json
// 400 - leave not found
{ "success": false, "code": 400, "message": "Leave not found", "data": {} }
```

**Validation Rules**
- `employeeId` must be one of the caller's subordinates.
- The `(employeeId, leaveID)` pair must resolve to an existing leave.

**Notes**
- Internally sets the leave's status to `"rejected"` as part of cancelling it — the leave record will show as rejected, not as a separate "cancelled" state.
---

### 11. Assign Leave Balance to Team Member(s) — *requires `leave:manage`, not in Manager's default set*

**Purpose:** Set/update how many days of each leave type an employee (or a batch of employees) is allocated for a given year.

- **Method:** `POST`
- **Endpoint:** `/admin/assign-leave-balance`
- **Authentication:** Bearer Token — requires `leave:manage` permission. **Not included in Manager's default permission template** — an admin must explicitly grant it for a manager to use this.

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "employeeId": 45,
  "year": 2026,
  "balances": [
    { "companyLeaveId": 3, "allocated": 12 },
    { "companyLeaveId": 4, "allocated": 6 }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| employeeId | number or number[] | Yes | One employee id or an array of ids (must all be caller's subordinates) |
| year | number | No | Defaults to current year |
| balances | array | Yes | One entry per leave type being set |
| balances[].companyLeaveId | number | Yes | Must be a leave type configured for the caller's company |
| balances[].allocated | number | Yes | Days allocated — capped at that leave type's own `leavesPerYear` policy value |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Leave balance assigned successfully",
  "data": {
    "employeeId": 45,
    "year": 2026,
    "balances": [
      { "companyLeaveId": 3, "leaveName": "Casual Leave", "allocated": 12, "used": 2, "remaining": 10 }
    ]
  }
}
```

**Sample Error Responses**

```json
// 400 - employeeId missing
{ "success": false, "code": 400, "message": "employeeId is required", "data": {} }
```
```json
// 400 - allocation exceeds policy cap
{ "success": false, "code": 400, "message": "Casual Leave is capped at 12 day(s)/year by this company's leave policy — cannot allocate 15", "data": {} }
```
```json
// 400 - unauthorized employee
{ "success": false, "code": 400, "message": "You can only assign leave balance to your own sale_persons. Unauthorized employeeId(s): 99", "data": {} }
```

**Validation Rules**
- Every `employeeId` must be a subordinate of the caller.
- Every `companyLeaveId` must belong to the caller's company.
- `allocated` is capped by that leave type's configured `leavesPerYear`.

**Notes**
- Requires `leave:manage`, which Manager does not get by default — include this endpoint in the Android build only if that permission will be granted.
---

### 12. Get Team Leave Balances (list)

**Purpose:** Paginated leave-balance overview for the whole team, one row per employee with all their leave-type balances.

- **Method:** `GET`
- **Endpoint:** `/admin/leave-balance-list`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| year | number | No | Defaults to current year |
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Team leave balances fetched successfully",
  "data": {
    "totalRecords": 5, "totalPages": 1, "currentPage": 1,
    "data": [
      {
        "id": 45, "firstName": "Rahul", "lastName": "Sharma",
        "leaveBalances": [ { "companyLeaveId": 3, "leaveName": "Casual Leave", "allocated": 12, "used": 2, "remaining": 10 } ]
      }
    ]
  }
}
```

**Sample Error Responses**

```json
// 403 - missing leave:view
{ "success": false, "message": "You don't have 'leave:view' permission" }
```

**Validation Rules**
- None.

**Notes**
- None.
---

### 13. Get Single Employee's Leave Balance

**Purpose:** Detailed leave-balance breakdown for one specific team member.

- **Method:** `GET`
- **Endpoint:** `/admin/leave-balance/:employeeId`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| employeeId | number | The team member's user id |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| year | number | No | Defaults to current year |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Leave balance fetched successfully",
  "data": {
    "employeeId": 45, "year": 2026,
    "balances": [ { "companyLeaveId": 3, "leaveName": "Casual Leave", "allocated": 12, "used": 2, "remaining": 10 } ]
  }
}
```

**Sample Error Responses**

```json
// 400 - not caller's subordinate
{ "success": false, "code": 400, "message": "You can only view leave balance of your own sale_persons", "data": {} }
```

**Validation Rules**
- `employeeId` must be caller's own id or subordinate.

**Notes**
- None.
---

### 14. Get Single Employee's Leave History

**Purpose:** All leave requests raised by one specific team member.

- **Method:** `GET`
- **Endpoint:** `/admin/user-leave`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| userId | number | Yes | Team member's user id |
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "User leave fetched successfully",
  "data": {
    "leave": [ { "id": 88, "from_date": "2026-08-01", "to_date": "2026-08-02", "status": "approved" } ],
    "pagination": { "totalRecords": 1, "totalPages": 1, "currentPage": 1, "limit": 10 }
  }
}
```

**Sample Error Responses**

```json
// 400 - userId missing
{ "success": false, "code": 400, "message": "UserId is required", "data": {} }
```
```json
// 403 - not caller's team member
{ "success": false, "message": "You can only view leave records of your own team members" }
```

**Validation Rules**
- `userId` required; must be caller or subordinate.

**Notes**
- None.
---

### 15. Get My Own Leave (Manager's own leave history, web-side)

**Purpose:** The caller's own leave request history (admin/manager-side route — separate from the mobile `/api/leave-list`, same data shape).

- **Method:** `GET`
- **Endpoint:** `/admin/getown-leave`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Leave fetched successfully",
  "data": {
    "leave": [ { "id": 70, "from_date": "2026-06-10", "to_date": "2026-06-10", "status": "approved" } ],
    "pagination": { "totalRecords": 1, "totalPages": 1, "currentPage": 1, "limit": 10 }
  }
}
```

**Sample Error Responses**

```json
// 400 - no leave records at all
{ "success": false, "code": 400, "message": "No leaves found", "data": {} }
```

**Validation Rules**
- None beyond a valid token.

**Notes**
- Prefer `GET /api/leave-list` (below) for the Android app's own "My Leaves" screen — functionally equivalent, mobile-side route.
---

### 16. Request My Own Leave (Mobile self-service)

**Purpose:** The logged-in user (manager) requests leave for themselves.

- **Method:** `POST`
- **Endpoint:** `/api/leave`
- **Authentication:** Bearer Token — requires `leave:apply` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "from_date": "2026-08-05",
  "to_date": "2026-08-05",
  "reason": "Personal work",
  "companyLeaveId": 3
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| from_date | string (date) | Yes | Leave start date |
| to_date | string (date) | Yes | Leave end date (≥ from_date) |
| reason | string | Yes | Reason for leave |
| leave_type | string | Conditionally required | One of the fixed enum values (`casual`, `sick`, `paid`, `unpaid`, `short_leave`, `half_day`) — required ONLY if `companyLeaveId` is not sent; if `companyLeaveId` is sent, this is inferred automatically |
| companyLeaveId | number | Conditionally required | Company-configured leave type id — required ONLY if `leave_type` is not sent |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Leave requested successfully",
  "data": { "id": 91, "employee_id": 12, "from_date": "2026-08-05", "to_date": "2026-08-05", "reason": "Personal work", "status": "pending", "leave_type": "casual" }
}
```

**Sample Error Responses**

```json
// 400 - missing core fields
{ "success": false, "message": "from_date, to_date & reason are required" }
```
```json
// 400 - neither leave_type nor companyLeaveId sent
{ "success": false, "message": "leave_type or companyLeaveId is required" }
```
```json
// 400 - invalid leave_type value
{ "success": false, "message": "leave_type must be one of: casual, sick, paid, unpaid, short_leave, half_day" }
```
```json
// 400 - duplicate/overlapping request
{ "success": false, "message": "You have already applied for leave on this date" }
```
```json
// 400 - insufficient balance
{ "success": false, "message": "Insufficient Casual Leave balance (requested 1 day(s), remaining 0)" }
```
```json
// 400 - half-day spans more than one day
{ "success": false, "message": "half_day leave must have from_date equal to to_date" }
```

**Validation Rules**
- `from_date`, `to_date`, `reason` required; `to_date >= from_date`.
- Exactly one of `leave_type` / `companyLeaveId` must effectively be resolvable.
- No existing pending/approved leave overlapping the same date range for this user.
- Sufficient balance required (checked against the resolved leave type).
- `half_day` requires `from_date === to_date`.

**Notes**
- This is the primary self-service leave endpoint for the mobile app (any role including manager applying for their own leave).
---

### 17. Get My Own Leave List (Mobile)

**Purpose:** The logged-in user's own leave request history, mobile-side.

- **Method:** `GET`
- **Endpoint:** `/api/leave-list`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Page number (default 1) |
| limit | number | No | Page size (default 10) |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "message": "Leave list",
  "data": {
    "totalRecords": 1, "totalPages": 1, "currentPage": 1,
    "data": [
      { "id": 91, "from_date": "2026-08-05", "to_date": "2026-08-05", "status": "pending", "leaveTypeRef": { "id": 3, "leaveName": "Casual Leave", "leaveCode": "CL" } }
    ]
  }
}
```

**Sample Error Responses**

```json
// 401 - invalid/expired token
{ "code": "401", "success": false, "message": "Unauthorized — invalid or expired token" }
```

**Validation Rules**
- None beyond a valid token.

**Notes**
- Each row includes the resolved `leaveTypeRef` object so the client doesn't need a separate lookup call.
---

### 18. Get My Own Leave Balance (Mobile)

**Purpose:** The logged-in user's own leave-type balances for a given year.

- **Method:** `GET`
- **Endpoint:** `/api/my-leave-balance`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| year | number | No | Defaults to current year |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "message": "Leave balance fetched",
  "data": {
    "year": 2026,
    "leaveTypeBalances": [
      { "companyLeaveId": 3, "leaveName": "Casual Leave", "leaveCode": "CL", "leavesPerYear": 12, "carryForwardAllowed": true, "carryForwardLimit": 3, "allocated": 12, "carriedForward": 2, "used": 3, "remaining": 11 }
    ]
  }
}
```
(Exact top-level `data` shape may include additional legacy fields — the dynamic `leaveTypeBalances` array shown above is the authoritative, currently-used source.)

**Sample Error Responses**

```json
// 401 - invalid/expired token
{ "code": "401", "success": false, "message": "Unauthorized — invalid or expired token" }
```

**Validation Rules**
- None beyond a valid token.

**Notes**
- If the caller has no `companyId` resolved (no company context), `leaveTypeBalances` returns empty.
---

### 19. Get Leave Types (Company Leave Policy list) — read part needs only `leave:view`

**Purpose:** List the company's configured leave types (Casual, Sick, Paid, etc.) — needed to populate the `companyLeaveId` dropdown used by leave-request/assign-balance calls.

- **Method:** `GET`
- **Endpoint:** `/admin/get-leave`
- **Authentication:** Bearer Token — requires `leave:view` permission (granted to Manager by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Default 1 |
| limit | number | No | Default 10 |
| search | string | No | Matches against leaveName/leaveCode |
| leaveCode | string | No | Exact leave code filter |
| companyId | number | No | View another accessible company's types (defaults to caller's own created rows if omitted) |
| branchId | number | No | Filter by branch |
| managerApproval | "true"/"false" | No | Filter by whether the type requires manager approval |

**Request Payload**

None (GET request).

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Leaves fetched successfully",
  "data": {
    "total": 3, "currentPage": 1, "totalPages": 1,
    "data": [ { "id": 3, "leaveName": "Casual Leave", "leaveCode": "CL", "leavesPerYear": 12, "carryForward": true, "carryForwardLimit": 3, "managerApproval": true } ]
  }
}
```

**Sample Error Responses**

```json
// 403 - companyId given but caller has no access to it
{ "success": false, "code": 403, "message": "You do not have access to this company" }
```

**Validation Rules**
- If `companyId` is passed, caller must have access to that company (checked server-side).

**Notes**
- `add-leave` (create a new leave-type policy) and `update-leave/:id` (edit one) both require `leave:manage`, which Manager does not have by default — omit those two write endpoints from a Manager-only build unless that permission is granted. Their paths are `POST /admin/add-leave` and `PATCH /admin/update-leave/:id`, and `GET /admin/get-leave/:id` (single leave-type detail, `leave:view`) is also available if needed.
---
## Meeting Management

### 1. Schedule Meeting (New/Existing Client)

**Purpose:** Manager schedules a meeting for one of their team members (a sale_person or themself), against a client (existing or brand-new). This is the flagship manager-initiated scheduling feature.

- **Method:** `POST`
- **Endpoint:** `/admin/meetings/schedule`
- **Authentication:** Bearer Token — requires `meeting:schedule` permission (**granted to Manager by default**)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "targetUserId": 45,
  "meetingUserId": 12,
  "meetingPurpose": "Product demo",
  "categoryId": 3,
  "subCategoryId": 7,
  "scheduledTime": "2026-08-05T10:30:00.000Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| targetUserId | number | Yes | The employee (must be the manager themself or one of their own team/subordinates) the meeting is scheduled *for*. |
| meetingUserId | number | Yes | The client (`MeetingUser` record) the meeting is with. Must belong to the manager's client pool (shared across all managers under the same admin). |
| meetingPurpose | string | Conditional | Required only if this client (`meetingUserId`) has **no previous meeting** — i.e. this is their first-ever meeting ("brand-new client" case). If the client already has a prior meeting, this is optional and defaults to the purpose/category/sub-category copied from their most recent meeting. |
| categoryId | number | No | Defaults to the client's latest meeting's category if omitted and a prior meeting exists. |
| subCategoryId | number | No | Same fallback behavior as categoryId. |
| scheduledTime | string (ISO 8601 datetime) | Yes | Must parse to a valid date. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Meeting scheduled successfully",
  "data": {
    "id": 501,
    "userId": 45,
    "meetingUserId": 12,
    "companyId": 88,
    "meetingPurpose": "Product demo",
    "categoryId": 3,
    "subCategoryId": 7,
    "scheduledTime": "2026-08-05T10:30:00.000Z",
    "status": "scheduled",
    "createdAt": "2026-07-30T09:12:00.000Z",
    "updatedAt": "2026-07-30T09:12:00.000Z"
  }
}
```

**Sample Error Responses**

```json
// 400 - missing required fields
{ "success": false, "code": 400, "message": "targetUserId, meetingUserId and scheduledTime are required", "data": {} }
```
```json
// 400 - malformed date
{ "success": false, "code": 400, "message": "Invalid scheduledTime", "data": {} }
```
```json
// 403 - target employee outside manager's own team
{ "success": false, "code": 400, "message": "You can only schedule meetings for your own team members", "data": {} }
```
```json
// 400 - client not found
{ "success": false, "code": 400, "message": "Client not found", "data": {} }
```
```json
// 403 - client outside manager's client pool
{ "success": false, "code": 400, "message": "You can only schedule meetings for your own clients", "data": {} }
```
```json
// 400 - first-ever meeting for this client with no purpose supplied
{ "success": false, "code": 400, "message": "meetingPurpose is required when scheduling a first meeting for a new client", "data": {} }
```
```json
// 400 - client record incomplete
{ "success": false, "code": 400, "message": "This client is missing a company name or mobile number required to schedule a meeting", "data": {} }
```
```json
// 400 - double-booking
{ "success": false, "code": 400, "message": "This employee already has a meeting scheduled at this exact time", "data": {} }
```
```json
// 403 - missing meeting:schedule permission
{ "success": false, "message": "You don't have 'meeting:schedule' permission" }
```

> Note: `ServiceError`s in this endpoint are thrown with default HTTP semantics mapped to `badRequest` (400) by the controller, EXCEPT the two explicitly marked "You can only..." ownership errors, which are thrown with `status: 403` and map to `forbidden` — the JSON body shape is the same either way (`{ success:false, message }`), only the HTTP status code differs (400 vs 403). Treat both families as client-fixable validation errors in the Android app's UI.

**Validation Rules**
- `targetUserId`, `meetingUserId`, `scheduledTime` are all required.
- `scheduledTime` must be a parseable date/time.
- `targetUserId` must be the caller themself or a descendant in their own team (managers cannot schedule meetings for their own admin or peer managers).
- `meetingUserId` must reference an existing `MeetingUser` (client) within the caller's client scope (for a manager: all clients belonging to any team under the same parent admin).
- If the client has never had a meeting before, `meetingPurpose` is mandatory (new-client path). Otherwise it — and `categoryId`/`subCategoryId` — fall back to the client's latest meeting.
- The client record must already have a company name (or name) and a mobile number.
- No two meetings may be scheduled for the same `targetUserId` at the exact same `scheduledTime`.

**Notes**
- This is the "brand-new client" flow referenced in product notes: there is no separate endpoint for new vs. existing clients — the same endpoint infers it from whether `meetingUserId` already has a prior meeting, and simply requires `meetingPurpose` when it doesn't.
- `meetingUserId` (the client) is a shared pool across every manager under the same admin — it is NOT scoped to just the calling manager's own clients.
- This endpoint does not itself create the `MeetingUser` (client) record — the client must already exist (created via the legacy client-creation flow) before scheduling.

---

### 2. Reschedule Meeting

**Purpose:** Change the scheduled date/time of an existing, not-yet-started meeting.

- **Method:** `PATCH`
- **Endpoint:** `/admin/meetings/:id/reschedule`
- **Authentication:** Bearer Token — requires `meeting:update` permission (**granted to Manager by default**)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | The meeting's ID (`Meeting.id`). |

**Request Payload**

```json
{
  "scheduledTime": "2026-08-06T14:00:00.000Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| scheduledTime | string (ISO 8601 datetime) | Yes | The new date/time for the meeting. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Meeting rescheduled successfully",
  "data": {
    "id": 501,
    "userId": 45,
    "meetingUserId": 12,
    "scheduledTime": "2026-08-06T14:00:00.000Z",
    "status": "scheduled"
  }
}
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "code": 400, "message": "meetingId and scheduledTime are required", "data": {} }
```
```json
// 400 - malformed date
{ "success": false, "code": 400, "message": "Invalid scheduledTime", "data": {} }
```
```json
// 400 - not found
{ "success": false, "code": 400, "message": "Meeting not found", "data": {} }
```
```json
// 403 - meeting belongs to someone outside the manager's team
{ "success": false, "code": 400, "message": "You can only reschedule meetings for your own team members", "data": {} }
```
```json
// 400 - already cancelled
{ "success": false, "code": 400, "message": "This meeting was cancelled and cannot be rescheduled", "data": {} }
```
```json
// 400 - already started/completed
{ "success": false, "code": 400, "message": "This meeting has already started and can no longer be rescheduled", "data": {} }
```
```json
// 403 - missing meeting:update permission
{ "success": false, "message": "You don't have 'meeting:update' permission" }
```

**Validation Rules**
- `id` path param must reference an existing meeting.
- `scheduledTime` is required and must be a valid date.
- The meeting must belong to the caller's own team (a manager cannot reschedule another manager's or their admin's meetings).
- Only meetings with status `scheduled` or `pending` can be rescheduled — `cancelled`, `in`, `out`, or `completed` meetings are rejected.

**Notes**
- Only the time changes; employee, client, purpose, and category stay the same. To reassign to a different employee/client, use the legacy `POST /admin/assign-meeting` instead.

---

### 3. Meeting Dashboard

**Purpose:** Team-scoped meeting analytics for the manager (today/week/month counts, status breakdown, 14-day trend, top performer, new-clients-this-month).

- **Method:** `GET`
- **Endpoint:** `/admin/meetings/dashboard`
- **Authentication:** Bearer Token — requires `meeting:view` permission (**granted to Manager by default**)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

No path or query parameters, no request body.

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Meeting dashboard fetched successfully",
  "data": {
    "scheduledToday": 4,
    "scheduledThisWeek": 19,
    "scheduledThisMonth": 62,
    "upcoming": 9,
    "completionRate": 71.4,
    "statusBreakdown": {
      "scheduled": 12,
      "pending": 3,
      "in": 2,
      "out": 1,
      "completed": 42,
      "cancelled": 2
    },
    "trend": [
      { "date": "2026-07-17", "count": 3 },
      { "date": "2026-07-18", "count": 5 }
    ],
    "topPerformer": { "userId": 45, "name": "Rahul Sharma", "completed": 14 },
    "newClientsThisMonth": 6
  }
}
```

**Sample Error Responses**

```json
// 403 - missing meeting:view permission
{ "success": false, "message": "You don't have 'meeting:view' permission" }
```
```json
// 401 - invalid/expired token
{ "code": "401", "success": false, "message": "Unauthorized — invalid or expired token" }
```

**Validation Rules**
- None beyond authentication/permission — this is a read-only aggregate endpoint.

**Notes**
- Scoped to the manager's own **team** (themself + all subordinates), NOT their whole admin's organization.
- `trend` always contains exactly 14 entries (one per day, oldest first), even for days with zero meetings.
- `topPerformer` is `null` when no meetings were completed this month.
- `completionRate` is `null` when `scheduledThisMonth` is 0 (avoids divide-by-zero).

---

### 4. Assign / Schedule Meeting (Legacy)

**Purpose:** Older, simpler way to assign an already-created meeting record to a team member at a given time. Still live and mounted alongside the new `/admin/meetings/schedule` endpoint — kept for backward compatibility, not being replaced.

- **Method:** `POST`
- **Endpoint:** `/admin/assign-meeting`
- **Authentication:** Bearer Token only — **no `checkPermission` gate**, just requires a valid `/admin`-side token (user/admin/super_admin/manager).

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "userId": 45,
  "meetingId": 501,
  "scheduledTime": "2026-08-05T10:30:00.000Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| userId | number | Yes | Employee the meeting is assigned to (caller themself or a subordinate). |
| meetingId | number | Yes | ID of an **existing** `Meeting` record (typically one created via the sale_person-side `/api/createmeeting`) to duplicate/reassign. |
| scheduledTime | string (ISO 8601 datetime) | Yes | Time for the new assignment. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Meeting scheduled successfully",
  "data": {}
}
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "code": 400, "message": "userId, meetingId and scheduledTime are required", "data": {} }
```
```json
// 400 - meeting not found
{ "success": false, "code": 400, "message": "Meeting not found", "data": {} }
```
```json
// 403 - meeting belongs to a different company
{ "success": false, "code": 400, "message": "You can only assign meetings within your own company", "data": {} }
```
```json
// 403 - target user outside caller's team
{ "success": false, "code": 400, "message": "You can only assign meetings to your own team members", "data": {} }
```
```json
// 400 - duplicate time slot
{ "success": false, "code": 400, "message": "This meeting is already scheduled at this time", "data": {} }
```

**Validation Rules**
- `userId`, `meetingId`, `scheduledTime` all required.
- Meeting must exist and belong to the caller's own company (unless `super_admin`).
- `userId` must be the caller or one of their own team members.
- Rejects an exact duplicate `(meeting.userId, scheduledTime)` pair.

**Notes**
- Prefer the new `POST /admin/meetings/schedule` for new development — it has richer client-handling (new vs. existing client) and proper permission gating. This legacy endpoint is documented for completeness since it remains live and unguarded by `checkPermission`.

---

### 5. Get Team Meetings (Legacy)

**Purpose:** Paginated, searchable list of the manager's team's meetings (with client + meeting join data).

- **Method:** `GET`
- **Endpoint:** `/admin/getusermeeting`
- **Authentication:** Bearer Token only — **no `checkPermission` gate**.

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Default `1`. |
| limit | number | No | Default `10`. |
| search | string | No | Matches against client `companyName` or `personName` (case-insensitive, partial). |
| userId | number | No | Filter to one specific team member. Must be the caller or one of their own subordinates, else `403`. |
| date | string (date) | No | Filters by `meetingTimeIn` within that UTC calendar day. |
| empty | `"true"` | No | When `"true"`, forces the result to only the caller's own records (`userId = caller`), ignoring the `userId` query param. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "User Meeting fetched successfully",
  "data": {
    "page": 1,
    "limit": 10,
    "total": 27,
    "totalPages": 3,
    "rows": [
      {
        "id": 12,
        "companyName": "Acme Pvt Ltd",
        "personName": "Rahul Sharma",
        "mobileNumber": "9876543210",
        "companyEmail": "rahul@acme.com",
        "meetingTimeIn": "2026-07-29T09:00:00.000Z",
        "meetingTimeOut": null,
        "userId": 45,
        "Meetings": [ { "id": 501, "status": "scheduled", "scheduledTime": "2026-08-05T10:30:00.000Z" } ]
      }
    ]
  }
}
```

**Sample Error Responses**

```json
// 400 - no results
{ "success": false, "code": 400, "message": "Not meeting found", "data": {} }
```
```json
// 403 - requested userId outside caller's team
{ "success": false, "code": 400, "message": "You can only view meetings of your own team members", "data": {} }
```

**Validation Rules**
- If `userId` is supplied, it must be within the caller's allowed team scope (self + all descendants); a manager's scope resolves up to their parent admin's whole org for this endpoint (matches the "client scope" used by the new dashboard/schedule endpoints).
- Without `userId`/`empty`, results default to every team member the caller can see.

**Notes**
- Returns rows from the `MeetingUser` (client) table, each with nested `Meetings`, not a flat `Meeting` list — plan the Android model accordingly.
- A `400` is returned (not an empty `200` list) when there are zero matching rows — handle this in the app as an empty-state, not a hard error.

---

## Task Management

All 5 endpoints below are mounted at `/admin/task` and gated purely by `authorizeRoles(admin, super_admin, manager, user)` — **not** by `checkPermission`, so Manager can call every one of them (including delete) regardless of the `task:*` entries in their permission template.

### 6. Create Task

**Purpose:** Manager assigns a new task to one of their sale_persons.

- **Method:** `POST`
- **Endpoint:** `/admin/task/create`
- **Authentication:** Bearer Token — role must be one of `admin, super_admin, manager, user` (role-gated, not permission-gated)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "title": "Follow up with Acme Pvt Ltd",
  "description": "Confirm PO details after last week's demo",
  "priority": "high",
  "dueDate": "2026-08-10T00:00:00.000Z",
  "assignedTo": 52,
  "tags": ["follow-up", "acme"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| title | string | Yes | Task title. |
| description | string | No | Free text. |
| priority | `"low"｜"medium"｜"high"｜"urgent"` | No | Defaults to `"medium"`. |
| dueDate | string (ISO date) | No | |
| assignedTo | number | Yes | Target user's ID. **A manager may only assign to a `sale_person`** in their own tenant. |
| tags | string[] | No | |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Task created",
  "data": {
    "id": 301,
    "title": "Follow up with Acme Pvt Ltd",
    "description": "Confirm PO details after last week's demo",
    "status": "todo",
    "priority": "high",
    "dueDate": "2026-08-10T00:00:00.000Z",
    "assignedTo": 52,
    "assignedBy": 45,
    "companyId": 88,
    "tags": ["follow-up", "acme"],
    "createdAt": "2026-07-30T09:12:00.000Z",
    "updatedAt": "2026-07-30T09:12:00.000Z"
  }
}
```
(HTTP status 201)

**Sample Error Responses**

```json
// 400 - missing required fields
{ "success": false, "message": "title and assignedTo are required" }
```
```json
// 404 - assignee doesn't exist / inactive
{ "success": false, "message": "Assigned user not found or inactive" }
```
```json
// 403 - cross-tenant assignment
{ "success": false, "message": "Cannot assign tasks to users outside your tenant" }
```
```json
// 403 - manager assigning to a non-sale_person
{ "success": false, "message": "Managers can only assign tasks to sale persons" }
```
```json
// 403 - role not allowed (authorizeRoles gate)
{ "success": false, "message": "Forbidden — requires one of: admin, super_admin, manager, user" }
```
```json
// 500
{ "success": false, "message": "Internal server error" }
```

**Validation Rules**
- `title` and `assignedTo` are required.
- `assignedTo` must reference an active user.
- `assignedTo` must be in the same tenant as the caller.
- **Manager can only assign to `sale_person`** (admin/super_admin can assign to manager or sale_person).

**Notes**
- `status` is always created as `"todo"` — there is no way to set initial status via this endpoint.
- `companyId` is taken from the caller's JWT, never from the request body.

---

### 7. List Tasks

**Purpose:** Paginated, filterable list of tasks. A manager only ever sees tasks **they personally created**.

- **Method:** `GET`
- **Endpoint:** `/admin/task/list`
- **Authentication:** Bearer Token — role-gated (`admin, super_admin, manager, user`)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| status | `"todo"｜"in_progress"｜"completed"｜"cancelled"` | No | Exact match. |
| priority | `"low"｜"medium"｜"high"｜"urgent"` | No | Exact match. |
| assignedTo | number | No | Filter to one assignee. |
| tags | string | No | Exact match against the `tags` array column. |
| page | number | No | Default `1`. |
| limit | number | No | Default `20`, capped at `50`. |

**Sample Success Response**

```json
{
  "success": true,
  "total": 34,
  "totalPages": 2,
  "currentPage": 1,
  "data": [
    {
      "id": 301,
      "title": "Follow up with Acme Pvt Ltd",
      "status": "todo",
      "priority": "high",
      "dueDate": "2026-08-10T00:00:00.000Z",
      "assignee": { "id": 52, "firstName": "Vishal", "lastName": "Rao", "email": "vishal@company.com", "role": "sale_person" },
      "creator": { "id": 45, "firstName": "Rahul", "lastName": "Sharma", "email": "rahul@company.com", "role": "manager" }
    }
  ]
}
```

**Sample Error Responses**

```json
// 500
{ "success": false, "message": "Internal server error" }
```

**Validation Rules**
- None on inputs beyond type coercion; `limit` is clamped to a max of 50.

**Notes**
- Response envelope here is **flat** (`total`/`totalPages`/`currentPage`/`data` at the top level) — it does NOT use the `success/code/message/data` wrapper used elsewhere. Handle this endpoint's shape as a special case in the Android network layer.
- For `role === "manager"`, results are always additionally filtered to `assignedBy = <manager's own userId>` — a manager cannot see tasks created by another manager or by their admin.

---

### 8. Get Task By ID

**Purpose:** Fetch a single task's details.

- **Method:** `GET`
- **Endpoint:** `/admin/task/:id`
- **Authentication:** Bearer Token — role-gated (`admin, super_admin, manager, user`)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Task ID. |

**Sample Success Response**

```json
{
  "success": true,
  "data": {
    "id": 301,
    "title": "Follow up with Acme Pvt Ltd",
    "status": "todo",
    "priority": "high",
    "assignee": { "id": 52, "firstName": "Vishal", "lastName": "Rao", "email": "vishal@company.com", "role": "sale_person" },
    "creator": { "id": 45, "firstName": "Rahul", "lastName": "Sharma", "email": "rahul@company.com", "role": "manager" }
  }
}
```

**Sample Error Responses**

```json
// 404
{ "success": false, "message": "Task not found" }
```

**Validation Rules**
- A manager can only fetch a task they created (`assignedBy = caller`) within their own company; otherwise it 404s (indistinguishable from "doesn't exist").

**Notes**
- None.

---

### 9. Update Task

**Purpose:** Edit a task's fields and/or reassign it.

- **Method:** `PATCH`
- **Endpoint:** `/admin/task/update/:id`
- **Authentication:** Bearer Token — role-gated (`admin, super_admin, manager, user`)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Task ID. |

**Request Payload**

```json
{
  "title": "Follow up with Acme Pvt Ltd (revised)",
  "description": "Client asked to push call to Friday",
  "status": "in_progress",
  "priority": "urgent",
  "dueDate": "2026-08-12T00:00:00.000Z",
  "assignedTo": 53
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| title | string | No | Any subset of fields may be sent — only fields present are updated. |
| description | string | No | |
| status | `"todo"｜"in_progress"｜"completed"｜"cancelled"` | No | |
| priority | `"low"｜"medium"｜"high"｜"urgent"` | No | |
| dueDate | string (ISO date) | No | |
| assignedTo | number | No | Reassigning re-runs the same role/tenant checks as task creation. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Task updated",
  "data": {
    "id": 301,
    "title": "Follow up with Acme Pvt Ltd (revised)",
    "status": "in_progress",
    "priority": "urgent",
    "assignedTo": 53
  }
}
```

**Sample Error Responses**

```json
// 404 - task not found / not owned by this manager
{ "success": false, "message": "Task not found" }
```
```json
// 404 - new assignee invalid
{ "success": false, "message": "Assigned user not found or inactive" }
```
```json
// 403 - cross-tenant reassignment
{ "success": false, "message": "Cannot assign tasks to users outside your tenant" }
```
```json
// 403 - manager reassigning to a non-sale_person
{ "success": false, "message": "Managers can only assign tasks to sale persons" }
```

**Validation Rules**
- A manager can only update a task they created.
- If `assignedTo` is included, the same active/tenant/role rules from Create Task apply.

**Notes**
- There is no explicit `completedAt` handling here — setting `status: "completed"` does not appear to auto-stamp `completedAt` in this controller.

---

### 10. Delete Task

**Purpose:** Permanently delete a task.

- **Method:** `DELETE`
- **Endpoint:** `/admin/task/delete/:id`
- **Authentication:** Bearer Token — role-gated (`admin, super_admin, manager, user`)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Task ID. |

**Sample Success Response**

```json
{ "success": true, "message": "Task deleted" }
```

**Sample Error Responses**

```json
// 404
{ "success": false, "message": "Task not found" }
```

**Validation Rules**
- A manager can only delete a task they created (`assignedBy = caller`) within their own company.

**Notes**
- **Important discrepancy:** the manager permission template (`src/config/permissionTemplates.ts`) does **not** grant `task:delete` — but this route is gated only by `authorizeRoles(ADMIN_AND_MANAGER)`, not `checkPermission`, so a manager CAN delete tasks in practice despite lacking that permission on paper. Flag this to product/backend if it's unintended; document it as "available" for the Android app either way since the route currently allows it.

---

## Reports & Insights

### 1. Generate Insights Report

**Purpose:** Generates an aggregated activity report (employees, attendance, leaves, meetings, tasks, expenses, quotations, invoices) for a company within a date range, scoped to the manager's own team.

- **Method:** `GET`
- **Endpoint:** `/admin/reports/generate`
- **Authentication:** Bearer Token — requires `insights:view` permission (Manager has this by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| companyId | number | Yes | Company to generate the report for. A manager assigned to multiple companies must pass the specific one — never inferred. |
| fromDate | string (`YYYY-MM-DD`) | Yes | Start of date range. |
| toDate | string (`YYYY-MM-DD`) | Yes | End of date range (inclusive, extended internally to 23:59:59.999). |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Report generated successfully",
  "data": {
    "companyId": 12,
    "dateRange": { "fromDate": "2026-07-01", "toDate": "2026-07-30" },
    "employees": [ { "id": 45, "firstName": "Ravi", "lastName": "Kumar", "role": "sale_person" } ],
    "attendance": [ { "id": 901, "userId": 45, "status": "present", "date": "2026-07-29" } ],
    "leaves": [],
    "meetings": [],
    "tasks": [],
    "expenses": [],
    "quotations": [],
    "invoices": []
  }
}
```

**Sample Error Responses**

```json
// 400 - missing companyId
{ "success": false, "code": 400, "message": "companyId is required", "data": {} }
```
```json
// 400 - missing dates
{ "success": false, "code": 400, "message": "fromDate and toDate are required", "data": {} }
```
```json
// 400 - bad date
{ "success": false, "code": 400, "message": "Invalid date format", "data": {} }
```
```json
// 400 - inverted range
{ "success": false, "code": 400, "message": "toDate must be after fromDate", "data": {} }
```
```json
// 400 - range too wide
{ "success": false, "code": 400, "message": "Date range too large (max 732 days)", "data": {} }
```
```json
// 403 - not entitled to this company
{ "success": false, "code": 400, "message": "You do not have access to this company", "data": {} }
```
(note: `ServiceError` with `status: 403` is still rendered through `badRequest`/`forbidden` — see Notes)
```json
// 403 - no insights:view permission
{ "success": false, "message": "You don't have 'insights:view' permission" }
```

**Validation Rules**
- `companyId`, `fromDate`, `toDate` are all required.
- Both dates must parse as valid dates; `toDate` must not be before `fromDate`.
- Max range is 732 days (~2 years).
- Caller must have access to the given `companyId` (checked via `hasCompanyAccess`).

**Notes**
- For role `manager`, the response is automatically scoped to the manager's own team (themself + everyone in their creator-hierarchy) within that company — a manager can never see another manager's team or company-wide data, even if `companyId` is valid.
- Quotations/Invoices arrays are only populated for the manager's own team's records, not the whole company (admin/user/super_admin see the full company).
- If the resolved team has zero employees, all list fields return as empty arrays with 200 (not an error).
- This is a read-only "Download Reports" feature, distinct from the legacy `report` module below — do not confuse `insights:view` with `report:view`.

---

### 2. List Sales/Proforma Reports (legacy Tally reports)

**Purpose:** Lists the caller's own previously-generated Tally sales/proforma report records, with search, reference-number filter, and date-range filter.

- **Method:** `GET`
- **Endpoint:** `/admin/get-report`
- **Authentication:** Bearer Token — requires `report:view` permission (Manager has this by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Default `1`. |
| limit | number | No | Default `10`, capped at `50`. |
| search | string | No | Matches against `referenceNo` or `customerName` (LIKE `%search%`). |
| referenceNo | string | No | Filters by reference number (LIKE `%value%`). |
| startDate | string | No | Filters `createdAt >=` this date. |
| endDate | string | No | Filters `createdAt <=` this date. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Reports fetched successfully",
  "data": {
    "totalItems": 3,
    "currentPage": 1,
    "totalPages": 1,
    "pageSize": 10,
    "data": [
      { "id": 5, "referenceNo": "RPT-1005", "customerName": "Acme Ltd", "rowIndex": 1 }
    ]
  }
}
```

**Sample Error Responses**

```json
// 400 - no auth context
{ "success": false, "code": 400, "message": "Unauthorized request", "data": {} }
```
```json
// 403 - no report:view permission
{ "success": false, "message": "You don't have 'report:view' permission" }
```

**Validation Rules**
- Results are always filtered to `userId: <caller's own id>` — a manager only ever sees reports they personally generated, never their team's.

**Notes**
- `POST /admin/add-report` and `POST /admin/update-report` (create/update a report record) require `report:export`, which is **not** in the Manager default permission bundle — Manager can view but not generate/edit these unless an admin explicitly grants `report:export`. Omitted from this doc for that reason.

---

### 3. Get Report Details (single record lookup)

**Purpose:** Fetches one specific report record belonging to the caller, matched by reference number, customer name, and/or date.

- **Method:** `GET`
- **Endpoint:** `/admin/get-report-details`
- **Authentication:** Bearer Token — requires `report:view` permission (Manager has this by default)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| referenceNo | string | At least one of the three required | Exact match. |
| customerName | string | At least one of the three required | Exact match. |
| date | string (`YYYY-MM-DD`) | At least one of the three required | Matched via `LIKE %date%` against the stored ISO timestamp. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Report fetched successfully",
  "data": { "id": 5, "referenceNo": "RPT-1005", "customerName": "Acme Ltd", "date": "2026-07-20T10:00:00.000Z" }
}
```

**Sample Error Responses**

```json
// 400 - no filter given
{ "success": false, "code": 400, "message": "At least one filter is required", "data": {} }
```
```json
// 400 - nothing matched
{ "success": false, "code": 400, "message": "Report not found", "data": {} }
```

**Validation Rules**
- At least one of `referenceNo`, `customerName`, `date` must be supplied.
- Scoped to `userId: <caller's own id>` — same isolation as Get Report list above.

**Notes**
- Returns the single most-recent match (`ORDER BY createdAt DESC` + `findOne`), not a list.

---

## Notifications

All notification routes are mounted under `/api` and only require a valid token (`tokenCheck` — `user`, `manager`, `sale_person`) — **there is no `notification:*` permission check in the code today**, even though Manager's permission template lists `notification:view` / `notification:mark_read`. In practice, any authenticated `/api` caller (including delete/clear-all) can hit every route below; the permission template entries are aspirational/unused for this module currently.

### 4. List My Notifications

**Purpose:** Paginated list of the caller's own notifications, optionally filtered to unread only.

- **Method:** `GET`
- **Endpoint:** `/api/notifications`
- **Authentication:** Bearer Token (no extra permission check)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Default `1`. |
| limit | number | No | Default `20`, capped at `50`. |
| unreadOnly | `"true"` \| omitted | No | When `"true"`, only unread notifications are returned. |

**Sample Success Response**

```json
{
  "success": true,
  "total": 12,
  "totalPages": 1,
  "currentPage": 1,
  "unreadCount": 3,
  "data": [
    { "id": 101, "receiverId": 45, "title": "New task assigned", "isRead": false, "createdAt": "2026-07-29T10:00:00.000Z" }
  ]
}
```

**Sample Error Responses**

```json
// 500
{ "success": false, "message": "Internal server error" }
```

**Notes**
- Results are always scoped to `receiverId: <caller's own id>` — a manager only ever sees their own notifications, not their team's.

---

### 5. Unread Notification Count

**Purpose:** Lightweight count for a notification badge.

- **Method:** `GET`
- **Endpoint:** `/api/notifications/unread-count`
- **Authentication:** Bearer Token (no extra permission check)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Sample Success Response**

```json
{ "success": true, "unreadCount": 3 }
```

**Sample Error Responses**

```json
// 500
{ "success": false, "message": "Internal server error" }
```

---

### 6. Mark All Notifications Read

- **Method:** `PATCH`
- **Endpoint:** `/api/notifications/read-all`
- **Authentication:** Bearer Token (no extra permission check)

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Request Payload:** none

**Sample Success Response**

```json
{ "success": true, "message": "All notifications marked as read" }
```

**Sample Error Responses**

```json
// 500
{ "success": false, "message": "Internal server error" }
```

---

### 7. Mark One Notification Read

- **Method:** `PATCH`
- **Endpoint:** `/api/notifications/:id/read`
- **Authentication:** Bearer Token (no extra permission check)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Notification ID. |

**Sample Success Response**

```json
{ "success": true, "message": "Marked as read", "data": { "id": 101, "isRead": true, "receiverId": 45 } }
```

**Sample Error Responses**

```json
// 404 - not found or belongs to someone else
{ "success": false, "message": "Notification not found" }
```
```json
// 500
{ "success": false, "message": "Internal server error" }
```

---

### 8. Delete One Notification

- **Method:** `DELETE`
- **Endpoint:** `/api/notifications/:id`
- **Authentication:** Bearer Token (no extra permission check)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Notification ID. |

**Sample Success Response**

```json
{ "success": true, "message": "Notification deleted" }
```

**Sample Error Responses**

```json
// 404
{ "success": false, "message": "Notification not found" }
```

---

### 9. Clear All Notifications

- **Method:** `DELETE`
- **Endpoint:** `/api/notifications/clear-all`
- **Authentication:** Bearer Token (no extra permission check)

**Sample Success Response**

```json
{ "success": true, "message": "All notifications cleared" }
```

**Notes**
- Irreversible — deletes every notification row for the caller. The Android client should confirm with the user before calling this.

---

## My Preferences

Self-service only — every role reads/writes its own single preferences row. Role-restricted (not permission-based).

### 10. Get My Preferences

- **Method:** `GET`
- **Endpoint:** `/admin/my-preferences`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Preferences fetched successfully",
  "data": { "notifyChat": true, "notifyTask": true, "notifyMeeting": true }
}
```

**Sample Error Responses**

```json
// 400 - user row not found
{ "success": false, "code": 400, "message": "User not found", "data": {} }
```
```json
// 403 - role not in admin/super_admin/manager/user
{ "success": false, "message": "Forbidden — requires one of: admin, super_admin, manager, user" }
```

---

### 11. Update My Preferences

- **Method:** `PATCH`
- **Endpoint:** `/admin/my-preferences`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "notifyChat": true,
  "notifyTask": false,
  "notifyMeeting": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| notifyChat | boolean | At least one of the three required | Toggle chat push notifications. |
| notifyTask | boolean | At least one of the three required | Toggle task push notifications. |
| notifyMeeting | boolean | At least one of the three required | Toggle meeting push notifications. |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Preferences updated successfully",
  "data": { "notifyChat": true, "notifyTask": false, "notifyMeeting": true }
}
```

**Sample Error Responses**

```json
// 400 - nothing to update
{ "success": false, "code": 400, "message": "At least one of notifyChat, notifyTask, notifyMeeting is required", "data": {} }
```

**Validation Rules**
- Body must include at least one of `notifyChat` / `notifyTask` / `notifyMeeting`; unspecified fields are left unchanged.
- Values are coerced to boolean (`!!value`).

---

## Permission Management (Manager → Sales Person)

Base path `/admin/permissions`. All routes require a valid JWT; role-level gating uses `authorizeRoles(admin, super_admin, manager, user)` at the router, with an additional **hierarchy check inside the controller**: a Manager may only view/grant/revoke permissions for users whose role is `sale_person` (enforced by `ASSIGNABLE_ROLES`/`ROLE_ASSIGNABLE_ROLES` — targeting any other role returns 403). A Manager can also only grant a permission they themselves already hold (anti-privilege-escalation check).

### 12. List All Available Permissions

**Purpose:** Reference list of every permission in the system (module + action + description), grouped by module — used to render a permission-picker UI.

- **Method:** `GET`
- **Endpoint:** `/admin/permissions/all`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Sample Success Response**

```json
{
  "success": true,
  "data": {
    "permissions": [ { "id": 1, "module": "attendance", "action": "view", "description": "View attendance" } ],
    "grouped": {
      "attendance": [ { "id": 1, "action": "view", "description": "View attendance" } ]
    }
  }
}
```

**Sample Error Responses**

```json
// 403 - role not allowed
{ "success": false, "message": "Forbidden — requires one of: admin, super_admin, manager, user" }
```
```json
// 500
{ "success": false, "message": "Server error" }
```

---

### 13. Get Default Permission Template for a Role

**Purpose:** Returns the default permission-id set for a given role, intersected with the caller's own permissions (so a Manager only ever gets back ids they're actually allowed to grant). Used to pre-fill a bulk-grant UI, e.g. before onboarding a new sale_person.

- **Method:** `GET`
- **Endpoint:** `/admin/permissions/template/:role`
- **Authentication:** Bearer Token (any authenticated role — no `authorizeRoles` gate on this specific route)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| role | string | One of `user`, `admin`, `manager`, `sale_person`. |

**Sample Success Response**

```json
{
  "success": true,
  "data": { "role": "sale_person", "permissionIds": [1, 4, 7, 12] }
}
```

**Sample Error Responses**

```json
// 400 - unknown role
{ "success": false, "message": "No default permission template for role 'xyz'" }
```

---

### 14. List Users by Role (preview before bulk-assign)

**Purpose:** Lists active users of a given role in the caller's company, with their current permission counts — used to preview who will be affected before a bulk grant/revoke.

- **Method:** `GET`
- **Endpoint:** `/admin/permissions/users-by-role`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| role | string | Yes | One of `admin`, `manager`, `sale_person`, `user`. A Manager may only request `sale_person` (see Validation). |
| companyId | number | No | Defaults to the caller's JWT-resolved `companyId`. |

**Sample Success Response**

```json
{
  "success": true,
  "data": {
    "role": "sale_person",
    "companyId": 12,
    "count": 2,
    "maxPermissionCount": 5,
    "users": [
      { "id": 45, "firstName": "Ravi", "lastName": "Kumar", "email": "ravi@example.com", "role": "sale_person", "permissionCount": 5, "permissions": [ { "id": 3, "module": "attendance", "action": "create" } ] }
    ]
  }
}
```

**Sample Error Responses**

```json
// 400 - invalid/missing role
{ "success": false, "message": "Query param 'role' is required and must be one of: admin, manager, sale_person, user" }
```
```json
// 403 - manager requesting a non-subordinate role
{ "success": false, "message": "manager cannot fetch users with role 'admin'" }
```
```json
// 400 - no company context
{ "success": false, "message": "companyId is required" }
```

**Validation Rules**
- Manager can only pass `role=sale_person` — any other value returns 403.

---

### 15. Get My Own Permissions

- **Method:** `GET`
- **Endpoint:** `/admin/permissions/my`
- **Authentication:** Bearer Token (any authenticated role)

**Sample Success Response**

```json
{
  "success": true,
  "data": {
    "role": "manager",
    "companyId": 12,
    "permissions": ["attendance:view", "attendance:create", "leave:approve", "task:create"],
    "matrix": { "attendance": { "view": true, "create": true }, "leave": { "approve": true } },
    "allPermissions": { "attendance": ["view", "create", "update", "delete"], "leave": ["view", "apply", "approve", "reject", "delete", "manage"] }
  }
}
```
(also available as an alias at `GET /api/my-permissions`, same handler, mounted under the `/api` router)

---

### 16. Get a Specific User's Permissions

- **Method:** `GET`
- **Endpoint:** `/admin/permissions/user/:userId`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| userId | number | Target user's id (in practice, must be one of the Manager's own sale_persons — no company/hierarchy filter is applied server-side beyond the role checks on write endpoints, so treat this as viewable for any userId but only meaningfully used for the Manager's own team). |

**Sample Success Response**

```json
{
  "success": true,
  "data": {
    "userId": 45,
    "permissions": ["attendance:view", "attendance:create"],
    "matrix": { "attendance": { "view": true, "create": true } },
    "raw": [ { "id": 88, "userId": 45, "permissionId": 3 } ]
  }
}
```

---

### 17. Assign Permissions to a User

**Purpose:** Grants one or more specific permissions to a target user (e.g. a Manager granting `expense:create` to one of their sale_persons).

- **Method:** `POST`
- **Endpoint:** `/admin/permissions/assign`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |
| Content-Type | `application/json` |

**Request Payload**

```json
{
  "targetUserId": 45,
  "permissionIds": [3, 7, 12]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| targetUserId | number | Yes | Must be an active user; for a Manager caller, must be a `sale_person`. |
| permissionIds | number[] | Yes, non-empty | Ids from `GET /admin/permissions/all`. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Permissions assigned: 2 new, 1 already existed",
  "data": { "assigned": 2, "alreadyExisted": 1 }
}
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "message": "targetUserId and permissionIds[] are required" }
```
```json
// 404 - target not found/inactive
{ "success": false, "message": "Target user not found or inactive" }
```
```json
// 403 - different tenant
{ "success": false, "message": "Cannot assign permissions to users outside your tenant" }
```
```json
// 403 - manager targeting a non-sale_person
{ "success": false, "message": "manager cannot assign permissions to admin" }
```
```json
// 400 - invalid permission id(s)
{ "success": false, "message": "One or more invalid permissionIds" }
```
```json
// 403 - anti-escalation (manager doesn't hold the permission being granted)
{ "success": false, "message": "You do not have 'quotation:create' permission — you cannot assign it to others" }
```

**Validation Rules**
- `targetUserId` and non-empty `permissionIds[]` required.
- Target must be active and in the caller's tenant.
- Caller can only assign to a role they're allowed to manage (Manager → `sale_person` only).
- Caller can only grant a permission they themselves currently hold.

---

### 18. Revoke Permissions from a User

- **Method:** `DELETE`
- **Endpoint:** `/admin/permissions/revoke`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Request Payload**

```json
{
  "targetUserId": 45,
  "permissionIds": [3, 7]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| targetUserId | number | Yes | Must be an active user; for a Manager caller, must be a `sale_person`. |
| permissionIds | number[] | Yes (array, may be empty per code but should be non-empty in practice) | Permission ids to remove. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "2 permission(s) revoked from user; 0 cascaded to 0 subordinate(s)",
  "data": { "revoked": 2, "cascadeRevoked": 0, "subordinatesAffected": 0 }
}
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "message": "targetUserId and permissionIds[] are required" }
```
```json
// 404 - target not found
{ "success": false, "message": "Target user not found" }
```
```json
// 403 - manager targeting a non-sale_person
{ "success": false, "message": "manager cannot revoke permissions from admin" }
```

**Notes**
- Revocation cascades down to the target's own subordinates, if any (not typically applicable for a `sale_person` target, who has none).

---

### 19. Bulk-Assign Permissions to All Users of a Role

**Purpose:** Grants a set of permissions to every active user of a role in one call (e.g. "give every sale_person on my team `meeting:schedule`").

- **Method:** `POST`
- **Endpoint:** `/admin/permissions/assign-role`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Request Payload**

```json
{
  "targetRole": "sale_person",
  "companyId": 12,
  "permissionIds": [3, 7]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| targetRole | string | Yes | For a Manager caller, must be `sale_person`. |
| companyId | number | No | Defaults to caller's JWT `companyId`. |
| permissionIds | number[] | Yes | Ids to grant to every matching user. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Bulk assigned 6 new permissions to 3 sale_person(s)",
  "data": { "usersAffected": 3, "permissionsAssigned": 6 }
}
```

**Sample Error Responses**

```json
// 403 - manager targeting a non-sale_person role
{ "success": false, "message": "manager cannot assign permissions to role 'admin'" }
```
```json
// 403 - anti-escalation
{ "success": false, "message": "You do not have 'quotation:create' permission — cannot assign it" }
```
```json
// 400 - no company resolvable
{ "success": false, "message": "companyId is required" }
```

---

### 20. Bulk-Revoke Permissions from All Users of a Role

- **Method:** `DELETE`
- **Endpoint:** `/admin/permissions/revoke-role`
- **Authentication:** Bearer Token — role-restricted to `admin`, `super_admin`, `manager`, `user`

**Request Payload**

```json
{
  "targetRole": "sale_person",
  "companyId": 12,
  "permissionIds": [3, 7]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| targetRole | string | Yes | For a Manager caller, must be `sale_person`. |
| companyId | number | No | Defaults to caller's JWT `companyId`. |
| permissionIds | number[] | Yes, non-empty | Ids to revoke from every matching user. |

**Sample Success Response**

```json
{
  "success": true,
  "message": "Revoked 6 permission record(s) from 3 sale_person(s)",
  "data": { "revoked": 6, "usersAffected": 3 }
}
```

**Sample Error Responses**

```json
// 400 - missing fields
{ "success": false, "message": "targetRole and permissionIds[] are required" }
```
```json
// 403 - manager targeting a non-sale_person role
{ "success": false, "message": "manager cannot revoke permissions from role 'admin'" }
```
```json
// 400 - invalid permission id(s)
{ "success": false, "message": "One or more invalid permissionIds" }
```

**Validation Rules**
- `targetRole` and non-empty `permissionIds[]` required; a Manager caller may only target `sale_person`.
- All `permissionIds` must exist.

**Notes**
- Bulk-revokes from every active `sale_person` in the resolved company at once — there is no per-user selection in this call (use `DELETE /admin/permissions/revoke` for a single user).

---

## Reference / Lookup Data (Branch, Shift, Department, Holiday)

All four modules below expose only **read** endpoints to Manager (add/update are Admin-only and will return `403 Forbidden` for a manager token). They're simple list + get-by-id lookups, typically used to populate dropdowns (e.g. branch/shift pickers when assigning a team member, or a holiday calendar view). All are mounted under `/admin` and require the shared `checkPermission`-free `authorizeRoles` gate: **admin, super_admin, manager, user**.

### 1. Get Branch List

**Purpose:** List branches (paginated, optionally filtered) — used to populate branch dropdowns.

- **Method:** `GET`
- **Endpoint:** `/admin/getbranch`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user), no separate permission grant needed

**Headers**

| Header | Value |
|---|---|
| Authorization | `Bearer <accessToken>` |

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | Page number, default `1` |
| limit | number | No | Page size, default `10` |
| search | string | No | Free-text search |
| companyId | number | No | Restrict to a company; if provided, caller must have access to it (else `403`) |

**Sample Success Response**

```json
{
  "success": true,
  "code": 200,
  "message": "Branch fetched successfully",
  "data": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "data": [ { "id": 1, "branchName": "...", "branchCode": "...", "branchCity": "..." } ]
  }
}
```

**Sample Error Responses**

```json
// 403 - authorizeRoles gate
{ "success": false, "message": "Forbidden — requires one of: admin, super_admin, manager, user" }
```
```json
// 400 - no access to requested companyId
{ "success": false, "code": 400, "message": "You do not have access to this company", "data": {} }
```

**Validation Rules**
- `companyId`, if supplied, must resolve to a company the caller has access to.

**Notes**
- Used to populate a branch-selection dropdown in the app.

---

### 2. Get Branch By Id

**Purpose:** Fetch a single branch's details.

- **Method:** `GET`
- **Endpoint:** `/admin/getbranch/:id`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Branch id |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Branch fetched successfully", "data": { "id": 1, "branchName": "..." } }
```

**Sample Error Responses**

```json
// 400 - not found
{ "success": false, "code": 400, "message": "Branch not found", "data": {} }
```

**Validation Rules**
- `id` must be numeric.

---

### 3. Get Shift List

**Purpose:** List shifts (paginated) — used to populate shift dropdowns (e.g. `assign-employee-shift`).

- **Method:** `GET`
- **Endpoint:** `/admin/getshift`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | default `1` |
| limit | number | No | default `10` |
| search | string | No | Free-text search |
| branchId | number | No | Filter by branch |
| companyId | number | No | Restrict to a company |

**Sample Success Response**

```json
{
  "success": true, "code": 200, "message": "Shifts fetched successfully",
  "data": { "total": 1, "page": 1, "limit": 10, "totalPages": 1, "data": [ { "id": 1, "shiftName": "..." } ] }
}
```

**Sample Error Responses**

```json
// 400 - invalid id downstream / bad params
{ "success": false, "code": 400, "message": "<error message>", "data": {} }
```

---

### 4. Get Shift By Id

- **Method:** `GET`
- **Endpoint:** `/admin/getshift/:id`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Shift id |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Shift fetched successfully", "data": { "id": 1, "shiftName": "..." } }
```

**Validation Rules**
- `id` must be numeric.

---

### 5. Get Department List

- **Method:** `GET`
- **Endpoint:** `/admin/getdepartment`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | default `1` |
| limit | number | No | default `10` |
| search | string | No | Free-text search |
| branchId | number | No | Filter by branch |
| companyId | number | No | Restrict to a company |

**Sample Success Response**

```json
{
  "success": true, "code": 200, "message": "Departments fetched successfully",
  "data": { "total": 1, "page": 1, "limit": 10, "totalPages": 1, "data": [ { "id": 1, "departmentName": "..." } ] }
}
```

---

### 6. Get Department By Id

- **Method:** `GET`
- **Endpoint:** `/admin/getdepartment/:id`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Department id |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Department fetched successfully", "data": { "id": 1, "departmentName": "..." } }
```

---

### 7. Get Holiday List

**Purpose:** List company holidays (calendar view).

- **Method:** `GET`
- **Endpoint:** `/admin/getholiday`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| page | number | No | default `1` |
| limit | number | No | default `10` |
| search | string | No | Free-text search |
| branchId | number | No | Filter by branch |
| companyId | number | No | Restrict to a company |

**Sample Success Response**

```json
{
  "success": true, "code": 200, "message": "Holidays fetched successfully",
  "data": { "total": 1, "page": 1, "limit": 10, "totalPages": 1, "data": [ { "id": 1, "holidayName": "...", "date": "2026-01-26" } ] }
}
```

---

### 8. Get Holiday By Id

- **Method:** `GET`
- **Endpoint:** `/admin/getholiday/:id`
- **Authentication:** Bearer Token — role-restricted (admin/super_admin/manager/user)

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| id | number | Holiday id |

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Holiday fetched successfully", "data": { "id": 1, "holidayName": "...", "date": "2026-01-26" } }
```

**Notes (applies to all 8 lookups above)**
- All use the shared success envelope `{ success, code, message, data }` (from `createSuccess`), and on error return **HTTP 400** (not 404/422) with `{ success: false, code: 400, message: "<reason>", data: {} }` — the service layer throws a `ServiceError` for "not found" cases, which the controller maps to 400, not 404.
- Add/Update endpoints for all four modules (`addbranch`, `updatebranch`, `addshift`, `updateshift`, `adddepartment`, `updatedepartment`, `addholiday`, `updateholiday`) are **Admin-only** — a manager token will get `403 Forbidden — requires one of: admin, super_admin`. Do not build "add/edit" UI for these against a manager account.

---

## Company Context

### 9. Get Company Policy

**Purpose:** Read-only "Company Policy" tab (Settings module) — scoped to the manager's own active company, policy fields only (not the full company record).

- **Method:** `GET`
- **Endpoint:** `/admin/company-policy`
- **Authentication:** Bearer Token — role-restricted (admin, super_admin, manager)

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Company policy fetched successfully", "data": { "id": 1, "...policyFields": "..." } }
```

**Sample Error Responses**

```json
// 400 - no company context in token
{ "success": false, "code": 400, "message": "No company context — cannot resolve your company's policy", "data": {} }
```
```json
// 400 - access denied (mapped from a 403 ServiceError, but returned as 400 by handleServiceError)
{ "success": false, "code": 400, "message": "You do not have access to this company", "data": {} }
```

**Validation Rules**
- Requires `companyId` to already be resolvable from the JWT (see `resolveCompanyId` — for manager this comes from the `CompanyManager` assignment table). If a manager has not been assigned to any company yet, this call fails.

**Notes**
- companyId is taken entirely from the token — never send it in the request.

---

### 10. Get My Companies

**Purpose:** List all companies the manager is assigned to (for multi-company managers) — used to build a "switch company" picker.

- **Method:** `GET`
- **Endpoint:** `/admin/my-companies`
- **Authentication:** Bearer Token — any authenticated `/admin` role

**Sample Success Response**

```json
{
  "success": true, "code": 200, "message": "Companies fetched successfully",
  "data": [ { "id": 1, "companyName": "Acme Pvt Ltd", "...": "..." } ]
}
```

**Notes**
- For role `admin` this reads the `CompanyAdmin` junction table; for every other role (including `manager`) it reads the `CompanyManager` junction table — i.e. for a manager this returns every company they've been assigned to via `assign-company-manager` (an Admin-only action, not documented here since managers can't call it).

---

### 11. Switch Company

**Purpose:** Switch the manager's active company context (for managers assigned to more than one company) and receive a new JWT scoped to that company.

- **Method:** `POST`
- **Endpoint:** `/admin/switch-company`
- **Authentication:** Bearer Token — any authenticated `/admin` role (role is further checked in the service: only `admin`/`manager` may actually switch)

**Request Payload**

```json
{ "companyId": 5 }
```

| Field | Type | Required | Description |
|---|---|---|---|
| companyId | number | Yes | The company to switch into — the manager must already be assigned to it |

**Sample Success Response**

```json
{
  "success": true, "code": 200, "message": "Company switched successfully",
  "data": { "accessToken": "<new-jwt>", "companyId": 5, "companyName": "Acme Pvt Ltd" }
}
```

**Sample Error Responses**

```json
// 400 - missing companyId
{ "success": false, "code": 400, "message": "companyId is required", "data": {} }
```
```json
// 400 - role not allowed
{ "success": false, "code": 400, "message": "Only admin or manager accounts can switch companies", "data": {} }
```
```json
// 400 - not assigned to that company
{ "success": false, "code": 400, "message": "You are not assigned to this company", "data": {} }
```

**Validation Rules**
- `companyId` required, numeric.
- Caller's role must be `admin` or `manager`.
- Caller must have an existing assignment to that company (via `CompanyManager` junction table for managers).

**Notes**
- **Important for the Android app:** the response returns a brand-new `accessToken` scoped to the new `companyId` — the app must discard the old token and store this new one; every subsequent `/admin/*` call will now resolve `companyId` from this new token, not the old company.

---

### 12. Get Own Company

**Purpose:** Fetch the full company record(s) the caller owns/is linked to (used on dashboards/profile screens that need full company detail, unlike the policy-only endpoint above).

- **Method:** `GET`
- **Endpoint:** `/admin/getowncompany`
- **Authentication:** Bearer Token — any authenticated `/admin` role

**Sample Success Response**

```json
{ "success": true, "code": 200, "message": "Company fetched successfully", "data": [ { "id": 1, "companyName": "Acme Pvt Ltd", "...": "..." } ] }
```

**Sample Error Responses**

```json
// 400 - no company found
{ "success": false, "code": 400, "message": "No company found for this user", "data": {} }
```

**Notes**
- Returns an array even though it's typically one company per caller.
