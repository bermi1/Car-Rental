# Deployment

Three Vercel projects from this one repository, plus the existing Supabase
database. Nothing in the repo hardcodes a deployment URL — each project is
wired up through environment variables, so you can deploy them in any order as
long as the API goes first (the dashboards need its URL).

## 0. Database (already provisioned)

Supabase project **car-rental-platform** (`okqcbatnnkkitrbaeqrm`, eu-west-1) is
live and already contains the schema and seed data — 5 vehicles, 6 bookings,
3 clients, 2 staff users. You do not need to run migrations or the seed again.

Get the connection string from **Project Settings → Database → Connection
string → URI**. Use the **pooled** connection (host `...pooler.supabase.com`,
port `6543`) — serverless functions open many short-lived connections and will
exhaust the direct connection limit otherwise.

The pool already enables SSL automatically for Supabase hosts
(`backend/src/config/db.ts`).

## 1. API — `car-rental-api`

New Project → import this repository.

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Framework Preset | Other |
| Build / Install / Output | leave as detected |

Environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the pooled Supabase URI from step 0 |
| `JWT_SECRET` | a long random string |
| `CORS_ORIGIN` | `*` at first; tighten to the dashboard origins once they exist |

`backend/vercel.json` routes every request into the Express app exported from
`backend/api/index.ts`.

**Verify before moving on:** open `https://<api-url>/api/health`. You want:

```json
{ "ok": true, "database": "connected" }
```

A 503 with `"database": "unreachable"` means `DATABASE_URL` is wrong. If the
build itself fails with `DATABASE_URL is not set`, the variable didn't save —
the API now refuses to start without it rather than silently falling back to
localhost and failing every request instead.

## 2. Admin dashboard — `car-rental-admin`

| Setting | Value |
| --- | --- |
| Root Directory | `web-admin` |
| Framework Preset | Vite |
| Build / Install / Output | leave as detected |

Environment variable:

| Name | Value |
| --- | --- |
| `VITE_API_BASE_URL` | the API URL from step 1, no trailing slash |

This is a monorepo using npm workspaces, and `web-admin` depends on the
workspace package `@rental/shared`. Vercel detects the workspace and runs the
install at the repository root, which is what makes that dependency resolve. If
an install ever fails with `404 Not Found - @rental/shared`, check that
**Include files outside the Root Directory** is enabled in the project's
General settings.

## 3. Staff dashboard — `car-rental-staff`

Identical to step 2, with Root Directory `web-staff`.

## 4. Mobile app

`mobile/app.json` carries the API URL under `expo.extra.apiBaseUrl`; it
defaults to `http://localhost:4000`. Point it at the deployed API before
building:

```json
"extra": { "apiBaseUrl": "https://<api-url>" }
```

## Sign-in

Seeded accounts (from `backend/src/db/seed.ts`):

- Admin dashboard — `admin@rental.co.tz`
- Staff dashboard — `staff@rental.co.tz`

The admin dashboard rejects non-admin accounts at login, and the staff
dashboard accepts both roles.

## Local development

```bash
npm install          # once, at the repo root — sets up the workspace links
npm run dev:api      # http://localhost:4000
npm run dev:admin    # http://localhost:5173
npm run dev:staff    # http://localhost:5174
```

Leave `VITE_API_BASE_URL` unset locally — the Vite dev server proxies `/api`
and `/uploads` to `localhost:4000`, so the dashboards talk to the same origin.

## Known limitation: uploaded files don't persist

Uploads (client documents, vehicle photos, condition-report photos, generated
contract PDFs) are written to local disk by `backend/src/services/storage.ts`.
On Vercel the only writable location is the OS temp directory, and it isn't
shared between invocations — so an upload appears to succeed and then 404s on
the next request.

Everything the seed data already references is fine, because those rows just
store paths. But **uploads made against the deployed API will not survive.**
Fixing this means swapping `LocalDiskStorage` for an object-storage driver
(Supabase Storage or S3); the `StorageDriver` interface exists precisely so
that change stays confined to that one file.

## Security note

All 13 tables have Row Level Security disabled. It does not affect this
application — the API connects directly to Postgres as the database user, not
through the Supabase anon key — but if that anon key is ever used from a
client, every row is readable and writable by anyone holding it. Enable RLS
with policies before exposing the key:

```sql
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
-- ...and the remaining 12 tables
```

Enabling RLS without also adding policies blocks all access, so add the
policies in the same change.
