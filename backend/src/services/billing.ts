import { query } from '../config/db';
import { settleFuelCharge } from './fuel';

/**
 * What a rental actually costs, worked out line by line.
 *
 * The quoted amount was only ever the rental itself. A real bill also carries
 * the extras the customer chose, a penalty when the car comes back late, a
 * charge when it comes back short of fuel, and any damage that has been
 * charged — less whatever has already been confirmed as paid.
 *
 * Every figure here is read from the database. Nothing is taken from the
 * request, so a client cannot talk its own bill down.
 */

export interface BillLine {
  label: string;
  detail?: string;
  amount: number;
}

export interface Bill {
  currency: string;
  lines: BillLine[];
  subtotal: number;
  paid: number;
  balance: number;
  /** Days the car was kept beyond the agreed return date. */
  late_days: number;
}

/** Whole days from `from` to `to`, never negative. */
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * Builds the bill for one booking.
 *
 * `asOf` exists so a bill can be quoted for a moment other than now — the
 * lateness of a car still out is a moving number, and a preview shouldn't
 * silently mean "at this instant" when the caller meant the return date.
 */
export async function buildBill(bookingId: string, asOf: Date = new Date()): Promise<Bill | null> {
  const { rows } = await query(
    `SELECT b.id, b.company_id, b.quoted_amount, b.quoted_currency, b.end_date, b.status,
            b.extras_amount, b.late_fee_amount, b.fuel_fee_amount, b.discount_amount,
            b.returned_at,
            s.late_return_fee_per_day_tzs, s.fuel_shortfall_fee_tzs
       FROM bookings b
       JOIN company_settings s ON s.company_id = b.company_id
      WHERE b.id = $1`,
    [bookingId]
  );
  const booking = rows[0];
  if (!booking) return null;

  const currency = booking.quoted_currency || 'TZS';
  const lines: BillLine[] = [];

  const rental = Number(booking.quoted_amount) || 0;
  lines.push({ label: 'Rental', amount: rental });

  // ---- Extras chosen on the booking ----
  const { rows: serviceRows } = await query(
    `SELECT name, price_tzs, per_day, quantity FROM booking_services WHERE booking_id = $1`,
    [bookingId]
  );
  const { rows: dayRows } = await query(
    `SELECT GREATEST(1, (end_date - start_date) + 1) AS days FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const rentalDays = Number(dayRows[0]?.days) || 1;

  let extras = 0;
  for (const s of serviceRows) {
    const unit = Number(s.price_tzs) || 0;
    const qty = Number(s.quantity) || 1;
    const amount = s.per_day ? unit * qty * rentalDays : unit * qty;
    extras += amount;
    lines.push({
      label: s.name,
      detail: s.per_day ? `${unit.toLocaleString()} × ${rentalDays} days` : undefined,
      amount,
    });
  }

  // ---- Late return ----
  // Counted against when the car actually came back, or against now while it
  // is still out. A booking that was closed on time has no late line at all.
  const due = new Date(booking.end_date);
  const returned = booking.returned_at ? new Date(booking.returned_at) : null;
  const measureAt = returned ?? (booking.status === 'active' ? asOf : due);
  const lateDays = daysBetween(due, measureAt);

  const perDay = Number(booking.late_return_fee_per_day_tzs) || 0;
  // A figure already written onto the booking wins — staff may have waived or
  // negotiated it, and that decision should not be recomputed away.
  const storedLate = Number(booking.late_fee_amount) || 0;
  const lateFee = storedLate > 0 ? storedLate : lateDays * perDay;
  if (lateFee > 0) {
    lines.push({
      label: 'Late return',
      detail: `${lateDays} day${lateDays === 1 ? '' : 's'} × ${perDay.toLocaleString()}`,
      amount: lateFee,
    });
  }

  const fuelFee = Number(booking.fuel_fee_amount) || 0;
  if (fuelFee > 0) lines.push({ label: 'Fuel shortfall', amount: fuelFee });

  // ---- Damages that have actually been charged ----
  const { rows: damageRows } = await query(
    `SELECT description, penalty_amount FROM damages
      WHERE booking_id = $1 AND status = 'charged'`,
    [bookingId]
  );
  for (const d of damageRows) {
    const amount = Number(d.penalty_amount) || 0;
    if (amount > 0) lines.push({ label: 'Damage', detail: d.description, amount });
  }

  const discount = Number(booking.discount_amount) || 0;
  if (discount > 0) lines.push({ label: 'Discount', amount: -discount });

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);

  const { rows: paidRows } = await query(
    `SELECT COALESCE(sum(amount), 0)::float AS paid FROM payments
      WHERE booking_id = $1 AND status = 'confirmed'`,
    [bookingId]
  );
  const paid = Number(paidRows[0].paid) || 0;

  return {
    currency,
    lines,
    subtotal: Math.round(subtotal),
    paid: Math.round(paid),
    balance: Math.round(subtotal - paid),
    late_days: lateDays,
  };
}

/**
 * Freezes the late and extras figures onto the booking at return.
 *
 * Once a car is back, lateness stops being a moving number — it has to be
 * fixed at the moment of return, or every later view of the bill would keep
 * growing.
 */
export async function settleOnReturn(bookingId: string, returnedAt: Date = new Date()): Promise<void> {
  // Fuel is settled first so the bill built below already carries the charge.
  await settleFuelCharge(bookingId);

  const bill = await buildBill(bookingId, returnedAt);
  if (!bill) return;

  const late = bill.lines.find((l) => l.label === 'Late return')?.amount ?? 0;
  const extras = bill.lines
    .filter((l) => !['Rental', 'Late return', 'Fuel shortfall', 'Damage', 'Discount'].includes(l.label))
    .reduce((sum, l) => sum + l.amount, 0);

  await query(
    `UPDATE bookings
        SET returned_at = COALESCE(returned_at, $2),
            late_fee_amount = CASE WHEN late_fee_amount > 0 THEN late_fee_amount ELSE $3 END,
            extras_amount = $4
      WHERE id = $1`,
    [bookingId, returnedAt.toISOString(), late, extras]
  );
}
