# SalesVera – Phase 1 Feature Audit (2026-11-17)

Scope: compare the Lite / Pro / Advance feature matrix against the current
code in `ts_salesvera_backend` and `Salesvera_react_frontend-` (branch `vishu_dev`).
Statuses: Already Implemented · Partially Implemented · Missing · Broken · Blocked by External Dependency.
"Test Status" is **Not run** for everything — no automated test framework exists in either repo yet.

## 0. Cross-cutting findings

| Area | Finding |
|---|---|
| Subscription unit | Subscriptions belong to the **tenant owner** (`users.role='user'`, `subscriptions.userId`), not to a `companies` row. One tenant can own several companies. Plan gating must therefore be per tenant. |
| Plan catalogue | `subscription_plans` already exists with `TRIAL`, `BASIC`, `PROFESSIONAL`, `ENTERPRISE` and a `features` JSONB (`geofencing`, `travel`, `advancedReports`). **No code reads `features`** – plans only limit seat/company counts today. |
| Live data | All 28 tenant subscriptions are on `TRIAL` (26 ACTIVE, 2 TRIALING). Turning on gating without a plan mapping would strip features from every existing tenant. |
| Expiry policy | Already enforced: `getActiveSubscriptionForUser` self-heals to EXPIRED; `tokenCheck` blocks expired tenants except owner/admin on the access-request routes; super admin extends via Access Management. |
| Permissions | Per-user `module:action` permissions (`checkPermission`) + role gates (`authorizeRoles`). Super admin controls a tenant's permission set via `/user-management` ("Company Permissions"). No plan layer on top. |
| Add-ons | No add-on model. Tally is not purchasable/flaggable per tenant. |
| Database | Backend `.env` points to a **remote** Postgres (`168.144.93.228`). No separate test database is configured. |
| Tests | Backend `npm test` is a placeholder; frontend has no test runner. No Jest/Vitest/Playwright installed. |

## 1. Feature matrix

