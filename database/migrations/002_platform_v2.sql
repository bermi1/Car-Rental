-- ============================================================
-- Migration 002 — multi-tenant platform
--
-- Turns the single-company system into a platform: a super admin creates
-- companies, each company owns its fleet, staff, bookings and settings.
-- Also adds the handover flow (video + photos), damage assessment with
-- penalties, manual payments with uploaded receipts, and GPS tracking.
--
-- Idempotent: safe to run against an existing database more than once.
-- Existing rows are adopted by a single "default" company so nothing is lost.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
DO $$ BEGIN
  -- The platform operator, above any single company.
  ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'mobile_money', 'card', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Payments are recorded and evidenced by an uploaded receipt, then
  -- confirmed by staff. There is no payment gateway in this build.
  CREATE TYPE payment_status AS ENUM ('awaiting_confirmation', 'confirmed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE damage_severity AS ENUM ('minor', 'moderate', 'severe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE damage_status AS ENUM ('assessed', 'charged', 'waived', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app_language AS ENUM ('en', 'sw');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- COMPANIES (tenants)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  registration_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  region TEXT,
  logo_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adopt any pre-existing data into one company so nothing is orphaned.
-- Only when there IS pre-existing data: on a fresh database this must not run,
-- or every new install starts with a stray empty company.
INSERT INTO companies (name, slug, region, contact_email)
SELECT 'Default Company', 'default', 'Dar es Salaam', 'admin@rental.co.tz'
WHERE NOT EXISTS (SELECT 1 FROM companies)
  AND (EXISTS (SELECT 1 FROM staff_users) OR EXISTS (SELECT 1 FROM vehicles));

-- ------------------------------------------------------------
-- TENANT COLUMNS
-- ------------------------------------------------------------
ALTER TABLE staff_users     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE vehicles        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE bookings        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE seasonal_pricing ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE staff_users      SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE vehicles         SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE bookings         SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
UPDATE seasonal_pricing SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;

-- Vehicles and bookings always belong to a company. staff_users does not:
-- a super_admin belongs to the platform, not to any one company.
ALTER TABLE vehicles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_company ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_company ON staff_users(company_id);

-- Plate numbers only need to be unique within a company.
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_company_plate ON vehicles(company_id, plate_number);

-- ------------------------------------------------------------
-- LANGUAGE PREFERENCES (English / Kiswahili)
-- ------------------------------------------------------------
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS language app_language NOT NULL DEFAULT 'en';
ALTER TABLE clients     ADD COLUMN IF NOT EXISTS language app_language NOT NULL DEFAULT 'en';

-- ------------------------------------------------------------
-- PER-COMPANY SETTINGS
--
-- system_settings was a single locked row (id = 1). Each company now needs
-- its own exchange rate and default pricing, so it becomes one row per
-- company, carrying the old values onto the first company.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  usd_to_tzs_rate NUMERIC(14,4) NOT NULL DEFAULT 2600,
  default_daily_rate_tzs NUMERIC(14,2) NOT NULL DEFAULT 100000,
  -- Penalties the company charges when a vehicle comes back damaged or late.
  late_return_fee_per_day_tzs NUMERIC(14,2) NOT NULL DEFAULT 25000,
  fuel_shortfall_fee_tzs NUMERIC(14,2) NOT NULL DEFAULT 20000,
  -- How much of the daily rate to hold as a security deposit.
  deposit_percent NUMERIC(6,3) NOT NULL DEFAULT 30,
  -- Bank / mobile money details shown to clients on the payment screen.
  payment_instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO company_settings (company_id, usd_to_tzs_rate, default_daily_rate_tzs)
SELECT c.id,
       COALESCE((SELECT usd_to_tzs_rate FROM system_settings WHERE id = 1), 2600),
       COALESCE((SELECT default_daily_rate_tzs FROM system_settings WHERE id = 1), 100000)
FROM companies c
ON CONFLICT (company_id) DO NOTHING;

-- ------------------------------------------------------------
-- HANDOVER MEDIA
--
-- A condition report is the handover record. Staff record a short walkaround
-- video plus stills at pickup and again at return, so the vehicle's state is
-- evidenced from both ends of the rental.
-- ------------------------------------------------------------
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS client_signature_path TEXT;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS exterior_clean BOOLEAN;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS acknowledged_by_client BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- DAMAGES AND PENALTIES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  condition_report_id UUID REFERENCES condition_reports(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  severity damage_severity NOT NULL DEFAULT 'minor',
  photos TEXT[] NOT NULL DEFAULT '{}',
  penalty_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency currency NOT NULL DEFAULT 'TZS',
  status damage_status NOT NULL DEFAULT 'assessed',
  -- Set when the assessment was drafted with AI assistance, so a human
  -- reviewer can see it wasn't typed from scratch.
  ai_assisted BOOLEAN NOT NULL DEFAULT false,
  assessed_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damages_booking ON damages(booking_id);
CREATE INDEX IF NOT EXISTS idx_damages_company ON damages(company_id);

-- ------------------------------------------------------------
-- PAYMENTS
--
-- No payment gateway. A payment is recorded with its method and reference,
-- the payer uploads a receipt, and staff confirm or reject it.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency currency NOT NULL DEFAULT 'TZS',
  method payment_method NOT NULL DEFAULT 'mobile_money',
  reference TEXT,
  receipt_file_path TEXT,
  status payment_status NOT NULL DEFAULT 'awaiting_confirmation',
  note TEXT,
  rejection_reason TEXT,
  paid_at TIMESTAMPTZ,
  recorded_by_staff_id UUID REFERENCES staff_users(id),
  recorded_by_client_id UUID REFERENCES clients(id),
  confirmed_by UUID REFERENCES staff_users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_status ON payments(company_id, status);

-- ------------------------------------------------------------
-- LOCATION TRACKING
--
-- Pings come from the client's phone while a rental is active — the app asks
-- for location permission at handover. This is deliberately append-only so
-- the trail can be replayed if a vehicle needs to be found.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  accuracy_m NUMERIC(8,2),
  speed_kph NUMERIC(6,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (latitude BETWEEN -90 AND 90),
  CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_location_booking_time ON location_pings(booking_id, recorded_at DESC);

-- Whether the client has granted location sharing for this rental.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN NOT NULL DEFAULT false;

-- Bookings raised by the client from the mobile app rather than by staff.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_client_id UUID REFERENCES clients(id);

-- ------------------------------------------------------------
-- ACTIVITY LOG scoping
-- ------------------------------------------------------------
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
UPDATE activity_log SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_log(company_id);

COMMIT;
