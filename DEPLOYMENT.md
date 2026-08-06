# Deployment

The whole platform deploys as **one Vercel project on one domain**. The API and
the console are not separate deployments:

```
https://your-domain.vercel.app/            → the console (React SPA)
https://your-domain.vercel.app/api/*       → the Express API (serverless function)
https://your-domain.vercel.app/uploads/*   → uploaded files, served by the same function
```

`vercel.json` at the repository root routes `/api/*` and `/uploads/*` into
`api/index.ts` (which re-exports the Express app from `backend/`), and sends
everything else to `index.html` so client-side routing works on refresh.

Because they share an origin there is no CORS to configure and no API base URL
to set — the console just calls `/api/...`.

## 0. Database (already provisioned)

Supabase project **car-rental-platform** (`okqcbatnnkkitrbaeqrm`, eu-west-1)
holds the schema and seed data. Migrations `002_platform_v2` (multi-tenancy,
handover, damages, payments, GPS) and `003_client_registration` (phone-based
client sign-up) have both been applied there. You do not need to migrate or
seed again.

### Sign-in accounts on that database

| Role | Email | Password |
|---|---|---|
| Platform owner (every company) | `owner@bermirentals.co.tz` | `BermiOwner2026!` |
| Company admin — Bermi Rentals | `admin@bermirentals.co.tz` | `BermiAdmin2026!` |

Change both passwords from the Staff screen once you are in. Clients do not
appear here — they register themselves from the phone app.

Get the connection string from **Project Settings → Database → Connection
string → URI**, and use the **pooled** connection (host
`...pooler.supabase.com`, port `6543`). Serverless functions open many
short-lived connections and will exhaust the direct connection limit otherwise.
SSL is enabled automatically for Supabase hosts (`backend/src/config/db.ts`).

## 1. Create the project

New Project → import this repository, and leave every build setting as
detected. Vercel reads them from `vercel.json`:

| Setting | Value | Where it comes from |
| --- | --- | --- |
| Root Directory | *(repository root)* | leave empty |
| Build Command | `npm run build` | `vercel.json` |
| Output Directory | `web/dist` | `vercel.json` |
| Framework Preset | Other | — |

## 2. Set environment variables

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the pooled Supabase URI from step 0 |
| `JWT_SECRET` | a long random string |

Both are required. The API refuses to start without them rather than silently
falling back to a localhost connection string and then failing every request
(`backend/src/config/env.ts`).

`CORS_ORIGIN` is not needed — the console is served from the same origin.

## 3. Verify

Open `https://<your-domain>/api/health`. You want:

```json
{ "ok": true, "database": "connected" }
```

A 503 with `"database": "unreachable"` means `DATABASE_URL` is wrong. Then open
the root URL and sign in.

## Sign-in and roles

There is one login for everyone. The role on the account decides what the
console shows:

| | Admin | Staff |
| --- | --- | --- |
| Overview | fleet, revenue, pipeline | today's pickups and returns |
| Bookings, Check-In/Out, Documents, Deposits | ✅ | ✅ |
| Fleet, Clients | ✅ full | ✅ read-only |
| Reports, Staff, Settings | ✅ | hidden and blocked |

Seeded accounts (`backend/src/db/seed.ts`):

- `admin@rental.co.tz` / `Admin123!`
- `staff@rental.co.tz` / `Staff123!`

Navigation and route guards both read from `web/src/navigation.ts`, so a page
can't drift out of sync with the sidebar. The guards are a UI convenience — the
API enforces the same roles independently on every endpoint.

## A note on the root `package.json`

Its `dependencies` block duplicates the backend's runtime dependencies
(`express`, `pg`, `pdfkit`, …). That is deliberate: the serverless function
lives at `api/index.ts` in the repository root, so Vercel resolves its imports
against the root `package.json`. Keep the two lists in step when you add a
backend dependency.

## Local development

```bash
npm install     # once, at the repo root — sets up the workspace links
npm run dev:api # http://localhost:4000
npm run dev:web # http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to `localhost:4000`, so the
console behaves exactly as it does in production.

To set up a local database from scratch:

```bash
createdb rentaldb
cd backend && npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts
```

Both scripts resolve `database/schema.sql` relative to the working directory,
so run them from `backend/`.

## Known limitation: uploaded files don't persist

Uploads (client documents, vehicle photos, condition-report photos, generated
contract PDFs) are written to local disk by `backend/src/services/storage.ts`.
On Vercel the only writable location is the OS temp directory, and it isn't
shared between invocations — so an upload appears to succeed and then 404s on
the next request.

Seed data is unaffected, since those rows only store paths. But **uploads made
against the deployed API will not survive.** The fix is to swap
`LocalDiskStorage` for an object-storage driver (Supabase Storage or S3); the
`StorageDriver` interface exists so that change stays inside that one file.

## Security note

All 13 tables have Row Level Security disabled. It does not affect this
application — the API connects to Postgres directly as the database user, not
through the Supabase anon key — but if that anon key is ever used from a
client, every row is readable and writable by anyone holding it. Enable RLS
with policies before exposing the key:

```sql
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
-- ...and the remaining 12 tables
```

Enabling RLS without policies blocks all access, so add the policies in the
same change.
