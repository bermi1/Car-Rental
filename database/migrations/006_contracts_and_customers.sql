-- ============================================================
-- Migration 006 — the desk's real workflow
--
-- Staff register a walk-in customer themselves and attach their papers. The
-- contract stops being a stub: it carries the company's own terms, the
-- customer reads them, consents, and signs. A booking gets a share link so the
-- customer can open their own rental without hunting for it. Fees stop being a
-- single quoted number and become a bill with the late-return penalty on it.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- CUSTOMERS REGISTERED AT THE DESK
--
-- Not everyone arrives through the app. Staff enter a walk-in, and the account
-- is real — the customer can sign in later with the same phone number.
-- ------------------------------------------------------------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff_users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS registered_by_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS licence_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS licence_expiry DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_registered_by ON clients(registered_by_company_id);

-- ------------------------------------------------------------
-- THE COMPANY'S OWN TERMS
--
-- One current version per company. Versioned rather than edited in place: a
-- signed contract must keep pointing at the exact wording that was agreed, not
-- at whatever the terms say today.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Rental Terms and Conditions',
  body TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_current
  ON company_terms (company_id) WHERE is_current;

-- ------------------------------------------------------------
-- CONTRACTS BECOME REAL DOCUMENTS
-- ------------------------------------------------------------
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS terms_id UUID REFERENCES company_terms(id);
-- The full rendered text, frozen at generation. A contract must read the same
-- in a year as it did on the day it was signed.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reference TEXT;

-- Consent is three separate facts, so "they clicked a box" can never be
-- mistaken for "they read it and signed".
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_name TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
-- Recorded with the signature as evidence of who consented and from where.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_ip TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_user_agent TEXT;

UPDATE contracts c SET company_id = b.company_id
  FROM bookings b WHERE b.id = c.booking_id AND c.company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_reference
  ON contracts (reference) WHERE reference IS NOT NULL;

-- ------------------------------------------------------------
-- SHARE LINK
--
-- A token the customer can be sent. It identifies one booking and nothing
-- else, so it can go over WhatsApp without exposing an account.
-- ------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_share_token
  ON bookings (share_token) WHERE share_token IS NOT NULL;

-- ------------------------------------------------------------
-- FEES THAT ADD UP
--
-- quoted_amount was the whole story. A rental also runs late, comes back
-- short of fuel, and carries extras — each stored so the total can be
-- explained line by line rather than asserted.
-- ------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extras_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fuel_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
-- When the car actually came back, which is what the late fee is computed from.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- BUSINESS LOGO
-- ------------------------------------------------------------
-- companies.logo_path already exists from migration 002; nothing to add.

-- Extras chosen on a booking, priced at the time they were chosen.
CREATE TABLE IF NOT EXISTS booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID REFERENCES company_services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price_tzs NUMERIC(14,2) NOT NULL DEFAULT 0,
  per_day BOOLEAN NOT NULL DEFAULT false,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);
