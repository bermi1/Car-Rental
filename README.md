# Rental Car Management Platform

A car rental platform for a business in Tanzania: one web console used by both
admin and staff, a client-facing mobile app, and the API behind both. Deposits
and payments are recorded manually by staff — there is no mobile money or
WhatsApp integration in this build, and no live currency exchange rate API (the
rate is a manually editable admin setting).

The console and the API deploy together as **a single Vercel project on one
domain** — see **[DEPLOYMENT.md](DEPLOYMENT.md)**. The sections below cover
running everything locally.

## Structure

```
web/              The console — React + TypeScript + Tailwind (Vite).
                  One app for both roles; the sidebar and route guards adapt
                  to whether the signed-in account is admin or staff.
backend/          Express + TypeScript API (PostgreSQL, JWT auth, file storage)
api/index.ts      Vercel serverless entry point — re-exports the Express app
mobile/           Client mobile app — React Native + Expo
packages/shared/  Design system: theme tokens, Tailwind preset, icon set, UI
                  primitives (Button, Card, Table, Modal, StatusBadge, …),
                  domain types and display formatters
database/         schema.sql — the full PostgreSQL schema
vercel.json       Routes /api/* and /uploads/* to the function, the rest to the SPA
```

Uploaded files (vehicle photos, ID documents, condition report photos, contract
PDFs) go through a small storage interface
(`backend/src/services/storage.ts`) that can be swapped for a cloud backend
without touching call sites. See the note in DEPLOYMENT.md about how this
behaves on serverless.

## One console, two roles

There is a single sign-in. The account's role decides what appears:

| | Admin | Staff |
| --- | --- | --- |
| Overview | fleet utilisation, revenue, pipeline, maintenance | today's pickups, returns, pending verification |
| Bookings, Check-In/Out, Documents, Deposits | ✅ | ✅ |
| Fleet, Clients | ✅ full | ✅ read-only |
| Reports, Staff accounts, Settings | ✅ | hidden and blocked |

`web/src/navigation.ts` is the single source of truth for both the sidebar and
the route guards. Those guards are a UI convenience — the API enforces the same
roles independently on every endpoint.

## Design system

Colours are semantic CSS custom properties (`surface`, `line`, `fg-muted`,
`accent`, `success`…) defined in `packages/shared/src/theme.css` and exposed to
Tailwind through `tailwind-preset.js`. A `.dark` class on `<html>` reskins the
entire app, so no component needs to know which theme is active; the toggle
persists to `localStorage` and is applied before first paint to avoid a flash.

Icons are inline SVG (`packages/shared/src/ui/Icon.tsx`) rather than an icon
package, so nothing is fetched at runtime.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- For the mobile app: Expo Go on a phone or a simulator (`npx expo`)

## Running locally

```bash
npm install       # once, at the repo root — sets up the workspace links
```

Database:

```bash
createdb rentaldb
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
npx tsx src/db/migrate.ts     # applies database/schema.sql
npx tsx src/db/seed.ts        # sample fleet, staff, clients, bookings
```

Both scripts resolve `database/schema.sql` relative to the working directory,
so run them from `backend/`.

Then, from the repo root, in two terminals:

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to `localhost:4000`, so the
console behaves exactly as it does in production.

### Seeded accounts

| Role   | Email                   | Password   |
|--------|-------------------------|------------|
| Admin  | admin@rental.co.tz      | Admin123!  |
| Staff  | staff@rental.co.tz      | Staff123!  |
| Client | grace.mushi@example.com | Client123! |
| Client | peter.komba@example.com | Client123! |
| Client | fatuma.said@example.com | Client123! |

The seed creates one booking in each status (`pending_documents`,
`documents_submitted`, `confirmed`, `active`, `completed`, `cancelled`) so
every screen has real data immediately.

## Client mobile app

```bash
cd mobile
npm install
npx expo start
```

The app reads the API URL from `extra.apiBaseUrl` in `mobile/app.json`, which
defaults to `http://localhost:4000`. That only works from an iOS simulator on
the same machine. For a physical device use your machine's LAN IP
(`http://192.168.1.20:4000`); Android emulators can reach the host at
`http://10.0.2.2:4000`. Point it at the deployed URL for a real build.

Covers: home (current rental, past/upcoming summary), browsing available
vehicles and requesting a booking, uploading ID and driving license documents,
my bookings with the status stepper, contracts, linked devices, and profile
editing.

## Booking workflow

Every booking moves through **Pending Documents → Documents Submitted →
Confirmed → Active → Completed**, or **Cancelled** at any point before
completion. A booking cannot be confirmed until the client's ID and driving
license are both uploaded *and* verified by staff — enforced server-side in
`backend/src/services/bookingWorkflow.ts`, not just in the UI. Documents belong
to the client's profile, so a repeat client with verified documents on file
doesn't re-upload them for a new booking.

Check-in and check-out are what drive the `active` and `completed` transitions:
recording a condition report on the Check-In / Out screen advances the booking.

Quotes are base daily rate × days, with any active seasonal pricing multiplier
applied, converted to the requested currency at the admin-set exchange rate,
and always staff-editable via an override before the booking is saved.
