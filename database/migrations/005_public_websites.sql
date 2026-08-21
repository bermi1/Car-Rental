-- ============================================================
-- Migration 005 — companies become tenants with their own website
--
-- A rental company applies to join, the platform admin accepts them, and they
-- get a real website: catalogue, about, contact, the extra services they sell,
-- optionally on their own domain. Registration is levelled — what a company
-- may do depends on the level the admin puts them on.
--
-- Also adds bulk SMS, so the platform can reach owners, staff or clients.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- LEVELLED REGISTRATION
--
-- The level is the lever the platform admin actually pulls: it decides how
-- many cars a company may list and whether they may point their own domain at
-- us. Enforced in the API, not just displayed.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE company_level AS ENUM ('trial', 'basic', 'standard', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS level company_level NOT NULL DEFAULT 'trial';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS level_notes TEXT;

-- What each level allows. A row per level so the admin can change the limits
-- without a deploy, and the API reads the same numbers the UI shows.
CREATE TABLE IF NOT EXISTS level_limits (
  level company_level PRIMARY KEY,
  max_vehicles INTEGER NOT NULL,
  max_staff INTEGER NOT NULL,
  custom_domain_allowed BOOLEAN NOT NULL DEFAULT false,
  website_pages_allowed BOOLEAN NOT NULL DEFAULT true,
  monthly_price_tzs NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT
);

INSERT INTO level_limits (level, max_vehicles, max_staff, custom_domain_allowed, website_pages_allowed, monthly_price_tzs, description) VALUES
  ('trial',     3,   2, false, false,      0, 'Try the system — a few cars, the shared catalogue link.'),
  ('basic',    10,   5, false, true,   50000, 'A full catalogue website on a bermirentals.co.tz link.'),
  ('standard', 30,  15, true,  true,  120000, 'Your own domain, your own pages.'),
  ('premium',  999, 99, true,  true,  250000, 'Unlimited fleet and staff.')
ON CONFLICT (level) DO NOTHING;

-- ------------------------------------------------------------
-- APPLICATIONS — how a company gets in
--
-- Anyone can apply. Nothing exists until the platform admin accepts: approving
-- is what creates the company, its settings and its owner account, so a
-- half-finished signup never leaves an orphan tenant behind.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS company_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  region TEXT,
  fleet_size INTEGER,
  message TEXT,
  requested_level company_level NOT NULL DEFAULT 'trial',
  status application_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  -- Set once approved, so an application can be traced to what it became.
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES staff_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON company_applications(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_pending_email
  ON company_applications (lower(contact_email)) WHERE status = 'pending';

-- ------------------------------------------------------------
-- CUSTOM DOMAINS
--
-- The company points a CNAME at us and we serve their catalogue on it. Stored
-- lowercase and unique platform-wide: two tenants cannot claim one hostname.
-- ------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_custom_domain
  ON companies (lower(custom_domain)) WHERE custom_domain IS NOT NULL;

-- ------------------------------------------------------------
-- WEBSITE PAGES — about, contact, terms, anything they want
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  -- Whether it appears in the site's navigation, and in what order.
  in_nav BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pages_company ON company_pages(company_id, sort_order);

-- ------------------------------------------------------------
-- EXTRA SERVICES — driver, airport pickup, child seat, GPS unit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_tzs NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Per day, or once for the whole rental.
  per_day BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_company ON company_services(company_id, sort_order);

-- ------------------------------------------------------------
-- SOCIAL SHARE IMAGE
--
-- What WhatsApp and Instagram show when a car link is shared. Falls back to
-- the first photo when not set.
-- ------------------------------------------------------------
ALTER TABLE vehicles  ADD COLUMN IF NOT EXISTS meta_image_path TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_image_path TEXT;

-- ------------------------------------------------------------
-- BULK SMS
--
-- A campaign is the message plus who it went to; recipients are written at
-- send time so the record survives someone later being deleted.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE sms_audience AS ENUM ('all', 'owners', 'staff', 'clients', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sms_status AS ENUM ('draft', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null for a platform-wide send by the admin; set when an owner messages
  -- only their own people.
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  audience sms_audience NOT NULL DEFAULT 'all',
  target_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status sms_status NOT NULL DEFAULT 'draft',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  sent_by UUID REFERENCES staff_users(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(message) BETWEEN 1 AND 1000)
);

CREATE TABLE IF NOT EXISTS sms_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  kind TEXT NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_recipients_campaign ON sms_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_created ON sms_campaigns(created_at DESC);

-- Staff need a phone number to receive any of this.
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS phone TEXT;
