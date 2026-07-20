# Local development setup

This documents how the local dev environment was bootstrapped, and how to
redo it from scratch if needed (e.g. on a new machine, or after wiping the
local database).

## Prerequisites

- A local PostgreSQL server. This was set up against PostgreSQL 16 running
  as a Windows service on port **5433** (there's also a PG18 service on this
  machine at the default port 5432 — make sure you're pointing at the right
  one).
- Node 24+ (matches `package.json` engines expectations informally).

## 1. Database

A dedicated (non-superuser) role and database were created:

```sql
CREATE ROLE salesvera_app LOGIN PASSWORD '<generated>';
CREATE DATABASE salesvera_dev OWNER salesvera_app;
```

The generated password lives only in `salesbackend/.env` (gitignored) — it
is not written down anywhere else.

## 2. `salesbackend/.env`

A `.env` was created with `DB_HOST=127.0.0.1`, `DB_PORT=5433`,
`DB_NAME=salesvera_dev`, `DB_USER_NAME=salesvera_app`, `DB_PASSWORD=...`,
`PORT=4800`, and a freshly generated `JWT_SECRET`.

**AWS_S3_BUCKET note**: `src/config/fileUploads.ts` builds a `multer-s3`
upload middleware at *module load time* (imported at the top of
`router/admin.ts`), and `multer-s3` throws synchronously if
`AWS_S3_BUCKET`/AWS credentials aren't set — this happens before the server
can even start listening, unlike the other optional integrations (email,
Firebase) which fail gracefully at call-time instead. `.env` sets
placeholder AWS values purely to satisfy this boot-time check. **File
upload/download features (avatars, chat attachments, bulk CSV/XLSX
uploads for attendance and salesperson import) will not actually work
locally** unless you swap in real AWS credentials — everything else
(auth, HRMS, task, chat, dashboard, permissions) works fully against the
local Postgres instance.

## 3. Creating the schema on a fresh database

The app's normal boot path (`connectDB()` in `src/config/dbConnection.ts`)
only runs `ALTER TABLE`/data-repair statements against tables that already
exist — it was built assuming a pre-existing (shared/cloud) database and
was never meant to create a schema from scratch. On a brand-new empty
database most tables don't exist yet, so that boot path errors out
repeatedly with `relation "..." does not exist`.

To bootstrap a **fresh, empty** local database only, run:

```
npm run db:bootstrap:local
```

This runs `src/scripts/localDbBootstrap.ts`, a new one-off script (same
pattern as the existing `migrateTenantId.ts`) that calls Sequelize's own
`sync()` — plain table creation from the existing, unmodified model
definitions — to create every table once. It refuses to run against
anything but `DB_HOST=127.0.0.1`/`localhost` as a safety check. **Run it
exactly once per fresh database** — normal `npm run dev` boots handle
everything after that.

One thing this script's `sync()` couldn't do automatically: Sequelize has a
known bug generating invalid SQL (`SET DEFAULT NULL REFERENCES ...` in one
statement) when fixing up circular foreign keys — in this schema that's the
`users.branchId -> branches.id` self-reference. If you bootstrap a new
database from scratch, add that FK manually afterward:

```sql
ALTER TABLE "users" ALTER COLUMN "branchId" SET DEFAULT NULL;
ALTER TABLE "users" ADD CONSTRAINT users_branchid_fkey
  FOREIGN KEY ("branchId") REFERENCES branches(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
```

**Known schema bug — `user_permissions.companyId`**: the frozen boot
migration's `CREATE TABLE IF NOT EXISTS "user_permissions"`
(`src/config/dbConnection.ts` ~line 736) declares `"companyId" INTEGER NOT
NULL`, but the Sequelize model (`src/app/model/userPermission.ts`) declares
`allowNull: true`, and the application code deliberately inserts
`companyId: null` in several places (e.g. `Register` in `admin.ts` when a
super_admin grants permissions to a new tenant-root "user", and the
"null-scoped" admin-permission propagation in `assignPermissions`) —
company-agnostic permissions are an intentional concept in this schema.
Found this while testing the Phase 2 default-permission-template feature,
which is the first code path to actually exercise a null `companyId`
insert. This function is on the frozen list (interleaves Tally-table DDL),
so I did not edit it — only patched the local database directly:

```sql
ALTER TABLE "user_permissions" ALTER COLUMN "companyId" DROP NOT NULL;
```

**This almost certainly affects the production/cloud database too** if
`user_permissions` was created by this same boot code there — worth
running the same `ALTER TABLE` against production, or asking me to fix the
migration source directly if you want to lift the freeze on that one line.

## 4. Running the backend

```
npm run dev
```

Boots on `http://localhost:4800`. Swagger UI at `/api-docs` (note: it's a
manually-generated static snapshot — see `npm run swagger` — and doesn't
include the `bulkSync` Tally router; treat the router source files as the
real source of truth for the API surface).

## 5. Seed data

A `super_admin` account was created via `POST /admin/register`:
- email: `superadmin@salesvera.local`
- password: `SuperAdmin@123`

From there, log into the frontend as this user and register a demo company
through the actual registration wizard (`/registration`) — it's a
multi-step flow that calls several endpoints in sequence
(`addCompany`/`addBanks`/`addBranch`/`addShift`/`addDepartment`/
`addLeaveType`/`addHoliday`), so it's easiest to drive through the real UI
rather than replicate by hand.

## 6. Frontend

`salesveranew/.env` → `VITE_API_BASE_URL=http://localhost:4800` points the
Vite dev server at this local backend. The previous remote values are kept
commented in the same file for quick revert. Note this `.env` file is **not
gitignored** in this repo (unlike the backend's) — worth being careful
about what goes in it.

```
npm run dev
```
