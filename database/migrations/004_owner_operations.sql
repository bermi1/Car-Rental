-- ============================================================
-- Migration 004 — what an owner actually runs day to day
--
-- The platform admin registers companies and creates each one's owner.
-- The owner then runs their own business: lists cars, invites staff, records
-- what the fleet costs to keep on the road, and watches one summary. Staff do
-- the data entry. Clients arrive from a QR code or the company's own link and
-- book from that company's catalogue without an account.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- EXPENSES
--
-- Money going out, against the company and optionally against one car, so
-- "what does this vehicle actually cost us" is answerable.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'fuel', 'repair', 'service', 'insurance', 'licensing', 'tyres',
    'cleaning', 'parking', 'fine', 'salary', 'rent', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Nullable: rent and salaries belong to the company, not to a car.
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  category expense_category NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency currency NOT NULL DEFAULT 'TZS',
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,
  receipt_file_path TEXT,
  recorded_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses(company_id, spent_on DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);

-- ------------------------------------------------------------
-- REPAIRS AND SERVICING
--
-- maintenance_logs already existed as a service history. It gains the pieces
-- an owner needs: which company it belongs to, what it cost, who did the work,
-- and whether it is finished — so a car sitting in the garage is visible
-- rather than just quietly unavailable.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE repair_status AS ENUM ('reported', 'in_progress', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS cost NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS currency currency NOT NULL DEFAULT 'TZS';
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS status repair_status NOT NULL DEFAULT 'done';
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS garage TEXT;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';
-- Links the repair to the expense it created, so a cost is never counted twice.
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

-- Backfill the company from the vehicle, which has always known it.
UPDATE maintenance_logs m
   SET company_id = v.company_id
  FROM vehicles v
 WHERE v.id = m.vehicle_id AND m.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_company ON maintenance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_logs(status);

-- ------------------------------------------------------------
-- PUBLIC CATALOGUE
--
-- Each company gets a public page at /c/<slug>, which is what the QR code
-- points at. Clients browse that company's cars, see condition and price, and
-- book — the company is fixed by the link, so a client never has to know which
-- company they are dealing with before they arrive.
-- ------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS catalogue_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- What a car looks like to someone deciding whether to book it.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seats INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS transmission TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS condition_note TEXT;
-- An owner can keep a car off the public page without taking it out of service.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS listed_publicly BOOLEAN NOT NULL DEFAULT true;

-- Which company a client first arrived through, for the owner's own numbers.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicles_public ON vehicles(company_id, listed_publicly, status);
