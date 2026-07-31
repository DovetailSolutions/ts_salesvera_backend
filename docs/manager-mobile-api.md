# Manager Role — Mobile API Reference

For the mobile team to add **manager** role support to the existing app (currently `sale_person` only). Every endpoint/event below is verified directly against the backend source (not inferred) as of 2026-07-31.

The good news: the backend already fully supports a manager acting from a mobile client — auth is role-checked per-route via JWT, not per-client-type, so nothing new needs to be built for most of this. The gaps that DO need attention are called out explicitly in **[§0.4 Known gaps](#04-known-gaps--fix-before-launch)** — read that section first.

---

## Table of Contents

- [§0. Fundamentals](#0-fundamentals)
- [§1. Authentication & Profile](#1-authentication--profile)
- [§2. Attendance](#2-attendance)
- [§3. Leave](#3-leave)
- [§4. Tasks (Socket.IO)](#4-tasks-socketio)
- [§5. Meetings](#5-meetings)
- [§6. Clients (meeting contacts)](#6-clients-meeting-contacts)
- [§7. Expenses](#7-expenses)
- [§8. Reports / Insights](#8-reports--insights)
- [§9. Notifications](#9-notifications)
- [§10. Chat (Socket.IO)](#10-chat-socketio)
- [§11. Team & Company Info](#11-team--company-info)
- [§12. Permissions](#12-permissions)
- [§13. Record Sales](#13-record-sales)
- [§14. Mobile Dashboard & Sales Performance](#14-mobile-dashboard--sales-performance)
- [§15. Quotations, Invoices & Categories (Tally-linked, permission-gated)](#15-quotations-invoices--categories-tally-linked-permission-gated)
- [§16. Tasks (REST fallback) & Tally Bulk Sync](#16-tasks-rest-fallback--tally-bulk-sync)

---

## §0. Fundamentals

### 0.1 Two REST surfaces — both accept a manager JWT

| Surface | Mount | `tokenCheck` allowlist | Notes |
|---|---|---|---|
| `/api/*` | `src/app/router/user.ts` (+ `attendanceSelf.routes.ts`) | `user, manager, sale_person` (`jwtVerify2.ts`) | Self-service surface. **admin is excluded.** |
| `/admin/*` | `src/app/router/admin.ts` + every `src/modules/*/*.routes.ts` | `user, admin, super_admin, manager` (`jwtVerify.ts`) | Team-oversight surface (built for web, but role-gated not client-gated). **sale_person is excluded.** |

A manager JWT works on **both**. A mobile app for manager will call a mix of `/api/*` (their own attendance, own leave, own tasks-as-assignee, chat) and `/admin/*` (approve team leave, view team attendance, schedule meetings for reports, approve expenses).

### 0.2 Response envelope

Standard shape (`createSuccess`/`badRequest`/`forbidden`, `src/app/middlewear/errorMessage.ts`):
```json
{ "success": true, "code": 200, "message": "...", "data": { } }
```
A number of older endpoints hand-roll `res.json(...)` instead and **omit the `code` key**, or use different top-level keys (`pagination` alongside `data`, etc.) — called out per-endpoint below where it deviates.

### 0.3 Auth

**JWT payload**: `{ userId, role, companyId? }`, signed, `accessToken` expires **30d**, `refreshToken` **60d** (same secret, only `expiresIn` differs — no separate refresh-verification path). Send as `Authorization: Bearer <accessToken>`.

**Socket.IO** (used for Tasks and Chat, same `io` instance, same auth middleware): connect with
```js
io(SOCKET_URL, { auth: { token: accessToken } })
```
On success `socket.data.user = { userId, role, companyId }` (raw JWT payload — not re-resolved server-side the way REST requests are).

### 0.4 Known gaps — fix before launch

These are real, verified issues found while researching this doc. Flagging them now saves the mobile team from a "why does this 403" debugging session later.

1. **A manager cannot submit their own expense out of the box.** `expense:create` is **not** in the manager's default permission template (only `expense:view/approve/reject` are). `POST /api/expense` will 403 until someone explicitly grants `expense:create` to that manager account (`POST /admin/permissions/assign`). Decide: grant it to all managers, or hide "submit expense" in the app for managers who lack it (`GET /api/my-permissions` → `matrix.expense.create`).
2. **`leave:manage` is also not in the default template** — blocks `POST /admin/assign-leave-balance`, `POST /admin/add-leave`, `PATCH /admin/update-leave/:id`. Only grant if managers should configure leave policy/balances themselves (usually an admin-only action).
3. **`task:delete` is not in the default template**, and even if granted, a manager can only delete tasks **they personally created** (`assignedBy === self`), not any company task — unlike view/update which are company-wide. Don't build a generic "manager can delete any task" UI affordance.
4. **`GET /admin/get-expense` (list team expenses) is not actually paginated** — it computes `limit`/`totalPages` for the response envelope but never applies `limit`/`offset` to the underlying query, so it always returns the full result set. Fine for now, but don't rely on the `page`/`limit` params to bound payload size.
5. **`GET /admin/user-expense` returns expense rows under a `"leave"` key** in the response (`data.leave`, not `data.expenses`) — a copy-paste artifact from a leave endpoint. Documented as-is below; don't "fix" it client-side by guessing a different key.
6. **Login is two different endpoints with different response shapes** — see §1.1/§1.2. Recommend standardizing on `POST /api/login` (matches the existing sale_person mobile flow, handles device/FCM registration inline) + a follow-up `GET /api/my-permissions` call, rather than `/admin/login`.
7. **`GET /api/refreshtoken` returns key `token`, not `accessToken`** (inconsistent with `/login`), and the new token doesn't re-embed `companyId` (harmless — it's re-resolved server-side per request — but matters if the app ever decodes the JWT client-side).
8. **Logout endpoints are not interchangeable.** `POST /api/logout` requires `deviceId` and deletes that `Device` row (pairs with `/api/login`'s device registration). `POST /admin/logout` takes an optional `lastLoginCompanyId` and does **not** touch devices. Use `/api/logout` consistently if you standardize on `/api/login`.
9. **`GET /api/mysaleperson` (team list) is non-recursive** — only direct reports. Every data-scoping endpoint elsewhere (attendance, leave, expense, reports) scopes to the **full recursive hierarchy** (`getAllChildUserIds`). If a manager manages another manager who manages sale persons, the team-list UI will under-represent who the manager can actually see data for. Fine for a contact picker; don't use it to compute "team size" for a dashboard stat — use `GET /admin/dashboard-summary`'s `teamMemberCount` instead (recursive).
10. **`POST /admin/create-client` / `POST /api/create-client` return no data** (`data: {}`) — after creating a client, re-fetch `GET /admin/getusermeeting?empty=true` (ordered newest-first) to get the new client's id.
11. **`GET /admin/reports/generate` has no built-in aggregation** and returns full, unrestricted columns per row across 6 tables in one synchronous call — usable as-is for a mobile insights screen (see §8), but the client must compute any summary cards itself, and a wide date range + large team could be a slow/heavy single request. Consider requesting a lighter "summary-only" variant from backend if this becomes a problem in practice.
12. **`POST /admin/assign-salesman` has no ownership scoping at all** (`tokenCheck` only — no `authorizeRoles`/`checkPermission`, and `managerId` is taken directly from the request body with no check that it's the caller's own account or a descendant). A manager can currently call this to reassign **any** sale_person to **any** manager company-wide, and since it uses Sequelize's `setCreatedUsers` (a full replace, not an append), a wrong call **wipes out** the target manager's entire existing team in one shot. Do not expose this raw in a mobile UI without adding server-side scoping first — flag to backend before building a "reassign team member" feature around it.
13. **`PATCH /admin/updaterecordsale/:id` and `DELETE /admin/deleterecordsale/:id` have no ownership check** — any authenticated `/api` role (including a different manager or a sale_person) can update or delete **any** record-sale row by id, not just their own (`GetRecordSale`/list IS correctly scoped to `userId`, only the by-id update/delete are not). See §13.
14. **`GET /api/mysaleperson` (gap #9) has a better recursive alternative**: `GET /admin/getalluser` walks the full `getAllChildUserIds` hierarchy (not just direct reports) and additionally supports `role`/`shiftId`/`branchId` filters and search — prefer it for any real team-roster screen. See §11.

---

## §1. Authentication & Profile

### 1.1 `POST /api/login` — recommended for mobile
No auth required. **Only `sale_person` and `manager` may use this endpoint** (400 otherwise — `"Only sale person and manager are allowed to login"`).

Request:
```json
{
  "email": "manager@acme.com",
  "password": "secret123",
  "tenantId": 12,
  "deviceToken": "fcm-token-here",
  "deviceType": "android",
  "deviceId": "device-uuid-abc",
  "devicemodel": "Pixel 7",
  "devicename": "Jane's Phone"
}
```
`deviceToken`/`deviceType`/`deviceId`/`devicemodel`/`devicename` register/update a `Device` row for FCM push (upserted by matching `deviceToken` OR `deviceId`) — this is the **only** place device registration happens; there's no standalone "register device" endpoint.

Response `data`:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": 42, "firstName": "Jane", "lastName": "Doe", "email": "manager@acme.com",
    "phone": "...", "role": "manager", "status": "active", "profile": null,
    "createdBy": 7, "tenantId": 5, "lastLoginCompanyId": 3,
    "branchId": null, "shiftId": null, "departmentId": null, "employeeCode": "EMP00042",
    "tallyGuid": null, "tallyName": null, "tallyStartDate": null,
    "notifyChat": true, "notifyTask": true, "notifyMeeting": true,
    "createdAt": "...", "updatedAt": "...",
    "city": "Zirakpur", "state": "Punjab", "country": "India"
  }
}
```
`password` stripped. No `permissions` array and no top-level `companyId` here — follow up with `GET /api/my-permissions` (§12) and rely on server-side `companyId` resolution for everything else. `city/state/country` are hardcoded literals, not real per-user fields — ignore them.

### 1.2 `POST /admin/login` — alternative (web-oriented), not recommended for mobile unless you need `permissions[]` inline
No auth required. Allows `admin, manager, super_admin, user` (**not sale_person**).

Request: `{ "email": "...", "password": "...", "tenantId": 12, "deviceType": "web" }` — **no device/FCM fields supported here**.

Response `data`:
```json
{
  "accessToken": "...", "refreshToken": "...", "companyId": 3,
  "user": { "id": 42, "firstName": "Jane", "lastName": "Doe", "email": "...", "role": "manager", "tallyGuid": null, "tallyName": null, "tallyStartDate": null },
  "permissions": ["attendance:view", "attendance:create", "leave:view", "leave:approve", "..."]
}
```

### 1.3 Forgot password / OTP / reset — identical on both surfaces, no auth required
- `POST /api/forgot-password` (or `/admin/forgot-password`) — `{ "email": "...", "tenantId": 12 }` → emails a 6-digit OTP, 10-min expiry. Response `message: "OTP sent to your email"`.
- `POST /api/verify-otp` (or `/admin/verify-otp`) — `{ "email": "...", "otp": "123456", "tenantId": 12 }` → `message: "OTP verified successfully"`.
- `POST /api/reset-password` (or `/admin/reset-password`) — `{ "email": "...", "newPassword": "NewPass123", "tenantId": 12 }`.

### 1.4 Profile

**`GET /api/getprofile`** — `tokenCheck` only.
```json
{
  "id": 42, "firstName": "Jane", "role": "manager",
  "branch": { "id": 3, "branchName": "HQ" },
  "parent": { "id": 7, "firstName": "Admin", "lastName": "User", "email": "admin@acme.com", "role": "admin" },
  "company": { "id": 3, "companyName": "Acme Ltd", "companyBanks": [] }
}
```
`company` here is resolved by walking the creator chain up to the root admin — **not** from the JWT's `companyId`. `parent` = immediate creator.

**`GET /admin/getProfile`** — richer, includes permissions inline:
```json
{
  "user": { "id": 42, "firstName": "Jane", "role": "manager", "branch": {...}, "company": { "id": 3, "companyName": "Acme Ltd", "branches": [], "shifts": [], "departments": [], "companyLeaves": [], "companyBanks": [] } },
  "permissions": ["attendance:view", "leave:approve", "..."],
  "matrix": { "attendance": { "view": true, "create": true, "update": true }, "leave": { "view": true, "approve": true } }
}
```
`company` here is resolved from the JWT's `companyId` (via `CompanyManager`), not the creator-chain walk — the two profile endpoints resolve company differently, pick one and stick with it.

**Update profile:**
- `PATCH /api/updateprofile` (multipart, file field `profile`) — body: `firstName`, `lastName` only. Response has no updated user (`data: {}`).
- `PATCH /admin/updateProfile` (multipart, file field `profile`) — body: `firstName, lastName, phone, dob, tallyGuid, tallyName, tallyStartDate`. Response `data.user` = full updated row. **More complete — prefer this one.**

**`PATCH /api/updatepassword`** (or `/admin/updatepassword`) — `{ "oldPassword": "...", "newPassword": "..." }`.

**`GET /api/refreshtoken`** — no body. Response: `{ "data": { "token": "...", "refreshToken": "..." } }` (key is `token`, not `accessToken` — see gap #7).

**`POST /api/logout`** — `{ "deviceId": "device-uuid-abc" }` (required) → deletes that `Device` row.
**`POST /admin/logout`** — `{ "lastLoginCompanyId": 3 }` (optional) → persists last-active-company, does not touch devices. Not interchangeable — see gap #8.

---

## §2. Attendance

Self-service under `/api/attendance/*`; team-oversight under `/admin/*`. Both gated by `checkPermission("attendance", action)`.

### 2.1 `POST /api/attendance/punch-in`
```json
{ "punch_in": "2026-07-30T09:05:00.000Z", "latitude_in": 30.7046, "longitude_in": 76.7179 }
```
Lat/long only required if the company/branch has geofencing enabled (`company.geoFencingRequired && company.officeLocationRequired` + branch has lat/lng/radius). Blocked more than 30 min before the assigned shift start if a shift is assigned.

Response `data` = the `Attendance` row: `{ "id":501, "employee_id":42, "date":"2026-07-30", "punch_in":"...", "punch_out":null, "status":"present", "late":false, "companyLeaveId":null, "latitude_in":"30.7046", "longitude_in":"76.7179" }`.

### 2.2 `POST /api/attendance/punch-out`
```json
{ "punch_out": "2026-07-30T18:10:00.000Z", "latitude_out": 30.7046, "longitude_out": 76.7179, "AttendanceId": 501 }
```
`AttendanceId` optional (defaults to today's open session). Response adds `working_hours` (float), `overtime` (0 unless company allows it), `dayType` (`full_day`/`half_day`/`short_leave`), `status:"out"`.

### 2.3 `GET /api/attendance/today` — no params, today's own row. 400 `"No attendance found for today"` if none (not 404).

### 2.4 `GET /api/attendancelist` — own history. Query `page`, `limit`. Response: `{ success, message, data:[...], pagination:{...} }` (no `code` key).

### 2.5 `GET /admin/get-attendance` — whole team, today only
Query: `page`, `limit`. Scoped to `getAllChildUserIds(loggedInId)` (recursive, excludes self).
```json
{ "success": true, "data": [
    { "id":88, "employeeCode":"EMP00088", "firstName":"Sam", "lastName":"Sale", "email":"...", "phone":"...", "role":"sale_person", "shiftId":4,
      "Attendances": [ { "id":900, "date":"2026-07-30", "status":"present", "punch_in":"...", "dayType":"full_day", "leaveType": null } ] } ],
  "pagination": { "totalRecords":6, "totalPages":1, "currentPage":1, "limit":10 } }
```

### 2.6 `GET /admin/user-attendance?userId=88` — one team member's history
Query: `userId` (required), `startDate`, `endDate`, `lastDays`, `today=true`, `page`, `limit`. 403 unless `userId` is self or a recursive descendant.
```json
{ "data": { "attendance": [ /* Attendance rows w/ nested leaveType */ ], "pagination": {...} } }
```

### 2.7 `GET /admin/attendance-book?month=7&year=2026` — monthly calendar grid, whole team
Query: `month`, `year`, `search`, `page`, `limit`. 400 `"No child users found"` if zero descendants.
```json
{ "data": { "page":1,"limit":10,"totalCount":5,"totalPages":1,
    "users": [ { "id":88, "employeeCode":"EMP00088", "name":"Sam Sale", "email":"...", "role":"sale_person",
                 "days": { "1":"present", "2":"-" }, "dayTypes": { "1":"full_day" },
                 "leaveTypes": { "5": { "id":2, "name":"Sick Leave" } } } ] } }
```

### 2.8 `PATCH /admin/mark-attendance-present` — manual single-day mark
```json
{ "employeeId": 88, "date": "2026-07-30", "status": "present", "punchIn": "2026-07-30T09:00:00Z", "companyLeaveId": null }
```
`status` ∈ `present|half_day|absent|leave`; `companyLeaveId` required when `status:"leave"`. 400 unless `employeeId` is a recursive descendant.

### 2.9 `POST /admin/bulk-mark-attendance` — xlsx/csv upload
Multipart field `file`; body also accepts `fromDate`, `toDate`, `shiftId`. Rows for employees outside the manager's team are silently skipped (`skippedNotInTeam`), not errored.
```json
{ "data": { "applied":40, "created":10, "updated":30, "skippedNonNumericEmployeeId":[], "skippedNotInTeam":[3], "skippedUnknownStatus":[], "skippedWrongShift":[], "skippedTooEarly":[] } }
```

---

## §3. Leave

### Self-service

**`POST /api/leave`** — request leave.
```json
{ "from_date": "2026-08-03", "to_date": "2026-08-03", "reason": "Fever", "companyLeaveId": 2 }
```
Either `leave_type` (legacy enum: `sick|casual|paid|unpaid|short_leave|half_day`) or `companyLeaveId` (preferred — dynamic, per-company type) is required. Balance is deducted immediately on request, not on approval. Response `data` = created `Leave` row.

**`GET /api/leave-list`** — own leaves only, no status filter. Query `page`, `limit`.
```json
{ "data": { "totalRecords":5, "totalPages":1, "currentPage":1,
    "data": [ { "id":700, "from_date":"...", "to_date":"...", "status":"pending", "leave_type":"sick", "companyLeaveId":2,
                "leaveTypeRef": { "id":2, "leaveName":"Sick Leave", "leaveCode":"SL" } } ] } }
```

**`GET /api/my-leave-balance?year=2026`**
```json
{
  "year": 2026,
  "casual": { "allocated": 12, "used": 2, "remaining": 10 },
  "sick": { "allocated": 6, "used": 1, "remaining": 5 },
  "paid": { "allocated": 15, "used": 0, "remaining": 15 },
  "leaveTypes": [ { "companyLeaveId": 2, "leaveName": "Sick Leave", "leaveCode": "SL", "leavesPerYear": 6, "carryForwardAllowed": false, "carryForwardLimit": 0, "allocated": 6, "carriedForward": 0, "used": 1, "remaining": 5 } ]
}
```
Use `leaveTypes[]` as source of truth (dynamic, has `companyLeaveId` to post back on `/api/leave`); the `casual/sick/paid` top-level keys are legacy best-effort name-matches for old clients.

### Team-oversight (manager)

**`PATCH /admin/approved-leave`** — approve/reject.
```json
{ "employee_id": 88, "leaveID": 700, "status": "approved" }
```
`status`: `"approved"` or `"rejected"`. 400 unless `employee_id` is self or a recursive descendant. Approve flips linked `Attendance` rows `leave`→`leaveApproved`; reject restores the deducted balance and flips to `leaveReject`.

**`GET /admin/get-leave-list`** — team leave requests, grouped by employee (not a flat list)
Query: `status` (optional `pending|approved|rejected`), `page`, `limit`.
```json
{ "data": [ { "id":88, "employeeCode":"EMP00088", "firstName":"Sam", "Leaves": [ { "id":700, "status":"pending" } ] } ], "pagination": {...} }
```

**`GET /admin/leave-request-today`** — no params.
```json
{ "data": { "appliedToday": [...], "appliedTodayCount": 2, "onLeaveToday": [...], "onLeaveTodayCount": 3 } }
```

**`GET /admin/user-leave?userId=88`** — one team member's leave history. `{ "data": { "leave": [...], "pagination": {...} } }`.

**`GET /admin/getown-leave`** — manager's own leave history via the admin surface. Same response shape as above.

**`POST /admin/request-leave`** — manager files leave **on behalf of** a team member.
```json
{ "employeeId": 88, "from_date": "2026-08-05", "to_date": "2026-08-05", "reason": "Phoned in sick", "companyLeaveId": 2 }
```
`employeeId` optional (defaults to self). **`companyLeaveId` is required here** (unlike `/api/leave`, which also accepts a bare `leave_type`).

**`POST /admin/cancel-leave-and-mark-present`** — undo an approved leave and mark present instead.
```json
{ "employeeId": 88, "leaveID": 700, "date": "2026-08-05", "punchIn": "2026-08-05T09:10:00Z" }
```
Response: `{ "data": { "leave": {...}, "attendance": {...} } }`.

**`GET /admin/leave-balance-list?year=2026`** — whole team's balances. Query `page`, `limit`, `year`.
```json
{ "data": { "totalRecords":5, "totalPages":1, "currentPage":1,
    "data": [ { "id":88, "firstName":"Sam", "leaveBalances": [ { "companyLeaveId":2, "leaveName":"Sick Leave", "allocated":6, "carriedForward":0, "used":1, "remaining":5 } ] } ] } }
```

**`GET /admin/leave-balance/:employeeId?year=2026`** — single team member. `{ "data": { "employeeId":88, "year":2026, "balances": [...] } }`.

**`POST /admin/assign-leave-balance`** — ⚠️ requires `leave:manage`, **not in manager's default template** (gap #2).
```json
{ "employeeId": 88, "year": 2026, "balances": [ { "companyLeaveId": 2, "allocated": 6 } ] }
```
`employeeId` may be an array for bulk-assign. `allocated` capped at that type's `leavesPerYear`.

### Company leave types (for the leave-type picker)

**`GET /admin/get-leave?companyId=3&page=1&limit=50`** — list configured leave types.
```json
{ "data": { "total":4, "currentPage":1, "totalPages":1,
    "data": [ { "id":2, "leaveName":"Sick Leave", "leaveCode":"SL", "leavesPerYear":6, "carryForward":false, "carryForwardLimit":0, "managerApproval":true, "companyId":3, "branchId":1 } ] } }
```
Pass `companyId` explicitly (from the resolved company, see §11) — omitting it falls back to only leave types the caller personally owns.

---

## §4. Tasks (Socket.IO)

Registered via `initTaskSocket(io)` on the **same socket connection** as chat (§10) — one connection, shared auth.

### 4.1 Room joins (automatic on connect)
```js
socket.join(`task:user:${uid}`);                    // always
if (["admin","super_admin","manager"].includes(role))
  socket.join(`task:company:${companyId}`);          // manager IS included
```

### 4.2 Permissions
Manager's default template: `task:create, task:view, task:update` (**no `task:delete`** — gap #3).

### 4.3 Visibility — manager sees the whole company
```js
// buildTaskVisibilityWhere — used by getTaskById/updateTask/getTaskHistory/getTaskComments/addTaskComment
if (role !== "super_admin") where.companyId = companyId;
if (role === "sale_person") where.assignedTo = uid;
// manager: no extra restriction beyond companyId → sees every task in the company
```
`deleteTask` is the one exception — it has its own scope: `if (role === "manager") where.assignedBy = uid` (only tasks the manager personally created, even if granted `task:delete`).

### 4.4 Events

**`createTask`** (emit)
```json
{ "title": "Follow up with client", "assignedTo": 88, "description": "?", "priority": "low|medium|high|urgent", "dueDate": "ISO date", "tags": ["urgent"] }
```
`assignedTo` must be an active user with role `manager` or `sale_person`, same tenant. → broadcasts **`taskCreated`** to `task:company:{companyId}` + `task:user:{assignedTo}`, payload = full `Task` row.

**`getAllTasks`** (emit, all optional)
```json
{ "status": "todo|in_progress|in_review|completed|cancelled", "priority": "...", "assignedTo": 88, "assignedBy": 42, "page": 1, "limit": 20, "tags": ["urgent"], "dateScope": "today|history" }
```
`limit` capped at 50. `assignedTo`/`assignedBy` filters work for manager (ignored for sale_person). `dateScope` only applies when `status:"completed"`.
→ **`taskList`**:
```json
{ "success": true, "total": 42, "totalPages": 3, "currentPage": 1,
  "data": [ { "id":1, "title":"...", "status":"todo", "priority":"medium", "dueDate":"...", "assignedTo":88, "assignedBy":42, "companyId":3, "tags":[], "completedAt":null, "createdAt":"...", "updatedAt":"...",
              "assignee": { "id":88, "firstName":"...", "lastName":"...", "email":"...", "role":"sale_person" },
              "creator":  { "id":42, "firstName":"...", "lastName":"...", "email":"...", "role":"manager" } } ] }
```

**`getTaskById`** — emit `{ "id": 1 }` → **`taskDetail`**: `{ "success": true, "data": <Task row, same shape as above> }`.

**`updateTask`** (emit) — for manager (not the restricted sale_person branch), every field is editable:
```json
{ "id": 1, "title": "?", "description": "?", "status": "?", "priority": "?", "dueDate": "?", "assignedTo": "?", "tags": "?" }
```
→ **`taskUpdated`** (full row) broadcast same rooms as create; reassignment also notifies the old assignee directly and fires a "Task Reassigned" push; completion sets `completedAt` and notifies `assignedBy` + the completer's direct manager/admin.

**`deleteTask`** — emit `{ "id": 1 }` (needs `task:delete`, own-created-only scope) → **`taskDeleted`**: `{ "id": 1 }`.

**`getTaskHistory`** — two modes:
- `{ "id": 1 }` → **`taskHistory`**: `{ "success": true, "taskId": 1, "data": [ { "id":.., "field":"status", "oldValue":"todo", "newValue":"in_progress", "createdAt":.., "changedByUser": {...} } ] }` (per-task audit trail).
- `{ "page": 1, "limit": 20 }` (no `id`) → company-wide activity feed: `{ "success": true, "total":.., "totalPages":.., "currentPage":.., "data": [ { ...same fields.., "task": { "id":.., "title":.. } } ] }`.

**`getTaskComments`** — emit `{ "taskId": 1 }` → **`taskComments`**: `{ "success": true, "taskId": 1, "data": [ { "id":.., "userId":.., "body":.., "createdAt":.., "author": {...} } ] }`.

**`addTaskComment`** — emit `{ "taskId": 1, "body": "non-empty string" }` (only needs `task:view`, not `task:update`) → broadcasts **`taskCommentAdded`** (comment + `author`) to the same rooms, and notifies `assignedTo`/`assignedBy` (excluding the commenter).

### 4.5 Errors & live-only events
All handlers emit `{ "message": "..." }` on **`taskError`** for failures (e.g. `"Forbidden — you do not have task:create permission"`, `"Task not found"`).
Listen for these without needing to emit anything (they arrive from other users' actions): **`taskCreated`**, **`taskUpdated`**, **`taskDeleted`**, **`taskCommentAdded`**.

---

## §5. Meetings

Two layers: a newer module (`/admin/meetings/*`) for manager-initiated scheduling, and legacy self-service endpoints (`/api/*`) for the on-the-ground check-in/out flow (already used by the sale_person app — a manager needs these too for their own visits).

### 5.1 `POST /admin/meetings/schedule` — schedule a meeting for a team member (needs `meeting:schedule`, in default template)
```json
{ "targetUserId": 88, "meetingUserId": 20, "meetingPurpose": "demo", "categoryId": 3, "subCategoryId": 7, "scheduledTime": "2026-08-01T10:00:00.000Z" }
```
- `targetUserId`/`meetingUserId`/`scheduledTime` required.
- `targetUserId` must be the manager's own or a descendant ("team scope": `[self, ...recursive reports]`).
- `meetingUserId` (the client) must be in "client scope": for a manager, this resolves **up** to their parent admin, then down — the whole admin's org's shared client pool, not just the manager's own team's clients.
- If the client has a prior meeting, `meetingPurpose`/`categoryId`/`subCategoryId` are copied from the latest one when omitted; otherwise `meetingPurpose` is required (first-time client).
- 400 if the target already has a meeting at that exact `scheduledTime`.

Response `data` = created `Meeting` row (`status: "scheduled"`).

### 5.2 `PATCH /admin/meetings/:id/reschedule` (needs `meeting:update`, in default template)
```json
{ "scheduledTime": "2026-08-02T10:00:00.000Z" }
```
Only allowed while the meeting's `status` is `"scheduled"` or `"pending"`. 403 unless the meeting's assignee is self or a team-scope descendant.

### 5.3 `GET /admin/meetings/dashboard` (needs `meeting:view`, in default template) — no params, scoped to team-scope only (own reports, not the whole org)
```json
{
  "scheduledToday": 3, "scheduledThisWeek": 12, "scheduledThisMonth": 40, "upcoming": 5,
  "completionRate": 62.5,
  "statusBreakdown": { "scheduled": 0, "pending": 2, "in": 1, "out": 0, "completed": 25, "cancelled": 1 },
  "trend": [ { "date": "2026-07-17", "count": 2 } ],
  "topPerformer": { "userId": 88, "name": "Sam Sale", "completed": 10 },
  "newClientsThisMonth": 4
}
```
`completionRate`/`topPerformer` are `null` if there's nothing to compute.

### 5.4 Self-service — on-the-ground check-in/out (`/api/*`, same ones sale_person uses; manager needs them for their own visits)

**`POST /api/createmeeting`** (multipart, file field `image[]`) — starts a meeting on the spot.
```json
{ "companyName": "required", "personName": "required", "mobileNumber": "required", "meetingPurpose": "required", "categoryId": "required", "status": "required (pending|in|scheduled|...)",
  "userName": "?", "userMobile": "?", "userEmail": "?", "customerType": "?", "companyEmail": "?", "subCategoryId": "?",
  "latitude_in": "?", "longitude_in": "?", "meetingTimeIn": "?", "scheduledTime": "?",
  "state": "?", "city": "?", "country": "?", "address": "?", "gstNumber": "?", "remarks": "?", "pincode": "?" }
```
400 if caller already has a meeting with `status:"in"`. Finds-or-creates both the client (`MeetingUser`) and the visit site (`MeetingCompany`). Response `data` = created `Meeting` row.

**`POST /api/endmeeting`**
```json
{ "meetingId": 1, "latitude_out": "12.34", "longitude_out": "56.78", "remarks": "?" }
```
Requires an existing `Meeting` with `status:"in"` owned by the caller. Response: `{ "data": { "meetingId": 1, "legDistance": "1.2 km", "totalDistance": "3.4 km" } }`.

**`POST /api/scheduledupdate`** — check in on a meeting that was pre-scheduled via §5.1.
```json
{ "meetingId": 1, "latitude_in": "12.34", "longitude_in": "56.78" }
```
Requires the meeting to be in `status:"scheduled"`, owned by the caller. Sets `status:"in"`.

**`GET /api/getmeetinglist`** — caller's own meetings only (not team-scoped, even for manager).
Query: `page`, `limit`, `search`, `status`, `startDate`, `endDate`.
```json
{ "data": { "currentPage":1, "pageSize":10, "totalItems":30, "totalPages":3,
    "data": [ { "id":.., "status":.., "scheduledTime":.., "MeetingUser": {...}, "MeetingCompany": {...}, "MeetingImages": [...] } ] } }
```

**`GET /api/clientmeeting`** — a manager's team's client address book (their subordinates' visited clients).
Query: `page`, `limit`, `search`.
```json
{ "success": true, "data": [ { "id":.., "name":.., "mobile":.., "MeetingCompanies": [ { "companyName":.., "Meetings": [ {...} ] } ] } ], "pagination": {...} }
```

---

## §6. Clients (meeting contacts)

**`POST /admin/create-client`** (or `POST /api/create-client`, identical logic) — needs `tokenCheck` only.
```json
{ "name": "required", "state": "required", "country": "required", "companyName": "required",
  "email": "?", "mobile": "?", "panNumber": "?", "status": "draft (default)", "customerType": "new (default)",
  "city": "?", "pincode": "?", "address": "?", "gstNumber": "?" }
```
400 if a `MeetingUser` already exists with the same email or mobile. **Response returns no client data** (`data: {}` — gap #10) — re-fetch the list below to get the new id.

**`GET /admin/getusermeeting`** — client list (also doubles as the "pick a client to schedule a meeting for" picker).
Query: `page`, `limit`, `search`, `userId`, `date`, `empty`.
⚠️ **Manager-specific scoping quirk**: for `role:"manager"`, this resolves up to the manager's **parent admin**, then scopes to that admin's whole org — same "client scope" as §5.1, wider than the manager's own team.
```json
{ "data": { "page":1, "limit":10, "total":20, "totalPages":2,
    "rows": [ { "id":20, "name":"...", "email":"...", "mobile":"...", "companyName":"...", "customerType":"...", "status":"draft",
                "Meetings": [ { "id":.., "status":.., "scheduledTime":.., "meetingTimeIn":.., "meetingTimeOut":.. } ] } ] } }
```
`row.Meetings.length === 0` identifies a brand-new client with no prior visit — relevant for §5.1's "first-time client needs an explicit purpose" rule.

---

## §7. Expenses

### 7.1 Self-service submit — `POST /api/expense` — ⚠️ needs `expense:create`, **not in manager's default template** (gap #1)
Multipart, bulk array:
```
expenses: [ { "title": "Client lunch", "total_amount": "1200", "amount": "1200", "date": "2026-07-28", "category": "Food", "description": "?", "location": "Delhi" } ]
expenses[0][billImage]: <file>   // optional, multiple files per index allowed
```
Response `data` = array of created rows (no nested `images` — re-fetch to see attachments):
```json
[ { "id": 1, "userId": 42, "title": "...", "total_amount": "1200", "approvedByAdmin": "pending", "approvedBySuperAdmin": "pending", "createdAt": "..." } ]
```

### 7.2 Self-service list — `GET /api/getexpense`
Query `page`, `limit`.
```json
{ "data": { "totalRecords":12, "totalPages":2, "currentPage":1,
    "data": [ { "id":1, "title":"...", "approvedByAdmin":"pending", "images": [ { "id":1, "imageUrl":"https://..." } ] } ] } }
```

### 7.3 Team-oversight list — `GET /admin/get-expense`
Query: `search`, `approvedByAdmin`, `approvedBySuperAdmin`. ⚠️ Not truly paginated (gap #4). Scoped to recursive descendants only (excludes manager's own expenses).
```json
{ "data": [ { "id":1, "userId":88, "title":"...", "approvedByAdmin":"pending",
              "images": [ {...} ], "user": { "id":88, "firstName":"...", "role":"sale_person" } } ],
  "pagination": { "totalRecords":12, "totalPages":2, "currentPage":1, "limit":10 } }
```

### 7.4 Approve/reject — `PATCH /admin/approved-expense`
```json
{ "userId": 88, "expenseId": 1, "approvedByAdmin": "accepted", "approvedBySuperAdmin": "accepted" }
```
403 unless `userId` is self or a recursive descendant. **For a manager caller**, only `approvedByAdmin` is applied (`accepted|rejected|not_clear|pending`) — `approvedBySuperAdmin` in the body is ignored for a manager. Response: `{ "data": { "expense": {...updated row} } }`.

### 7.5 One team member's history — `GET /admin/user-expense?userId=88`
Query: `userId` (required), `page`, `limit`, `startDate`, `endDate`, `lastDays`, `today`.
⚠️ Response key is `leave`, not `expenses` (gap #5):
```json
{ "data": { "leave": [ /* Expense rows */ ], "pagination": {...} } }
```

---

## §8. Reports / Insights

### `GET /admin/reports/generate` (needs `insights:view`, in default template)
Query: `companyId` (required), `fromDate` (required), `toDate` (required) — max span 2 years, `toDate >= fromDate`.

**Manager scoping**: `employeeIds` = manager's own id + all recursive descendants, filtered to the requested company's roster (safe even if the manager is assigned to more than one company). Quotations/Invoices are additionally filtered to `userId IN employeeIds` for a manager (own-team-created only) — admin/user get the whole company's.

Response `data`:
```json
{
  "companyId": 3, "dateRange": { "fromDate": "2026-07-01", "toDate": "2026-07-31" },
  "employees": [ { "id":88, "employeeCode":"...", "firstName":"...", "role":"sale_person" } ],
  "attendance": [ { "id":.., "employee_id":88, "date":.., "status":"present", "dayType":"full_day", "working_hours":8.5, "leaveType": {...} } ],
  "leaves":     [ { "id":.., "employee_id":88, "from_date":.., "to_date":.., "status":"approved", "leaveTypeRef": {...} } ],
  "meetings":   [ { "id":.., "userId":88, "status":"completed", "scheduledTime":.., "meetingTimeIn":.., "meetingTimeOut":.. } ],
  "tasks":      [ { "id":.., "title":.., "status":"in_progress", "assignedTo":88, "tags":[] } ],
  "expenses":   [ { "id":.., "userId":88, "title":.., "approvedByAdmin":"pending", "amount":"1200" } ],
  "quotations": [ { "id":.., "userId":88, "status":.., "quotationNumber":.., "customerName":.. } ],
  "invoices":   [ { "id":.., "userId":88, "status":.., "invoiceNumber":.., "customerName":.. } ]
}
```
This is a raw multi-table JSON dump (every model column, no curated DTO, no built-in totals) — usable directly for a mobile "insights" screen (see gap #11 for the caveats), but the client computes any summary cards/charts itself.

### `GET /admin/my-companies` — which companies this manager belongs to
```json
[ { "id": 3, "companyName": "Acme Pvt Ltd", "legalName": "...", "companyEmail": "...", "companyPhone": "...", "city": "..." } ]
```

---

## §9. Notifications

### List — `GET /api/notifications`
Query: `page`, `limit` (default 20, capped 50), `unreadOnly=true`.
```json
{ "success": true, "total": 42, "totalPages": 3, "currentPage": 1, "unreadCount": 5,
  "data": [ { "id":1, "senderId":3, "type":"chat", "title":"New message from John Doe", "body":"...", "data": { "roomId":"3-9" }, "isRead": false, "createdAt":"..." } ] }
```
`type` ∈ `chat|task|meeting|system|other`.

- `PATCH /api/notifications/:id/read` → `{ "message": "Marked as read", "data": {...updated row} }`
- `PATCH /api/notifications/read-all` → `{ "message": "All notifications marked as read" }`
- `GET /api/notifications/unread-count` → `{ "unreadCount": 5 }`
- `DELETE /api/notifications/:id` → `{ "message": "Notification deleted" }`
- `DELETE /api/notifications/clear-all` → `{ "message": "All notifications cleared" }`

### Preferences — `GET`/`PATCH /admin/my-preferences` (manager allowed)
```json
{ "data": { "notifyChat": true, "notifyTask": true, "notifyMeeting": true } }
```
PATCH body: any subset of the same three booleans. If a type is muted (explicitly `false`), matching notifications are dropped server-side entirely — not just hidden client-side.

### Real-time push
Event **`"notification"`**, delivered on the **same socket as chat** (no separate namespace — the client must have an authenticated chat/task socket open). Payload = same shape as one list item above.

### FCM token
No standalone registration endpoint — token is registered/updated **only at login** (§1.1's `deviceToken`/`deviceId`/etc fields). To rotate a token mid-session (app reinstall, token refresh), call `/api/login` again.

---

## §10. Chat (Socket.IO)

Same connection as Tasks (§4). `manager` is in `rolesWithChatAccess` — chat access requires no permission grant.

Key events (all on the same socket used for tasks):

| Event (emit) | Payload | Response (ack/broadcast) |
|---|---|---|
| `joinRoom` | `{ roomId?, type: "private"\|"group", members?: number[] }` | `roomJoined { roomId, type }` |
| `sendMessage` | `{ roomId, message, replyTo? }` | broadcasts `receiveMessage { id, chatRoomId, senderId, message, replyTo, createdAt, replyToMessage }` |
| `sendFileMessage` | `{ roomId, fileData (base64), fileName, mimeType, caption?, replyTo? }` | broadcasts `receiveFileMessage` |
| `forwardMessage` | `{ messageId, toRoomId }` | broadcasts `receiveFileMessage { forwarded: true }` |
| `mychats` | `{ roomId, page, limit, search }` | ack `mychats { success, total, totalPages, currentPage, data: Message[] }` |
| `UserList` | `{ page, limit, search }` | ack `UserList { data: [{id, firstName, lastName, role, onlineSatus, unreadCount}] }` |
| `createGroup` | `{ members: number[], name }` | ack `createGroup { roomId, type:"group", groupName, members }` |
| `addGroupMembers` / `removeGroupMember` / `leaveGroup` / `updateGroupName` / `deleteGroup` | group management | room-broadcast acks |
| `getGroupDetails` | `{ roomId }` | `{ roomId, participants: [...] }` |
| `getMyGroups` | `{ page, limit, search }` | `{ data: [{...ChatRoom, unreadCount}] }` |
| `typing` | `{ roomId, ... }` | room-broadcast passthrough |
| — (server→client, unsolicited) | — | `userStatusChange { userId, onlineSatus: "online"\|"offline" }` |

**Manager-specific note**: `UserList` gives a manager their **whole up/down hierarchy** (their admin + all their sale_persons) via `getAllRelatedUserIds` — sale_person gets a narrower, purpose-built contact list instead. Every other event is identical for both roles.

---

## §11. Team & Company Info

### `GET /api/mysaleperson` — direct reports only (not recursive — see gap #9)
Query: `page`, `limit`, `search`.
```json
{ "data": { "page":1, "limit":10, "total":6, "rows": [ { "id":88, "firstName":"Sam", "lastName":"Sale", "email":"...", "phone":"...", "role":"sale_person" } ] } }
```

### `GET /admin/company-policy` — read-only policy bundle (manager allowed)
No params — resolves company from the JWT.
```json
{ "data": { "id":3, "companyName":"Acme Pvt Ltd",
    "lateMarkAfter":15, "autoHalfDayAfter":240, "geoFencingRequired":true, "officeLocationRequired":true,
    "overtimeAllowed":false, "companyWorkingDays":["mon","tue","wed","thu","fri"], "halfSaturday":true, "altSaturday":false,
    "casualHolidaysTotal":12, "casualHolidaysPerMonth":1, "casualHolidayNotice":2, "casualHolidayApprovalRequired":true,
    "casualHolidayCarryForward":true, "casualCarryForwardLimit":5, "casualCarryForwardExpiry":90,
    "compOffMinHours":4, "compOffExpiryDays":30, "compOffApprovalRequired":true } }
```

### `GET /admin/dashboard-summary` — team KPIs (role-gated, not permission-gated — always available to manager)
```json
{ "data": {
    "teamMemberCount": 6, "presentCount": 5, "pendingLeaveApprovalCount": 2, "pendingExpenseCount": 3,
    "meetingsThisWeekCount": 4, "completedQuotationCount": 8, "completedInvoiceCount": 5,
    "kpis": { "attendanceRateLast7Days": 92.5, "punctualityRateLast30Days": 88.0,
              "taskStats": { "total": 40, "completed": 25, "overdue": 3, "completionRate": 62.5 },
              "leaveUtilizationRate": 34.2, "headcountByBranch": { "HQ": 4, "North": 2 } } } }
```

### `GET /admin/top-performers?limit=5` — ranks the manager's team by on-time task completions + closed meetings
```json
{ "data": [ { "userId": 88, "name": "Sam Sale", "score": 12 } ] }
```

### `GET /admin/getalluser` — full recursive team roster (preferred over `/api/mysaleperson`, gap #14)
Query: `page`, `limit`, `search`, `role`, `shiftId`, `branchId`. Scoped to `getAllChildUserIds` (full recursive hierarchy, every descendant role — not just direct sale_persons).
```json
{ "data": { "page": 1, "limit": 10, "total": 8,
    "finalRows": [ { "id": 88, "employeeCode": "EMP00088", "firstName": "Sam", "lastName": "Sale", "email": "...", "phone": "...", "role": "sale_person", "shiftId": 4, "branchId": 1, "createdAt": "...",
                     "creator": { "id": 42, "firstName": "Jane", "lastName": "Doe", "email": "...", "phone": "...", "role": "manager" },
                     "company": { "id": 3, "companyName": "Acme Ltd" }, "managedCompanies": [] } ] } }
```

### `POST /admin/bulk-add-saleperson` — CSV bulk-create/link sale_persons under the manager's own team
Multipart, field `csv` (columns: `firstname,lastname,email,phone,dob`); optional body `branchId`, `shiftId` (defaults to the company's first branch/shift if omitted — validated to belong to the caller's own company). For a manager caller, `createdBy` is forced to themselves (no body override needed/allowed).
```json
{ "data": {
    "totalCSV": 12, "created": 8, "linkedExisting": 2, "skippedInvalid": 1,
    "skippedDuplicateInCsv": 0, "skippedDuplicate": 1, "skippedRoleMismatch": 0,
    "createdSalePersons": [ { "id": 101, "firstName": "New", "lastName": "Rep", "email": "new@acme.com", "phone": "...", "tempPassword": "Xy9!aB2c" } ],
    "linkedSalePersons": [ { "id": 55, "firstName": "Existing", "lastName": "Rep", "email": "...", "phone": "..." } ] } }
```
An `email` already registered as `sale_person` elsewhere but not yet linked to this manager gets **linked** (added as an additional creator) rather than duplicated; a temp password is emailed only to genuinely new accounts. `skippedRoleMismatch` = email already exists but belongs to a non-sale_person account (left untouched).

### `PATCH /admin/assign-employee-shift` — assign a shift to a team member (needs `ADMIN_AND_MANAGER` role)
```json
{ "employeeId": 88, "shiftId": 4 }
```

### ⚠️ `POST /admin/assign-salesman` — reassign a sale_person's manager — **see gap #12, not scoped, don't expose raw**
```json
{ "managerId": 42, "saleId": 88 }
```
`saleId` may be an array. No ownership/scope check exists server-side today — treat as backend-team-only until fixed, or add your own client-side guard limiting `managerId` to the logged-in manager's own id.

### `GET /admin/getowncompany` — full own-company detail (branches, shifts, departments, leave types, banks), resolved from JWT — no id needed
```json
{ "data": [ { "id": 3, "companyName": "Acme Pvt Ltd", "branches": [...], "shifts": [...], "departments": [...], "companyLeaves": [...], "companyBanks": [...] } ] }
```
Returns an array (a manager/admin can in principle be linked to more than one company).

### `POST /admin/switch-company` — re-mint the JWT scoped to a different assigned company (multi-company managers only)
```json
{ "companyId": 5 }
```
403 unless the manager is actually assigned to that company (`CompanyManager` junction). Response:
```json
{ "data": { "accessToken": "...", "companyId": 5, "companyName": "Second Co Pvt Ltd" } }
```
Only `accessToken` is reissued (not `refreshToken`) — replace the stored access token and keep using the same refresh token. Every subsequent `/admin/*` call is now scoped to the new company.

### Read-only org reference lists (pickers/filters for attendance, leave, shift assignment — manager can view, not create/edit)
| Endpoint | Notes |
|---|---|
| `GET /admin/getholiday` / `GET /admin/getholiday/:id` | Query `page,limit,search,branchId,companyId`. `{ "data": { "total":.., "page":.., "limit":.., "data": [ { "id":.., "holidayName":.., "date":.., "branchId":.. } ] } }` |
| `GET /admin/getbranch` / `GET /admin/getbranch/:id` | Query `page,limit,search,companyId`. `{ "data": { "total":.., "page":.., "limit":.., "totalPages":.., "data": [ { "id":.., "branchName":.., "branchCity":.., "latitude":.., "longitude":.., "geoRadius":.. } ] } }` — same underlying data as legacy `GET /api/getbranch` / `GET /admin/getBranchall` below, prefer this one (paginated, company-scoped). |
| `GET /admin/getshift` / `GET /admin/getshift/:id` | Query `page,limit,search,branchId,companyId`. Rows: `{ "id":.., "shiftName":.., "startTime":.., "endTime":.. }` |
| `GET /admin/getdepartment` / `GET /admin/getdepartment/:id` | Query `page,limit,search,branchId,companyId`. Rows: `{ "id":.., "departmentName":.. }` |

Creating/editing any of these four (`POST /admin/add*`, `PATCH /admin/update*`) is `ADMIN_ONLY` — a manager will always get 403, don't show edit affordances.

### Legacy/duplicate lookup endpoints (still live, kept for backward compat — prefer the `/admin` module versions above where an equivalent exists)
- `GET /api/getBranchall` / `GET /admin/getbranch` *(legacy, note: colliding name with the module route above but a different, older, non-paginated-response-shape handler — same underlying `Branch` table)* — query `companyId` or `branchId`; response `{ "data": { "branches": [...], "total":.., "page":.., "limit":.., "totalPages":.. } }`.
- `GET /api/getcompany` — tokenCheck only, no role restriction. Query `page,limit,search,companyName,city,state`. `{ "data": { "total":.., "currentPage":.., "totalPages":.., "data": [ {...Company row} ] } }`. Functionally a duplicate of the `ADMIN_ONLY` `/admin/getcompany` but reachable by a manager — likely an oversight, but currently usable.
- `GET /api/getcompanydetails/:id` — tokenCheck only. Returns one `Company` row with `branches`, `departments`, `holidays`, `shifts`, `companyLeaves` included. Prefer `/admin/getowncompany` (no id needed, auto-scoped) unless you specifically need another company's id.

---

## §12. Permissions

Beyond checking their own access, **a manager can actively grant/revoke permissions for their own sale_persons** — this is a real feature the web app exposes (a "manage team permissions" screen) and a mobile app can too. All routes below are mounted at `/admin/permissions/*` (`checkPermission`/`authorizeRoles` are NOT used here — access is fully hierarchy-based, enforced inside the controller: `manager → sale_person` only, `admin → manager/sale_person`, etc.). None of these hand-rolled responses include the `code` envelope key.

**Hierarchy + anti-escalation rules enforced on every mutating call:**
- A manager may only target `sale_person` accounts (`ASSIGNABLE_ROLES.manager = ["sale_person"]`) — attempting to target any other role 403s.
- A manager can only grant a permission **they themselves currently hold** — trying to grant e.g. `expense:create` to a sale_person while the manager lacks it themselves 403s with `"You do not have 'expense:create' permission — you cannot assign it to others"`.
- Tenant isolation is checked on every call — cannot touch a user outside the caller's own tenant.

### `GET /api/my-permissions` (same controller also mounted at `GET /admin/permissions/my`) — build the app's feature-gating from this
```json
{ "data": {
    "role": "manager", "companyId": 3,
    "permissions": ["attendance:view", "attendance:create", "attendance:update", "expense:view", "expense:approve", "expense:reject", "..."],
    "matrix": { "attendance": { "view": true, "create": true, "update": true }, "expense": { "view": true, "approve": true, "reject": true, "create": false } },
    "allPermissions": { "attendance": ["view","create","update","delete"], "expense": ["view","create","update","approve","reject"], "...": [] }
} }
```
Check `matrix.<module>.<action>` before showing an action in the UI — don't hardcode assumptions from the default template below, since permissions can be individually granted/revoked per account.

### `GET /admin/permissions/all` — full permission catalog (reference data, e.g. to render a grant/revoke picker)
```json
{ "success": true, "data": {
    "permissions": [ { "id": 1, "module": "attendance", "action": "view", "description": "..." } ],
    "grouped": { "attendance": [ { "id": 1, "action": "view", "description": "..." } ], "expense": [ ... ] } } }
```

### `GET /admin/permissions/template/:role` — default permission-id set for a role (e.g. `:role = sale_person`), pre-intersected with what the caller can actually grant
```json
{ "success": true, "data": { "role": "sale_person", "permissionIds": [3, 7, 12, 19] } }
```
Every id returned is guaranteed grantable by the caller (already filtered against the manager's own permission set) — feed straight into `POST /admin/permissions/assign` for a "reset to default" action.

### `GET /admin/permissions/users-by-role?role=sale_person` — preview who's affected before a bulk grant/revoke
Query: `role` (required, one of `admin|manager|sale_person|user`), `companyId` (optional, defaults to caller's JWT company).
```json
{ "success": true, "data": { "role": "sale_person", "companyId": 3, "count": 6, "maxPermissionCount": 9,
    "users": [ { "id": 88, "firstName": "Sam", "lastName": "Sale", "email": "...", "phone": "...", "role": "sale_person", "profile": null, "createdAt": "...",
                 "permissionCount": 7, "permissions": [ { "id": 3, "module": "attendance", "action": "view" } ] } ] } }
```

### `GET /admin/permissions/user/:userId` — one team member's effective permissions (e.g. tapping into a sale_person's detail screen)
```json
{ "success": true, "data": {
    "userId": 88, "permissions": ["attendance:view", "attendance:create", "task:view"],
    "matrix": { "attendance": { "view": true, "create": true }, "task": { "view": true } },
    "raw": [ { "id": 501, "userId": 88, "permissionId": 3, "grantedBy": 42, "permission": { "id": 3, "module": "attendance", "action": "view", "description": "..." } } ] } }
```

### `POST /admin/permissions/assign` — grant one or more permissions to one sale_person
```json
{ "targetUserId": 88, "permissionIds": [3, 7, 12] }
```
```json
{ "success": true, "message": "Permissions assigned: 2 new, 1 already existed", "data": { "assigned": 2, "alreadyExisted": 1 } }
```

### `DELETE /admin/permissions/revoke` — revoke one or more permissions from one sale_person
Body (DELETE with a body — same shape as assign):
```json
{ "targetUserId": 88, "permissionIds": [12] }
```
```json
{ "success": true, "message": "1 permission(s) revoked from user; 0 cascaded to 0 subordinate(s)", "data": { "revoked": 1, "cascadeRevoked": 0, "subordinatesAffected": 0 } }
```
Revocation cascades downward to the target's own subordinates automatically (not relevant for a sale_person target, since they have none — but relevant if this same endpoint is ever used by an admin revoking from a manager).

### `POST /admin/permissions/assign-role` — bulk-grant to **every** sale_person under the manager at once
```json
{ "targetRole": "sale_person", "permissionIds": [3, 7], "companyId": 3 }
```
`companyId` optional (defaults to the caller's JWT company). Response:
```json
{ "success": true, "message": "Bulk assigned 14 new permissions to 7 sale_person(s)", "data": { "usersAffected": 7, "permissionsAssigned": 14 } }
```

### `DELETE /admin/permissions/revoke-role` — bulk-revoke from every sale_person under the manager
```json
{ "targetRole": "sale_person", "permissionIds": [12], "companyId": 3 }
```
```json
{ "success": true, "message": "Revoked 7 permission record(s) from 7 sale_person(s)", "data": { "revoked": 7, "usersAffected": 7 } }
```

### Manager's default permission template (applied at account creation — `src/config/permissionTemplates.ts`)
```
attendance: view, create, update
expense:    view, approve, reject          (no "create" — gap #1)
leave:      view, apply, approve, reject   (no "manage" — gap #2)
meeting:    view, schedule, join, update
chat:       read, send
report:     view
insights:   view
task:       create, view, update           (no "delete" — gap #3)
notification: view, mark_read
profile:    view
```

---

## §13. Record Sales

A lightweight, standalone "log a sale" feature — **not** connected to the Tally quotation/invoice pipeline (§15), just a simple record with a customer name, product description, amount, and a paid/unpaid flag. All routes are `/api/*`, `tokenCheck` only (no permission gate).

### `POST /api/recordsale`
```json
{ "customerName": "required", "productDescription": "required", "saleAmount": "required (number)", "remarks": "?", "paymentReceived": "? (boolean)", "companyId": "? (defaults to 0)" }
```
Response `data` = created row: `{ "id": 1, "userId": 42, "companyId": 3, "customerName": "...", "productDescription": "...", "saleAmount": 1200, "remarks": null, "paymentReceived": false, "createdAt": "...", "updatedAt": "..." }`.

### `GET /api/getrecordsale` — own records only (`where: { userId: self }`), no pagination, no query params.
`data` = plain array of rows (same shape as above).

### `GET /api/getrecordsale/:id`
`data` = single row.

### `PATCH /api/updaterecordsale/:id` — ⚠️ see gap #13, no ownership check
```json
{ "customerName": "required", "productDescription": "required", "saleAmount": "required", "remarks": "?", "paymentReceived": "?" }
```
All four required fields must be resent (not a partial patch — omitting any one 400s). `userId` on the row is silently overwritten to the **caller's** id regardless of who originally owned it. `data` = Sequelize's raw update result (`[affectedCount]`), not the updated row — re-fetch by id to see the result.

### `DELETE /api/deleterecordsale/:id` — ⚠️ see gap #13, no ownership check
`data` = number of rows deleted (`0` or `1`).

---

## §14. Mobile Dashboard & Sales Performance

Two endpoints purpose-built for a mobile home screen — both `/api/*`, `tokenCheck` only, both genuinely missed by earlier passes over this codebase since neither is exposed in the current web app UI.

### `GET /api/dashboardmobile` — top-of-screen KPI tiles
No params. Scoped to the caller + full recursive subordinate tree (`getAllSubordinateIds` — for a manager, their whole sale_person team; for a sale_person, just themselves).
```json
{ "data": { "saleordercount": 12, "perfomaInvoice": 3, "invoice": 9, "Reports": 5 } }
```
- `saleordercount` = active (non-cancelled/deleted) `Quotations` count.
- `perfomaInvoice` = `Invoices` with `status IN (draft, imported)`.
- `invoice` = `Invoices` with `status = accepted`.
- `Reports` = active `Report` rows.
(Field name casing is inconsistent as returned — `perfomaInvoice`/`Reports` are not typos to "fix" client-side, that's the literal JSON key.)

### `GET /api/getsalesPerformance?range=week` — completed-meeting % chart, **self only** (not team-scoped, even for a manager — always the caller's own meetings)
Query: `range` ∈ `week|month|year` (default `week`). `week` buckets Mon–Sun of the current week; `month` buckets every day of the current month; `year` buckets Jan–Dec.
```json
{ "data": {
    "range": "week", "startDate": "2026-07-27T00:00:00.000Z", "endDate": "2026-08-02T23:59:59.999Z",
    "totalMeetings": 18, "completedMeetings": 14, "averageKpi": 77.8,
    "chart": [ { "label": "Mon", "totalMeetings": 3, "completedMeetings": 2, "percentage": 66.7 },
               { "label": "Tue", "totalMeetings": 4, "completedMeetings": 4, "percentage": 100 } ] } }
```
A meeting counts as "completed" if `status` is `out` or `completed`. If a manager-facing "team performance" version of this is needed, it doesn't exist yet — this endpoint is hardcoded to the caller's own `userId`; flag to backend if the mobile app needs a per-team-member or team-aggregate variant.

---

## §15. Quotations, Invoices & Categories (Tally-linked, permission-gated)

This is the frozen, Tally-integration-linked feature set (quotations → proforma/invoices, product categories) — **stable legacy code, not expected to change**, included here only because a manager *can* reach it if granted `quotation`/`invoice`/`report` permissions (none of which are in the manager default template — see §12). Kept intentionally concise; if the mobile app needs deep quotation/invoice workflows, treat this as a starting map and read the actual controllers (`src/app/controller/{user,admin}.ts`) before building against it — response shapes here carry many more Tally-specific fields than shown.

| Method & Path | Permission | Purpose |
|---|---|---|
| `GET /api/getcategory` / `GET /admin/getcategory` | none beyond tokenCheck | List product categories (+ nested subcategories) visible to the caller's hierarchy. |
| `GET /admin/getcategory-with-subcategories` | none | Same, admin-surface variant. |
| `GET /api/getsubcategory/:id` / `GET /admin/getsubcategory/:id` | none | Subcategories under one category. |
| `POST /api/addquotation` / `POST /admin/addquotation` | `quotation:create` | Create a quotation. |
| `POST /api/updatequotation/:id` / `POST /admin/updatequotation/:id` | `quotation:update` | Update a quotation (note: `POST`, not `PATCH`). |
| `GET /api/getquotationpdflist` / `GET /admin/getquotationpdflist` / `GET /admin/getquotationlist` | `quotation:view` | List quotations (PDF-oriented listing). |
| `POST /api/getquotationpdf` | `quotation:view` | Generate/fetch a quotation PDF (note: `POST` for a read). |
| `GET /api/downloadquotationpdf/:id` / `GET /admin/downloadquotationpdf/:id` | `quotation:view` | Download the PDF binary. |
| `POST /admin/addquotationpdf` | `quotation:create` | Attach/upload a quotation PDF. |
| `POST /api/addinvoice` / `POST /admin/addinvoice` | `invoice:create` (draft rows need `proformainvoice:create`) | Create an invoice/proforma. |
| `GET /api/getinvoice` / `GET /admin/getinvoice` | `invoice:view` **or** `proformainvoice:view` | List invoices. |
| `POST /admin/updateinvoice/:id` | `invoice:update` (draft rows need `proformainvoice:update`) | Update an invoice/proforma. |
| `GET /api/tally-report` | `report:view` | Tally-sourced sales report (distinct from `insights:view`'s §8 report). |
| `GET /admin/get-client` | none | List Tally-synced clients (distinct from the meeting-contact `MeetingUser` clients in §6). |
| `POST /admin/update-client/:id` | none | Update a Tally client record. |

None of these are granted to a manager by default — before building UI around this section, confirm with the team whether managers should have `quotation:*`/`invoice:*`/`report:view` at all, since it's a bigger scope decision than the gaps in §0.4.

---

## §16. Tasks (REST fallback) & Tally Bulk Sync

### Task REST endpoints — exist, but Socket.IO (§4) is the primary/recommended interface
`/admin/task/*`, `ADMIN_AND_MANAGER` role-gated (not permission-gated — bypasses `task:create`/`task:view` entirely, unlike the Socket.IO path). Same underlying data as §4, just a REST shape:

| Method & Path | Socket.IO equivalent |
|---|---|
| `POST /admin/task/create` | `createTask` |
| `GET /admin/task/list` | `getAllTasks` |
| `GET /admin/task/:id` | `getTaskById` |
| `PATCH /admin/task/update/:id` | `updateTask` |
| `DELETE /admin/task/delete/:id` | `deleteTask` |

Build against the Socket.IO events in §4 for a mobile app — they're what the web app actually uses in production and are the only path that gets live push updates (`taskCreated`/`taskUpdated`/etc.) without polling. This REST surface exists but has no comment history/comments/company-wide-activity-feed endpoints (those are Socket-only: `getTaskHistory`/`getTaskComments`/`addTaskComment`), so it's a strictly smaller feature set — only worth using if the mobile team specifically wants to avoid holding a persistent socket open.

### Tally Bulk Sync (`/admin/bulk/*`, `ADMIN_AND_MANAGER`)
`POST /admin/bulk/invoices`, `/quotations`, `/clients`, `/stock-items` — these are Tally-connector sync jobs (bulk-push date-scoped vouchers / full ledger masters from a Tally desktop connector), not a manager-initiated mobile action. Full payload docs already exist at [`bulkSync-api.md`](./bulkSync-api.md) in this same folder — not duplicated here since it's out of scope for a manager mobile app.