| Module | Feature | Plan | Existing Status | Missing Work | Test Status |
|---|---|---|---|---|---|
| Attendance & HR | Punch in / out | Lite | Already Implemented (`attendance` module, PunchWidget) | Plan gate | Not run |
| Attendance & HR | Geo-fencing + radius | Lite | Already Implemented (`geoFencing`, `userGeoFencing`, TravelGeofencingPage) | Plan gate | Not run |
| Attendance & HR | Geo-tagged attendance | Lite | Already Implemented (lat/long + location names, migration 0011) | — | Not run |
| Attendance & HR | Security: GPS, registered device, selfie | Lite | Already Implemented (`attendanceSecurity`, trusted devices, device change requests, punch photos) | — | Not run |
| Attendance & HR | Leave with manager approval | Lite | Already Implemented (`leave`, LeaveApproval, MyLeave, comp-off) | — | Not run |
| Attendance & HR | Regularization | Lite | Already Implemented (`attendanceRegularization`) | — | Not run |
| Attendance & HR | Shifts + department allocation | Lite | Already Implemented (`shift`, `department`, `allocation`) | — | Not run |
| Attendance & HR | Attendance & leave reports + download | Lite | Already Implemented (register export with half/short day, Reports page) | — | Not run |
| Employee Mgmt | Directory + profiles | Lite | Already Implemented (`employeeProfile`, UserManagement) | — | Not run |
| Employee Mgmt | Branch/department/shift assignment | Lite | Already Implemented | — | Not run |
| Employee Mgmt | Role-based access | Lite | Already Implemented (rbac + permissions) | — | Not run |
| Employee Mgmt | Bulk user + permission mgmt | Lite | Already Implemented (BulkUserRegistration, BulkPermissionsModal) | — | Not run |
| Collaboration | Tasks (assign, priority, Kanban, deadlines) | Lite | Already Implemented (`task`, comments, history, in_review) | — | Not run |
| Collaboration | Chat direct + group | Lite | Already Implemented (chatRoom type private/group, Socket.IO) | — | Not run |
| Collaboration | Announcements | Lite | Already Implemented | — | Not run |
| Collaboration | Notifications (approvals/tasks/meetings) | Lite | Already Implemented (Notification model, FCM, socket, drawer) | — | Not run |
| Support | WhatsApp + email support | Lite | Partially Implemented (ContactMenu, contact queries) | Confirm channels | Not run |
| Client Visits | Customers, search, CSV upload | Pro | Already Implemented (`client`, ClientBulkUpload, assignment/transfer) | Plan gate | Not run |
| Client Visits | Meeting create/schedule | Pro | Already Implemented (`meeting`) | Plan gate | Not run |
| Client Visits | Meeting check-in geo + photo | Pro | Already Implemented (lat/long in/out, meetingImage) | Plan gate | Not run |
| Client Visits | Meeting outcomes/notes | Pro | Already Implemented | Plan gate | Not run |
| Client Visits | GPS travel distance | Pro | Already Implemented (`travelDistance.service`, Google routes) | Plan gate | Not run |
| Client Visits | Vehicle-wise per-km TA | Pro | Already Implemented (company + user vehicle rates, 0023/0024) | Plan gate | Not run |
| Client Visits | Expenses (claims, categories, approval, reimbursement) | Pro | Already Implemented (expense, MyExpenses, ExpenseManagement) | Plan gate | Not run |
| Client Visits | Field activity reports | Pro | Partially Implemented (meetings dashboard, travel logs, Reports) | Plan gate; confirm meeting+expense report coverage | Not run |
| Separation | Resignation + manager approval | Advance | Already Implemented (`separation`, 0046; self-review blocked) | Plan gate | Not run |
| Separation | Notice period + LWD tracking | Advance | Already Implemented (policy, LWD patch, timeline/audit) | Plan gate | Not run |
| Separation | **Automatic deactivation on LWD** | Advance | **Partially Implemented** – cron moves to *handover*; deactivation happens only when admin clicks Complete (deliberate design) | Decision needed: auto-deactivate vs keep handover gate | Not run |
| Order Mgmt | Item master, categories, GST, discounts | Advance | Already Implemented (Category/SubCategory, locks) | Plan gate | Not run |
| Order Mgmt | Sales orders | Advance | Already Implemented (quotations as sale orders) | Plan gate | Not run |
| Order Mgmt | Quotation create + share | Advance | Already Implemented (QuotationModal, PDF) | Plan gate | Not run |
| Order Mgmt | Invoice finalisation + generation | Advance | Already Implemented (finalize added this session, proforma) | Plan gate | Not run |
| Order Mgmt | Inventory (stock + movement) | Advance | Already Implemented (ledger, row locks `LOCK.UPDATE`, reversal, proforma/sale-order choice) | Plan gate; verify service-item handling | Not run |
| Reports | Executive dashboard + insights | Advance | Partially Implemented (`/admin/dashboard-summary`, role dashboards; no plan gate; Punctuality KPI shows -58.8% → **Broken**) | Plan gate; fix punctuality | Not run |
| Reports | Business performance (orders, invoices, collections) | Advance | Partially Implemented (`reports/generate`, Tally report, CurrentOutstanding) | Plan gate | Not run |
| Assets | Registration + serial numbers | Advance | Already Implemented (`asset`, 0030, bulk import/export) | Plan gate | Not run |
| Assets | Assignment to employees | Advance | Already Implemented (assign/return) | Plan gate | Not run |
| Assets | Transfer history | Advance | Partially Implemented – history kept via assign/return; no one-step employee→employee transfer | Transfer action (return+assign in one transaction) | Not run |
| Assets | Details + status | Advance | Already Implemented | Plan gate | Not run |
| Support | Priority support | Advance | Missing (business process, not code) | Label only | — |
| Tally add-on | Two-way real-time sync | Add-on | **Blocked by External Dependency** – only inbound push endpoints (`/admin/bulk/*`) from a Tally-side connector; no outbound push, no connection config | Tally connector/ODBC/XML endpoint + credentials | Blocked |
| Tally add-on | Sales orders from/to Tally | Add-on | Partially Implemented (inbound quotations only) | Outbound path needs connector | Blocked |
| Tally add-on | Invoices from Tally | Add-on | Already Implemented (inbound, guid de-dupe) | Add-on gate, sync log table | Not run |
| Tally add-on | Outstanding report | Add-on | Partially Implemented (CurrentOutstanding page, tally-report) | Add-on gate | Not run |
| Subscription | Plan/feature gating (backend + frontend) | — | **Missing** | Central `hasFeatureAccess` + middleware + frontend guard | Not run |
| Subscription | Add-on model (Tally) | — | **Missing** | `subscription_addons` table + API | Not run |
| Subscription | Tenant subscription page (plan, dates, comparison, history) | — | Partially Implemented (SubscriptionAccessTab, SubscriptionExpired, super admin access mgmt) | Plan comparison, feature list, history, add-on status | Not run |

## 2. Proposed implementation order

1. **Subscription feature gating** (Phase 3) – additive migration: plan catalogue Lite/Pro/Advance (mapped onto existing plan rows), `subscription_addons`, feature map in code; `requireFeature(feature)` middleware applied at router level for Pro/Advance modules; `/admin/subscription/features` endpoint; frontend `FeatureGate` + sidebar filtering + upgrade screen.
2. Asset one-step transfer; separation LWD auto-deactivation (per decision); punctuality KPI fix.
3. Tally: add-on gate + sync log table on existing inbound endpoints; outbound marked Blocked until a connector exists.
4. Test framework (Jest + supertest for backend, Vitest for frontend) against an isolated test DB.
