# Rental Car Management Platform

A full car rental platform for a business in Tanzania: an Admin Dashboard, a
Staff Dashboard, a client-facing mobile app, and the shared API behind all
three. Deposits and payments are recorded manually by staff — there is no
mobile money or WhatsApp integration in this build, and no live currency
exchange rate API (the rate is a manually editable admin setting).

For deploying to Vercel, see **[DEPLOYMENT.md](DEPLOYMENT.md)**. The sections
below cover running everything locally.

## Structure

```
backend/          Express + TypeScript API (PostgreSQL, JWT auth, local file storage)
web-admin/        Admin Dashboard — React + TypeScript + Tailwind (Vite)
web-staff/        Staff Dashboard — React + TypeScript + Tailwind (Vite)
mobile/           Client mobile app — React Native + Expo (installable iOS/Android app)
packages/shared/  Shared design tokens, TS types, and a small Tailwind-based
                  UI kit (Button, Card, StatusBadge, Input, EmptyState, Spinner,
                  StatCard, BookingStepper) reused by both web dashboards
database/         schema.sql — the full PostgreSQL schema
```

The two web dashboards and the mobile app all talk to the same backend API.
Uploaded files (vehicle photos, ID documents, condition report photos,
contract PDFs) are stored on local disk under `backend/uploads/`, behind a
small storage interface (`backend/src/services/storage.ts`) that can be
swapped for a cloud backend (S3, GCS, etc.) later without touching call sites.

## Design System

A two-color palette (a primary action/brand blue and a neutral gray used for
structure) plus muted status colors for pending/confirmed/active/completed/
cancelled states. Defined once in `packages/shared/src/tokens.ts` (used by
both web apps via a Tailwind preset, and mirrored as plain values in
`mobile/src/theme/tokens.ts` since React Native doesn't consume Tailwind).

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- For the mobile app: the Expo Go app on a phone, or an iOS/Android
  simulator, plus the [Expo CLI](https://docs.expo.dev/) (`npx expo`)

## 1. Database

Create a database and apply the schema:

```bash
createdb rentaldb
```

Then, from `backend/`, either apply the schema directly with psql:

```bash
psql -d rentaldb -f ../database/schema.sql
```

...or use the bundled migration runner (does the same thing):

```bash
cd backend
cp .env.example .env   # edit DATABASE_URL if needed
npm install
npm run migrate
```

## 2. Backend API

```bash
cd backend
npm install
npm run migrate   # applies database/schema.sql
npm run seed       # sample vehicles, staff, clients, bookings in every status
npm run dev        # starts the API on http://localhost:4000
```

Seed data creates these accounts (all passwords below):

| Role   | Email                        | Password    |
|--------|-------------------------------|-------------|
| Admin  | admin@rental.co.tz            | Admin123!   |
| Staff  | staff@rental.co.tz             | Staff123!   |
| Client | grace.mushi@example.com        | Client123!  |
| Client | peter.komba@example.com        | Client123!  |
| Client | fatuma.said@example.com        | Client123!  |

The seed script creates one booking in each status (`pending_documents`,
`documents_submitted`, `confirmed`, `active`, `completed`, `cancelled`) so
every screen in every dashboard has real data to show immediately.

## 3. Admin Dashboard

```bash
cd web-admin
npm install
npm run dev   # http://localhost:5173, proxies /api and /uploads to :4000
```

Covers: overview (fleet utilization, revenue, bookings pipeline, missing
documents alerts, upcoming maintenance, recent activity), fleet management
with photo gallery and maintenance log, bookings with full timeline, clients
with rental history and linked devices, staff account management, the
document verification queue, deposit release/forfeit, reports (CSV/PDF
export), and settings (exchange rate, seasonal pricing).

## 4. Staff Dashboard

```bash
cd web-staff
npm install
npm run dev   # http://localhost:5174, proxies /api and /uploads to :4000
```

Covers: overview (today's pickups/returns, pending document verification,
quick-create), booking creation with client search and live quote
calculation, the same booking timeline/status actions as Admin, document
verification, check-in/check-out condition report entry (which drives the
booking's activate/complete transitions), deposit recording, and a personal
activity log.

## 5. Client Mobile App

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press
`i`/`a` to open an iOS/Android simulator.

**Important:** the app talks to the API via the `apiBaseUrl` value in
`mobile/app.json` (`extra.apiBaseUrl`), which defaults to
`http://localhost:4000`. That only works from an iOS simulator on the same
machine as the API. For a physical device or an Android emulator, change it
to your machine's LAN IP (e.g. `http://192.168.1.20:4000`) — Android
emulators specifically can also reach the host machine at
`http://10.0.2.2:4000`.

Covers: home (current rental card, past/upcoming summary, browse CTA),
browsing available vehicles and requesting a booking (creates a booking in
`pending_documents`), uploading ID/driving license documents, my bookings
(with the same status stepper as the dashboards), my contracts, my devices
(list + unlink), and profile editing.

## Booking Workflow

Every booking moves through: **Pending Documents → Documents Submitted →
Confirmed → Active → Completed** (or **Cancelled** at any point before
completion). A booking cannot be confirmed until the client's ID and driving
license are both uploaded *and* marked verified by staff — this is enforced
server-side (`backend/src/services/bookingWorkflow.ts`), not just in the UI.
Documents are tied to the client's profile, so a repeat client who already
has verified documents on file doesn't need to re-upload them for a new
booking; the gate re-checks whatever's on file for that client at booking
creation, document upload, and verification time.

Quotes are calculated as base daily rate × number of days, with any active
seasonal pricing multiplier applied, converted to the requested currency
using the admin-set exchange rate, and are always staff-editable via an
override amount before a booking is saved.
