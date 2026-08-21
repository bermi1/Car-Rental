import { query } from '../config/db';

/**
 * Charging for fuel that did not come back.
 *
 * Cars are handed over on the understanding that they return on the level they
 * left on. Staff record a level at both ends of the rental as words rather
 * than litres, so the comparison is between positions on the gauge — and the
 * charge is proportional to how far short it is, not a flat fee for being one
 * needle-width down.
 */

/** Gauge positions as a fraction of a tank. */
const LEVELS: Record<string, number> = {
  empty: 0,
  quarter: 0.25,
  half: 0.5,
  three_quarters: 0.75,
  full: 1,
};

function fraction(level: string | null | undefined): number | null {
  if (!level) return null;
  const value = LEVELS[String(level).toLowerCase()];
  return value === undefined ? null : value;
}

/**
 * Works out the fuel shortfall for a booking and writes it onto the booking,
 * so the bill has a settled figure rather than recomputing one every time it
 * is read.
 *
 * Does nothing unless both handovers were recorded — with only one end of the
 * rental measured there is nothing to compare, and guessing would charge
 * somebody for fuel they may well have put in.
 */
export async function settleFuelCharge(bookingId: string): Promise<number> {
  const { rows } = await query(
    `SELECT
       (SELECT fuel_level FROM condition_reports
         WHERE booking_id = $1 AND type = 'check_in'
         ORDER BY recorded_at DESC LIMIT 1) AS out_level,
       (SELECT fuel_level FROM condition_reports
         WHERE booking_id = $1 AND type = 'check_out'
         ORDER BY recorded_at DESC LIMIT 1) AS back_level,
       b.fuel_fee_amount,
       s.fuel_shortfall_fee_tzs
     FROM bookings b
     JOIN company_settings s ON s.company_id = b.company_id
     WHERE b.id = $1`,
    [bookingId]
  );
  const row = rows[0];
  if (!row) return 0;

  // A figure already on the booking stands: staff may have waived it, or
  // charged something they agreed with the customer at the counter.
  const existing = Number(row.fuel_fee_amount) || 0;
  if (existing > 0) return existing;

  const out = fraction(row.out_level);
  const back = fraction(row.back_level);
  if (out === null || back === null) return 0;

  const shortfall = out - back;
  if (shortfall <= 0) return 0;

  const fullTankFee = Number(row.fuel_shortfall_fee_tzs) || 0;
  const charge = Math.round(fullTankFee * shortfall);
  if (charge <= 0) return 0;

  await query('UPDATE bookings SET fuel_fee_amount = $2 WHERE id = $1', [bookingId, charge]);
  return charge;
}
