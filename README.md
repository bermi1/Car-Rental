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

Database — any Postgres 14+, local or hosted:

```bash
createdb rentaldb
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
cd ..

npm run migrate               # base schema + every migration, in order
npm run seed                  # sample fleet, staff, clients, bookings
```

`migrate` is safe to re-run: it records what it has applied in
`schema_migrations`, and every migration is written to be idempotent.

There is no provider SDK anywhere in the code — the app talks to Postgres
through `pg` and nothing else. Neon, Railway, Render, Aiven, Vercel Postgres,
Supabase or your own server all work by changing `DATABASE_URL`. Anything that
is not localhost is connected to over TLS automatically, so a hosted
connection string works as pasted.

To start a real (non-demo) database instead of seeding it, create the first
platform owner and do the rest from the console:

```bash
npm run create-owner -- --email you@yourcompany.co.tz --password 'a good one'
```

That is the only way a platform owner is created — a fresh database has no
other way in, since staff accounts are made from inside the console.

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
editing — plus the v2 flows:

- **Quick registration.** Name, phone number and a password. Email is optional.
  The phone number is the account handle, and 0712…, 255712… and +255 712… are
  all accepted and stored the same way.
- **Sign in with either** the phone number or the email.
- **Payment.** The balance for a booking (rental total, charged penalties, what
  has been confirmed paid) with a sheet to record a payment made by mobile
  money, bank or cash and attach the receipt photo. There is no card gateway —
  staff confirm the receipt from the console.
- **Location sharing.** A switch on an active booking. Turning it on asks for
  the OS location permission and sends a position every two minutes while the
  app is open; the server drops anything outside an active, opted-in rental,
  and turning it off stops collection immediately.
- **Handover record.** The photos and walkaround video taken at pickup and
  return, viewable from the booking.
- **Kiswahili** throughout, switchable from the sign-in screen or Profile.

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

---

## Platform features (v2)

### Multi-tenant

A **super admin** registers rental companies; each company owns its own fleet,
staff, bookings, settings and payment details. Tenant isolation is enforced at a
single choke point (`backend/src/middleware/auth.ts` → `resolveCompany`): route
handlers read `req.companyId` and never trust a company id from the request
body, so one company's staff cannot reach another's rows by guessing an id.

A super admin picks which tenant to act inside via the company switcher; that
choice rides as an `X-Company-Id` header. Ordinary staff send it too and the
server ignores it — their company comes from their token, so the header can
never widen anyone's access.

### Handover with video

Check-in and check-out capture a short walkaround video plus stills, stored
against the condition report. That footage is what a later damage claim is
argued from, so both ends of the rental are evidenced.

### Damages and penalties

Staff itemise damage found at return and set the penalty. With
`ANTHROPIC_API_KEY` configured, they can instead describe what they found in
plain language and have Claude draft the itemisation and suggested amounts
against the company's own penalty rates — saved items are flagged `ai_assisted`
so a reviewer can tell.

### Payments — recorded, evidenced, confirmed

There is **no payment gateway**. A payment is recorded with its method and
reference, the payer attaches a receipt (client from the app, or staff at the
desk), and staff confirm or reject it. `GET /api/payments/booking/:id/balance`
returns quoted + penalties − confirmed payments.

### Location sharing

While a rental is active, the client's phone reports position on a timer after
granting permission. Sharing is per booking and pings are rejected outside the
active window, so a phone never reports outside the period the client agreed
to. Staff see last-known positions on **Live Tracking**, and the full trail when
a vehicle needs finding.

### Kiswahili

The console ships English and Kiswahili, toggled in the header and persisted to
the account so the choice follows the user to another device.

### AI assistance

Optional throughout — set `ANTHROPIC_API_KEY` to enable, and everything works
without it:

- **Assistant** — ask about fleet, bookings, payments and penalties in plain
  language (English or Kiswahili). This is what replaces filtering a
  spreadsheet. The snapshot is assembled server-side from the asking company's
  own aggregates, so a question can't reach another tenant's data.
- **Damage drafting** — rough notes to itemised damage with suggested penalties.
- **Handover summaries** — condition-report fields to a paragraph fit for the
  contract.

### Seeded accounts (v2)

| Role | Email | Password |
|---|---|---|
| Super admin | `owner@rentalplatform.co.tz` | `Super123!` |
| Admin — Serengeti Car Hire | `admin@rental.co.tz` | `Admin123!` |
| Staff — Serengeti Car Hire | `staff@rental.co.tz` | `Staff123!` |
| Admin — Kilimanjaro Rentals | `admin@kilirentals.co.tz` | `Admin123!` |
| Clients | `grace.mushi@example.com` and two others | `Client123!` |

Sign in as each company's admin to see the isolation: Serengeti has 5 vehicles
and 6 bookings, Kilimanjaro has 2 and 0.

Clients no longer need seeding to exist — anyone can register themselves from
the phone app.

## Accounts and registration

Two different things create the two kinds of account:

**Clients register themselves.** `POST /api/auth/client/register` takes a name,
a phone number and a password; email is optional. A client account is
platform-wide, not tied to one company — the company comes from the car they
book. Sign-in accepts the phone number or the email as the identifier.

**Staff accounts are created in the console**, never by self-registration:

- A **platform owner** (`super_admin`) registers companies on the Companies
  screen, then creates each company's first admin on the Staff screen, naming
  the company the account belongs to.
- A **company admin** adds their own staff on the same screen. They cannot see
  or touch another company's accounts, and the company is taken from their
  token — not from anything the browser sends.
- An account with no company is rejected at creation, because it could sign in
  but not open anything.

## Known gaps in this increment

- **Kiswahili covers the navigation, shell and the new screens** (Payments,
  Damages, Tracking, Assistant, Companies). The older screens — Overview,
  Bookings, Fleet, Clients, Documents, Deposits, Reports, Staff — still render
  English body copy. The catalogue and `useT()` hook are in place; those pages
  need their strings swapped for keys.
- **WhatsApp OTP is not built.** Registration takes a phone number and trusts
  it. `clients.phone_verified` exists in the schema ready for the verification
  step, and is always `false` today.
- **Location sharing is foreground-only.** The app pings while the client has
  it open. No background task is registered, so a phone in a pocket with the
  app closed reports nothing.
