import { query } from '../config/db';

/**
 * Keeps a car's status in step with its bookings.
 *
 * Before this, a vehicle went to `booked` when a rental was activated and back
 * to `available` when it completed — but a confirmed booking left the car
 * looking free, so two customers could be promised the same car. The fleet
 * screen showed a state nobody was maintaining.
 *
 * The rule is one line: a car is `booked` while it has a confirmed or active
 * rental, and `available` when it does not. A car in the garage or withdrawn
 * is left alone — those are decisions a human made, and a booking should not
 * quietly undo them.
 */
export async function syncVehicleStatus(vehicleId: string): Promise<void> {
  await query(
    `UPDATE vehicles v
        SET status = CASE
              WHEN EXISTS (
                SELECT 1 FROM bookings b
                 WHERE b.vehicle_id = v.id
                   AND b.status IN ('confirmed', 'active')
              ) THEN 'booked'::vehicle_status
              ELSE 'available'::vehicle_status
            END
      WHERE v.id = $1
        AND v.status IN ('available', 'booked')`,
    [vehicleId]
  );
}

/** Same rule, applied to every car in a company — used after bulk changes. */
export async function syncCompanyFleet(companyId: string): Promise<void> {
  await query(
    `UPDATE vehicles v
        SET status = CASE
              WHEN EXISTS (
                SELECT 1 FROM bookings b
                 WHERE b.vehicle_id = v.id
                   AND b.status IN ('confirmed', 'active')
              ) THEN 'booked'::vehicle_status
              ELSE 'available'::vehicle_status
            END
      WHERE v.company_id = $1
        AND v.status IN ('available', 'booked')`,
    [companyId]
  );
}

/**
 * Whether a car is free for a date range.
 *
 * Two rentals clash unless one ends before the other starts.
 * `exceptBookingId` lets an existing booking be edited without colliding with
 * itself.
 */
export async function isVehicleFree(
  vehicleId: string,
  startDate: string,
  endDate: string,
  exceptBookingId?: string
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM bookings
      WHERE vehicle_id = $1
        AND status IN ('pending_documents', 'documents_submitted', 'confirmed', 'active')
        AND ($4::uuid IS NULL OR id <> $4)
        AND start_date <= $3::date
        AND end_date   >= $2::date
      LIMIT 1`,
    [vehicleId, startDate, endDate, exceptBookingId ?? null]
  );
  return rows.length === 0;
}
