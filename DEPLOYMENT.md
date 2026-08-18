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

## 0. Database

The app speaks plain Postgres through `pg` — no provider SDK, no vendor
extensions, no row-level-security policies. Any Postgres 14 or newer works, and
switching provider means changing `DATABASE_URL` and nothing else.

### Picking one

**Neon** (neon.tech) is the recommendation for this app: the free tier needs no
card, gives you a full Postgres 17 database, and hands out a pooled connection
string — which is what a serverless deployment needs. Create a project, then
copy the connection string marked **Pooled connection**.

These also work unchanged:

| Provider | Free tier | Notes |
| --- | --- | --- |
| **Neon** | yes, no card | Pooled endpoint built in. Best fit here. |
| **Vercel Postgres** | yes | Neon underneath; sets `DATABASE_URL` for you. |
| **Render** | 90 days, then paid | Use the *External* connection string. |
| **Aiven** | yes | Plenty of connections; slower cold start. |
| **Supabase** | 2 active projects | Use the **pooled** URI, port `6543`. |
| Your own Postgres | — | Works too; make sure TLS is on if it is remote. |

Whatever you choose, prefer the **pooled** connection string where the provider
offers one. Serverless functions open many short-lived connections and will
exhaust a direct-connection limit. `backend/src/config/db.ts` also caps each
function instance at one connection when running on Vercel.

TLS is handled for you: any host that is not localhost is connected to over
TLS automatically, so you do not need `?sslmode=require` in the URL (though it
does no harm).

### Setting it up

Point the two commands at the new database and it goes from empty to usable:

```bash
export DATABASE_URL='postgres://...'   # your new connection string
export JWT_SECRET='any long random string'

npm run migrate        # base schema + every migration, in order
npm run create-owner -- --email you@yourcompany.co.tz --password 'a good one'
```

`migrate` is safe to re-run — it records what it has applied in
`schema_migrations` and every migration is written to be idempotent.

`create-owner` is the bootstrap step, and the only place a platform owner can
be created without already being one. A fresh database has no way in
otherwise: staff accounts are created from inside the console, and you need an
account to open the console. Run it again with the same email to reset that
account's password.

Then sign in at `/login` and:

1. Register your companies on the **Companies** screen.
2. Create each company's first admin on the **Staff** screen, choosing the
   company it belongs to.
3. That admin adds their own staff and lists their cars.

Clients never appear in any of this — they register themselves from the phone
app with a name, a phone number and a password.

### Sample data (optional)

```bash
npm run seed
```

Creates two companies, five vehicles, a booking in each status, and sample
staff and client logins. Useful for a demo, not something to run against a
database you are actually using.

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
| `DATABASE_URL` | the pooled connection string from step 0 |
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
`LocalDiskStorage` for an object-storage driver (S3, Cloudflare R2, or your
provider's own object storage); the
`StorageDriver` interface exists so that change stays inside that one file.

## Security note

Tenant isolation is enforced in the API, not in the database. Every query that
touches company data is scoped by `req.companyId`, which comes from the signed
token and never from anything the browser sends
(`backend/src/middleware/auth.ts`). Row Level Security is off on all 13 tables.

That is fine as long as the only thing talking to Postgres is this API, using
the database user in `DATABASE_URL`. It stops being fine the moment any
credential reaches a browser — a Supabase anon key, a PostgREST endpoint, a
direct connection string in frontend code. Anyone holding it could read and
write every row of every company. If you ever expose one, enable RLS with
policies first:

```sql
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
-- ...and the remaining 12 tables
```

Keep `DATABASE_URL` server-side only. It belongs in the deployment's
environment variables and nowhere else — never in `web/`, never in `mobile/`,
never committed.

Enabling RLS without policies blocks all access, so add the policies in the
same change.
