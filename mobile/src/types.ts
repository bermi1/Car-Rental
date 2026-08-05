export interface Vehicle {
  id: string;
  make: string;
  model: string;
  plate_number: string;
  category: string;
  status: string;
  current_mileage: number;
  daily_rate_tzs: number;
  photos: string[];
  created_at: string;
}

export interface BookingClientRef {
  id: string;
  full_name: string;
  phone: string;
  email: string;
}

export interface Booking {
  id: string;
  vehicle_id: string;
  client_id: string;
  rental_type: 'self_drive' | 'driver_included';
  start_date: string;
  end_date: string;
  pickup_region: string;
  dropoff_region: string;
  is_cross_region: boolean;
  quoted_currency: 'TZS' | 'USD';
  quoted_amount: number;
  status: string;
  created_at: string;
  vehicle?: Vehicle;
  client?: BookingClientRef;
}

export interface DocumentRecord {
  id: string;
  booking_id: string | null;
  client_id: string;
  document_type: string;
  file_path: string;
  verified: boolean;
  rejection_reason: string | null;
  uploaded_at: string;
}

export interface ConditionReport {
  id: string;
  booking_id: string;
  type: 'check_in' | 'check_out';
  photos: string[];
  fuel_level: string;
  mileage: number;
  notes: string | null;
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

export interface BookingDetailResponse extends Booking {
  documents: DocumentRecord[];
  condition_reports: ConditionReport[];
  contracts: Contract[];
  deposits: any[];
}

export interface ClientDevice {
  id: string;
  client_id: string;
  device_name: string;
  platform: 'ios' | 'android';
  device_identifier: string;
  first_linked_at: string;
  last_active_at: string;
  is_active: boolean;
}
