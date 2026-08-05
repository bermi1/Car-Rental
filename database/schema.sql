-- Rental Car Management Platform — PostgreSQL schema
-- Run against a fresh database: psql -d rentaldb -f database/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE vehicle_status AS ENUM ('available', 'booked', 'in_service', 'out_of_service');
CREATE TYPE staff_role AS ENUM ('admin', 'staff');
CREATE TYPE id_type AS ENUM ('national_id', 'passport', 'drivers_license', 'other');
CREATE TYPE device_platform AS ENUM ('ios', 'android');
CREATE TYPE rental_type AS ENUM ('self_drive', 'driver_included');
CREATE TYPE currency AS ENUM ('TZS', 'USD');
CREATE TYPE booking_status AS ENUM (
  'pending_documents', 'documents_submitted', 'confirmed', 'active', 'completed', 'cancelled'
);
CREATE TYPE document_type AS ENUM ('id_document', 'driving_license', 'other');
CREATE TYPE condition_report_type AS ENUM ('check_in', 'check_out');
CREATE TYPE deposit_status AS ENUM ('held', 'released', 'forfeited');

-- ============================================================
-- STAFF USERS (admin/staff)
-- ============================================================
CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role staff_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  id_type id_type NOT NULL DEFAULT 'national_id',
  id_number TEXT,
  id_document_file TEXT,
  driving_license_file TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLIENT DEVICES
-- ============================================================
CREATE TABLE client_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  platform device_platform NOT NULL,
  device_identifier TEXT NOT NULL,
  first_linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (client_id, device_identifier)
);

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  plate_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  status vehicle_status NOT NULL DEFAULT 'available',
  current_mileage INTEGER NOT NULL DEFAULT 0,
  daily_rate_tzs NUMERIC(14,2) NOT NULL DEFAULT 0,
  photos TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  rental_type rental_type NOT NULL DEFAULT 'self_drive',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pickup_region TEXT NOT NULL,
  dropoff_region TEXT NOT NULL,
  is_cross_region BOOLEAN NOT NULL DEFAULT false,
  quoted_currency currency NOT NULL DEFAULT 'TZS',
  quoted_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'pending_documents',
  created_by_staff_id UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_vehicle ON bookings(vehicle_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  file_path TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES staff_users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_documents_booking ON documents(booking_id);

-- ============================================================
-- CONDITION REPORTS
-- ============================================================
CREATE TABLE condition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type condition_report_type NOT NULL,
  photos TEXT[] NOT NULL DEFAULT '{}',
  fuel_level TEXT NOT NULL,
  mileage INTEGER NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES staff_users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_condition_reports_booking ON condition_reports(booking_id);

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pdf_file_path TEXT NOT NULL,
  signed BOOLEAN NOT NULL DEFAULT false,
  signature_file_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DEPOSITS
-- ============================================================
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  status deposit_status NOT NULL DEFAULT 'held',
  reason TEXT,
  recorded_by UUID REFERENCES staff_users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MAINTENANCE LOGS
-- ============================================================
CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  mileage_at_service INTEGER NOT NULL,
  next_service_due_mileage INTEGER,
  date DATE NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_vehicle ON maintenance_logs(vehicle_id);

-- ============================================================
-- SYSTEM SETTINGS (single-row config: exchange rate, pricing)
-- ============================================================
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  usd_to_tzs_rate NUMERIC(14,4) NOT NULL DEFAULT 2600,
  default_daily_rate_tzs NUMERIC(14,2) NOT NULL DEFAULT 100000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

INSERT INTO system_settings (id) VALUES (1);

CREATE TABLE seasonal_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rate_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- ============================================================
-- ACTIVITY LOG (for admin recent-activity feed + staff "my activity")
-- ============================================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id UUID REFERENCES staff_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_staff ON activity_log(actor_staff_id);
