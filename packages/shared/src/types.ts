// Shared domain types across API, web-admin, web-staff, mobile.

export type StaffRole = 'admin' | 'staff';
export type VehicleStatus = 'available' | 'booked' | 'in_service' | 'out_of_service';
export type IdType = 'national_id' | 'passport' | 'drivers_license' | 'other';
export type DevicePlatform = 'ios' | 'android';
export type RentalType = 'self_drive' | 'driver_included';
export type Currency = 'TZS' | 'USD';
export type BookingStatus =
  | 'pending_documents'
  | 'documents_submitted'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled';
export type DocumentType = 'id_document' | 'driving_license' | 'other';
export type ConditionReportType = 'check_in' | 'check_out';
export type DepositStatus = 'held' | 'released' | 'forfeited';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  plate_number: string;
  category: string;
  status: VehicleStatus;
  current_mileage: number;
  daily_rate_tzs: number;
  photos: string[];
  created_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  id_type: IdType;
  id_number: string | null;
  id_document_file: string | null;
  driving_license_file: string | null;
  created_at: string;
}

export interface ClientDevice {
  id: string;
  client_id: string;
  device_name: string;
  platform: DevicePlatform;
  device_identifier: string;
  first_linked_at: string;
  last_active_at: string;
  is_active: boolean;
}

export interface Booking {
  id: string;
  vehicle_id: string;
  client_id: string;
  rental_type: RentalType;
  start_date: string;
  end_date: string;
  pickup_region: string;
  dropoff_region: string;
  is_cross_region: boolean;
  quoted_currency: Currency;
  quoted_amount: number;
  status: BookingStatus;
  created_by_staff_id: string | null;
  created_at: string;
  vehicle?: Vehicle;
  client?: Client;
}

export interface DocumentRecord {
  id: string;
  booking_id: string | null;
  client_id: string;
  document_type: DocumentType;
  file_path: string;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  uploaded_at: string;
}

export interface ConditionReport {
  id: string;
  booking_id: string;
  type: ConditionReportType;
  photos: string[];
  fuel_level: string;
  mileage: number;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface Contract {
  id: string;
  booking_id: string;
  pdf_file_path: string;
  signed: boolean;
  signature_file_path: string | null;
  generated_at: string;
}

export interface Deposit {
  id: string;
  booking_id: string;
  amount: number;
  status: DepositStatus;
  reason: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  service_type: string;
  mileage_at_service: number;
  next_service_due_mileage: number | null;
  date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

export interface SystemSettings {
  usd_to_tzs_rate: number;
  default_daily_rate_tzs: number;
  updated_at: string;
}
